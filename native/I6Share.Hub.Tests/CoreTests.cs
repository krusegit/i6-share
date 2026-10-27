using I6Share.Hub.Core;

namespace I6Share.Hub.Tests;

public sealed partial class CoreTests
{
    [Fact]
    public async Task PersistsCompletedFilesAcrossRestartAndResetsPartialFiles()
    {
        var h = await Harness.CreateAsync();
        await using var hLifetime = h.ConfigureAwait(true);
        await h.PairAsync();
        var offer = Offer("{\"name\":\"../photo.txt\",\"size\":4,\"type\":\"text/plain\",\"lastModified\":123},{\"name\":\"empty\",\"size\":0},{\"size\":3}");
        Assert.Equal(200, (await h.PostAsync("offer", offer)).Reply.Status);
        Assert.False((await h.PostAsync("end", End)).Json.GetProperty("ok").GetBoolean());
        h.Time += 1000;
        Assert.Equal(2, (await h.PostAsync("put", Operation(), [1, 2])).Json.GetProperty("bytes").GetInt64());
        h.Time += 1000;
        Assert.Equal(4, (await h.PostAsync("put", Operation(offset: 2), [3, 4])).Json.GetProperty("bytes").GetInt64());
        _ = await h.PostAsync("put", Operation(2), [7]);
        var before = await h.Service.GetStatusAsync();
        _ = Assert.Single(before.Transfers);
        Assert.Equal(2, before.Transfers[0].Done);
        Assert.True(before.Transfers[0].Speed > 0);
        Assert.Equal(new byte[] { 1, 2, 3, 4 }, await File.ReadAllBytesAsync(before.History.Single(file => file.Size == 4).Where ?? ""));
        var id = before.HubId;
        await h.Service.DisposeAsync();
        h.Service = await HubService.CreateAsync(h.Options);
        Assert.Equal(id, (await h.Service.GetStatusAsync()).HubId);
        Assert.Equal([4, 0, 0], (await h.PostAsync("offer", offer)).Json.GetProperty("received").EnumerateArray().Select(value => value.GetInt64()));
        Assert.Equal(4, (await h.PostAsync("put", Operation(offset: 4), [9])).Json.GetProperty("bytes").GetInt64());
        _ = await h.PostAsync("put", Operation(2), [7, 8, 9]);
        Assert.True((await h.PostAsync("end", End)).Json.GetProperty("ok").GetBoolean());
        Assert.True((await h.Service.GetStatusAsync()).Transfers[0].Complete);
        h.Time += h.Options.PartialTtlMs + 1;
        await h.Service.SweepAsync();
        Assert.Empty((await h.Service.GetStatusAsync()).Transfers);
        Assert.True((await h.PostAsync("end", End)).Json.GetProperty("ok").GetBoolean());
        Assert.Equal([4, 0, 3], (await h.PostAsync("offer", offer)).Json.GetProperty("received").EnumerateArray().Select(value => value.GetInt64()));
    }

