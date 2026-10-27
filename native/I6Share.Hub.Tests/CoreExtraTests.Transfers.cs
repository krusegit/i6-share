using System.Text;
using I6Share.Contracts;

namespace I6Share.Hub.Tests;

public sealed partial class CoreExtraTests
{
    [Fact]
    public async Task LongPollingWakesAllWaitersWhenFilesArriveAndCancellationReleasesTheProtocolLock()
    {
        var s = await Scenario.CreateAsync();
        await using var sLifetime = s.ConfigureAwait(true);
        var device = await s.PairAsync();
        var first = s.SendAsync(device, "sync", /*lang=json,strict*/ "{\"wait\":25000}");
        var second = s.SendAsync(device, "sync", /*lang=json,strict*/ "{\"wait\":25000}");
        _ = await s.Hub.GetStatusAsync();
        var file = Path.Combine(s.Root, "outgoing.txt");
        await File.WriteAllTextAsync(file, "outgoing");
        var tid = await s.Hub.QueueFilesAsync(device.DeviceId, [file]);
        var responses = await Task.WhenAll(first, second).WaitAsync(TimeSpan.FromSeconds(5));
        Assert.All(responses, response => Assert.Equal(tid, response.Json.GetProperty("outbox")[0].GetProperty("tid").GetString()));
        Assert.True(await s.Hub.CancelOutboxAsync(tid));
        using var cancellation = new CancellationTokenSource();
        var cancelled = s.SendAsync(device, "sync", /*lang=json,strict*/ "{\"wait\":25000}", cancellationToken: cancellation.Token);
        _ = await s.Hub.GetStatusAsync();
        await cancellation.CancelAsync();
        _ = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => cancelled);
        Assert.Empty((await s.SendAsync(device, "sync", /*lang=json,strict*/ "{\"wait\":1}")).Json.GetProperty("outbox").EnumerateArray());
        var revoked = s.SendAsync(device, "sync", /*lang=json,strict*/ "{\"wait\":25000}");
        _ = await s.Hub.GetStatusAsync();
        Assert.True(await s.Hub.RevokeAsync(device.DeviceId));
        Assert.Equal(401, (await revoked.WaitAsync(TimeSpan.FromSeconds(5))).Status);
    }

    [Fact]
    public async Task DisposingTheHubWakesPendingPollsAndRejectsFurtherOperations()
    {
        var s = await Scenario.CreateAsync();
        await using var sLifetime = s.ConfigureAwait(true);
        var device = await s.PairAsync();
        var pending = s.SendAsync(device, "sync", /*lang=json,strict*/ "{\"wait\":25000}");
        _ = await s.Hub.GetStatusAsync();
        await s.Hub.DisposeAsync();
        Assert.Equal(503, (await pending.WaitAsync(TimeSpan.FromSeconds(5))).Status);
        Assert.Equal(503, (await s.SendAsync(device, "sync")).Status);
        _ = await Assert.ThrowsAsync<ObjectDisposedException>(() => s.Hub.NewPairCodeAsync());
    }

    [Fact]
    public async Task PullsOnlyOwnedFilesAndValidatesBoundsWhileMaintainingProgressAcrossChunks()
    {
        var s = await Scenario.CreateAsync();
        await using var sLifetime = s.ConfigureAwait(true);
        var device = await s.PairAsync();
        var stranger = await s.PairAsync("abcdefabcdefabcd");
        var source = Path.Combine(s.Root, "source.txt");
        await File.WriteAllTextAsync(source, "abcdef");
        var tid = await s.Hub.QueueFilesAsync(device.DeviceId, [source]);
        File.Delete(source);
        var request = $$"""{"tid":"{{tid}}","i":0,"offset":0,"length":2}""";
        Assert.Equal(404, (await s.SendAsync(stranger, "pull", request)).Status);
        foreach (var bounds in new[] { (-1, 0L, 1), (1, 0L, 1), (0, -1L, 1), (0, 7L, 1), (0, 9_007_199_254_740_992L, 1), (0, 0L, -1), (0, 0L, WireConstants.ChunkSize + 1) })
        {
            var invalid = $$"""{"tid":"{{tid}}","i":{{bounds.Item1}},"offset":{{bounds.Item2}},"length":{{bounds.Item3}}}""";
            Assert.Equal(400, (await s.SendAsync(device, "pull", invalid)).Status);
        }
        Assert.Equal("ab", Encoding.UTF8.GetString((await s.SendAsync(device, "pull", request)).Binary));
        s.Time = s.Time.AddSeconds(1);
        var middle = await s.SendAsync(device, "pull", $$"""{"tid":"{{tid}}","i":0,"offset":2,"length":2}""");
        Assert.Equal("cd", Encoding.UTF8.GetString(middle.Binary));
        s.Time = s.Time.AddSeconds(1);
        var final = await s.SendAsync(device, "pull", $$"""{"tid":"{{tid}}","i":0,"offset":4,"length":10}""");
        Assert.Equal("ef", Encoding.UTF8.GetString(final.Binary));
        Assert.Equal(6, final.Json.GetProperty("size").GetInt64());
        var outgoing = Assert.Single((await s.Hub.GetStatusAsync()).Outbox);
        Assert.Equal(6, outgoing.Bytes);
        Assert.True(outgoing.Started);
        Assert.True(outgoing.Speed > 0);
        Assert.Empty((await s.SendAsync(device, "pull", $$"""{"tid":"{{tid}}","i":0,"offset":6,"length":0}""")).Binary);
        _ = await s.SendAsync(stranger, "pulled", $$"""{"tid":"{{tid}}"}""");
        _ = Assert.Single((await s.Hub.GetStatusAsync()).Outbox);
        _ = await s.SendAsync(device, "pulled", $$"""{"tid":"{{tid}}"}""");
        Assert.Empty((await s.Hub.GetStatusAsync()).Outbox);
        Assert.False(await s.Hub.CancelOutboxAsync(tid));
        Assert.Equal(404, (await s.SendAsync(device, "pull", request)).Status);
    }


    [Fact]
    public async Task UploadsRejectBadOffsetsIndicesOverflowAndOversizedChunksWithoutLosingAcceptedBytes()
    {
        var s = await Scenario.CreateAsync();
        await using var sLifetime = s.ConfigureAwait(true);
        var device = await s.PairAsync();
        const string tid = "abcdefabcdefabcdefabcdef";
        const string command = /*lang=json,strict*/ "{\"tid\":\"abcdefabcdefabcdefabcdef\",\"i\":0,\"offset\":0}";
        Assert.Equal(404, (await s.SendAsync(device, "put", command, [1])).Status);
        _ = await s.SendAsync(device, "offer", /*lang=json,strict*/ "{\"tid\":\"abcdefabcdefabcdefabcdef\",\"files\":[{\"size\":3}]}");
        Assert.Equal(400, (await s.SendAsync(device, "put", $$"""{"tid":"{{tid}}","i":1,"offset":0}""", [1])).Status);
        Assert.Equal(400, (await s.SendAsync(device, "put", command, [1, 2, 3, 4])).Status);
        Assert.Equal(413, (await s.SendAsync(device, "put", command, new byte[WireConstants.ChunkSize + 1])).Status);
        Assert.Equal(0, (await s.SendAsync(device, "put", command)).Json.GetProperty("bytes").GetInt64());
        Assert.Equal(1, (await s.SendAsync(device, "put", command, [1])).Json.GetProperty("bytes").GetInt64());
        var replay = await s.SendAsync(device, "put", command, [1]);
        Assert.Equal("offset", replay.Json.GetProperty("error").GetString());
        Assert.Equal(1, replay.Json.GetProperty("bytes").GetInt64());
        Assert.Equal(400, (await s.SendAsync(device, "put", $$"""{"tid":"{{tid}}","i":0,"offset":9007199254740992}""", [1])).Status);
        Assert.True((await s.SendAsync(device, "cancel", $$"""{"tid":"{{tid}}"}""")).Json.GetProperty("ok").GetBoolean());
        Assert.True((await s.SendAsync(device, "cancel", $$"""{"tid":"{{tid}}"}""")).Json.GetProperty("ok").GetBoolean());
    }
}