    [Fact]
    public async Task IncomingFailuresRetrySafelyAndDirectorySettingsRespectActiveTransfers()
    {
        var h = await Harness.CreateAsync();
        await using var hLifetime = h.ConfigureAwait(true);
        await h.PairAsync();
        h.Sink.FailReservationAt = 1;
        Assert.Equal(500, (await h.PostAsync("offer", Offer("{\"name\":\"one\",\"size\":2},{\"name\":\"two\",\"size\":2}"))).Reply.Status);
        h.Sink.FailReservationAt = -1;
        Assert.Equal(200, (await h.PostAsync("offer", Offer(/*lang=json,strict*/ "{\"name\":\"one\",\"size\":2}"))).Reply.Status);
        Assert.Equal("one", (await h.Service.GetStatusAsync()).Transfers[0].Files[0].Name);
        var other = Path.Combine(h.Root, "other");
        Assert.Equal(409, (await Assert.ThrowsAsync<HubOperationException>(() => h.Service.SetSettingsAsync(null, other))).Status);
        h.Sink.FailCreate = true;
        Assert.Equal(500, (await h.PostAsync("put", Operation(), [1])).Reply.Status);
        h.Sink.FailCreate = false;
        h.Sink.FailWrite = true;
        Assert.Equal(500, (await h.PostAsync("put", Operation(), [1])).Reply.Status);
        h.Sink.FailWrite = false;
        h.Sink.FailComplete = true;
        Assert.Equal(500, (await h.PostAsync("put", Operation(), [1, 2])).Reply.Status);
        h.Sink.FailComplete = false;
        Assert.Equal(200, (await h.PostAsync("put", Operation(), [1, 2])).Reply.Status);
        var old = h.Sink;
        await h.Service.SetSettingsAsync("  New\n PC ", other);
        Assert.True(old.Disposed);
        var status = await h.Service.GetStatusAsync();
        Assert.Equal("New  PC", status.Name);
        Assert.Equal(other, status.ReceiveDirectory);
        await h.Service.SetSettingsAsync("", null);
        Assert.Equal("Linux PC", (await h.Service.GetStatusAsync()).Name);
        await h.Service.SetSettingsAsync(null, null);
    }

    [Fact]
    public async Task EmptyFilesRetryFinalizationAndCancellationRemovesOnlyPartialData()
    {
        var h = await Harness.CreateAsync();
        await using var hLifetime = h.ConfigureAwait(true);
        await h.PairAsync();
        h.Sink.FailComplete = true;
        var offer = Offer("{\"name\":\"empty\",\"size\":0},{\"name\":\"partial\",\"size\":3}");
        Assert.Equal(500, (await h.PostAsync("offer", offer)).Reply.Status);
        h.Sink.FailComplete = false;
        Assert.Equal(200, (await h.PostAsync("put", Operation())).Reply.Status);
        Assert.Equal(200, (await h.PostAsync("offer", offer)).Reply.Status);
        Assert.Equal(0, (await h.PostAsync("put", Operation(1))).Json.GetProperty("bytes").GetInt64());
        _ = await h.PostAsync("put", Operation(1), [1]);
        _ = await h.PostAsync("cancel", End);
        Assert.Empty((await h.Service.GetStatusAsync()).Transfers);
        Assert.True(File.Exists(Path.Combine(h.Options.ReceiveDirectory, "empty")));
        Assert.False(File.Exists(Path.Combine(h.Options.ReceiveDirectory, "partial")));
        Assert.Empty(Directory.GetFiles(Path.Combine(h.Options.ReceiveDirectory, ".i6-partials"), "*.part"));
        _ = await h.PostAsync("offer", offer);
        h.Time += h.Options.PartialTtlMs + 1;
        await h.Service.SweepAsync();
        Assert.Empty((await h.Service.GetStatusAsync()).Transfers);
    }
    [Fact]
    public async Task CompletedHistoryHonorsRetentionAndChangedOffersAndRetriesEmptyCreation()
    {
        var h = await Harness.CreateAsync();
        await using var hLifetime = h.ConfigureAwait(true);
        await h.PairAsync();
        var originalId = h.DeviceId;
        var originalKey = h.Key;
        h.DeviceId = "1111111111111111";
        await h.PairAsync();
        h.DeviceId = originalId;
        h.Key = originalKey;
        var offer = Offer("{\"name\":\"small\",\"size\":1},{\"name\":\"partial\",\"size\":2}");
        _ = await h.PostAsync("offer", offer);
        _ = await h.PostAsync("put", Operation(), [1]);
        h.Time += h.Options.PartialTtlMs + 1;
        await h.Service.SweepAsync();
        Assert.False((await h.PostAsync("end", End)).Json.GetProperty("ok").GetBoolean());
        h.Sink.FailReservationAt = h.Sink.Reservations;
        Assert.Equal(500, (await h.PostAsync("offer", offer)).Reply.Status);
        h.Sink.FailReservationAt = -1;
        var changed = Offer(/*lang=json,strict*/ "{\"name\":\"changed\",\"size\":2}");
        Assert.Equal(0, (await h.PostAsync("offer", changed)).Json.GetProperty("received")[0].GetInt64());
        _ = await h.PostAsync("cancel", End);
        h.Time += (7 * 24 * 3_600_000L) + 1;
        Assert.Equal([0, 0], (await h.PostAsync("offer", offer)).Json.GetProperty("received").EnumerateArray().Select(value => value.GetInt64()));
        _ = await h.PostAsync("put", Operation(), [2]);
        _ = await h.PostAsync("cancel", End);
        h.Sink.FailCreate = true;
        var otherTid = "aaaaaaaaaaaaaaaaaaaaaaaa";
        var empty = Offer(/*lang=json,strict*/ "{\"size\":0}").Replace(Tid, otherTid, StringComparison.Ordinal);
        Assert.Equal(500, (await h.PostAsync("offer", empty)).Reply.Status);
        h.Sink.FailCreate = false;
        Assert.Equal(200, (await h.PostAsync("offer", empty)).Reply.Status);
        Assert.Equal(400, (await Assert.ThrowsAsync<HubOperationException>(() => h.Service.QueueFilesAsync(h.DeviceId, [.. Enumerable.Repeat("file", 10_001)]))).Status);
    }


    [Fact]
    public async Task ALocalFilenameCollisionReselectsTheNameWithoutOverwritingEitherFile()
    {
        var h = await Harness.CreateAsync();
        await using var hLifetime = h.ConfigureAwait(true);
        await h.PairAsync();
        _ = await h.PostAsync("offer", Offer(/*lang=json,strict*/ "{\"name\":\"collision.txt\",\"size\":1}"));
        var original = Path.Combine(h.Options.ReceiveDirectory, "collision.txt");
        await File.WriteAllTextAsync(original, "local content");
        Assert.Equal(500, (await h.PostAsync("put", Operation(), [42])).Reply.Status);
        Assert.Equal("collision (1).txt", (await h.Service.GetStatusAsync()).Transfers[0].Files[0].Name);
        Assert.Equal(200, (await h.PostAsync("put", Operation(), [42])).Reply.Status);
        Assert.Equal("local content", await File.ReadAllTextAsync(original));
        Assert.Equal("*"u8.ToArray(), await File.ReadAllBytesAsync(Path.Combine(h.Options.ReceiveDirectory, "collision (1).txt")));
    }

    [Fact]
    public async Task RejectsChangedActiveOffersAndAggregateSizesAndCleansUpUnopenedQueues()
    {
        var h = await Harness.CreateAsync();
        await using var hLifetime = h.ConfigureAwait(true);
        await h.PairAsync();
        Assert.Equal(404, (await h.PostAsync("end", End)).Reply.Status);
        _ = await Assert.ThrowsAsync<FileNotFoundException>(() => h.Service.QueueFilesAsync(h.DeviceId, [Path.Combine(h.Root, "missing")]));
        Assert.Equal(400, (await h.PostAsync("offer", Offer("{\"size\":9007199254740991},{\"size\":1}"))).Reply.Status);
        Assert.Equal(200, (await h.PostAsync("offer", Offer(/*lang=json,strict*/ "{\"size\":2}"))).Reply.Status);
        Assert.Equal(400, (await h.PostAsync("offer", Offer("{\"size\":2},{\"size\":2}"))).Reply.Status);
        Assert.Equal(400, (await h.PostAsync("offer", Offer(/*lang=json,strict*/ "{\"size\":3}"))).Reply.Status);
        Assert.Equal(200, (await h.PostAsync("offer", Offer(/*lang=json,strict*/ "{\"size\":2}"))).Reply.Status);
        _ = Assert.Single((await h.Service.GetStatusAsync()).Transfers[0].Files);
        Assert.Equal(200, (await h.PostAsync("put", Operation(), [1, 2])).Reply.Status);
    }
}
