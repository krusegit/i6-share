using I6Share.Hub.Core;
using I6Share.Hub.Storage;

namespace I6Share.Hub.Tests;

public sealed partial class CoreTests
{
    [Fact]
    public async Task OutboxIsDurableTracksProgressAndCanBeAcknowledgedOrCancelled()
    {
        var h = await Harness.CreateAsync();
        await using var hLifetime = h.ConfigureAwait(true);
        await h.PairAsync();
        var path = Path.Combine(h.Root, "send.bin");
        await File.WriteAllBytesAsync(path, [1, 2, 3, 4]);
        var tid = await h.Service.QueueFilesAsync(h.DeviceId, [path, path]);
        var status = await h.Service.GetStatusAsync();
        Assert.False(status.Outbox[0].Started);
        await h.Service.DisposeAsync();
        h.Service = await HubService.CreateAsync(h.Options);
        var (Reply, Json, Binary) = await h.PostAsync("sync", /*lang=json,strict*/ "{\"wait\":1000,\"name\":\"Renamed\",\"os\":\"Linux\"}");
        Assert.Equal(tid, Json.GetProperty("outbox")[0].GetProperty("tid").GetString());
        var pull = $"{{\"tid\":\"{tid}\",\"i\":0,\"offset\":0,\"length\":2}}";
        Assert.Equal(new byte[] { 1, 2 }, (await h.PostAsync("pull", pull)).Binary);
        h.Time += 1000;
        _ = await h.PostAsync("pull", pull.Replace("\"offset\":0", "\"offset\":2", StringComparison.Ordinal));
        h.Time += 1000;
        _ = await h.PostAsync("pull", pull.Replace("\"i\":0", "\"i\":1", StringComparison.Ordinal));
        status = await h.Service.GetStatusAsync();
        Assert.True(status.Outbox[0].Started);
        Assert.True(status.Outbox[0].Speed > 0);
        Assert.Equal(6, status.Outbox[0].Bytes);
        _ = await h.PostAsync("pulled", $"{{\"tid\":\"{tid}\"}}");
        Assert.Empty((await h.Service.GetStatusAsync()).Outbox);
        Assert.False(await h.Service.CancelOutboxAsync(tid));
        tid = await h.Service.QueueFilesAsync(h.DeviceId, [path]);
        Assert.True(await h.Service.CancelOutboxAsync(tid));
        Assert.Empty((await h.Service.GetStatusAsync()).Outbox);
        tid = await h.Service.QueueFilesAsync(h.DeviceId, [path]);
        _ = await h.PostAsync("offer", Offer(/*lang=json,strict*/ "{\"size\":2}"));
        _ = await h.PostAsync("put", Operation(), [1]);
        Assert.True(await h.Service.RevokeAsync(h.DeviceId));
        Assert.False(await h.Service.RevokeAsync(h.DeviceId));
        status = await h.Service.GetStatusAsync();
        Assert.Empty(status.Devices);
        Assert.Empty(status.Outbox);
        Assert.Empty(status.Transfers);
    }

    [Fact]
    public async Task StoreAndSinkFailuresLeaveRecoverableStateAndReleaseResources()
    {
        var h = await Harness.CreateAsync();
        await using var hLifetime = h.ConfigureAwait(true);
        await h.PairAsync();
        h.Store.FailSave = true;
        var other = Path.Combine(h.Root, "other");
        _ = await Assert.ThrowsAsync<IOException>(() => h.Service.SetSettingsAsync("name", other));
        Assert.True(h.Sink.Disposed);
        Assert.Equal(h.Options.ReceiveDirectory, (await h.Service.GetStatusAsync()).ReceiveDirectory);
        h.Store.FailSave = false;
        var path = Path.Combine(h.Root, "file");
        await File.WriteAllTextAsync(path, "data");
        h.Store.FailSave = true;
        _ = await Assert.ThrowsAsync<IOException>(() => h.Service.QueueFilesAsync(h.DeviceId, [path]));
        Assert.Empty((await h.Service.GetStatusAsync()).Outbox);
        h.Store.FailSave = false;
        var tid = await h.Service.QueueFilesAsync(h.DeviceId, [path]);
        h.Store.FailRead = true;
        Assert.Equal(500, (await h.PostAsync("pull", $"{{\"tid\":\"{tid}\",\"i\":0,\"offset\":0,\"length\":1}}")).Reply.Status);
        h.Store.FailRead = false;
        _ = await Assert.ThrowsAsync<FileNotFoundException>(() => h.Service.QueueFilesAsync(h.DeviceId, [path, path + ".missing"]));
        Assert.Equal(400, (await Assert.ThrowsAsync<HubOperationException>(() => h.Service.QueueFilesAsync(h.DeviceId, []))).Status);
        Assert.Equal(404, (await Assert.ThrowsAsync<HubOperationException>(() => h.Service.QueueFilesAsync("missing", [path]))).Status);
        await h.Service.DisposeAsync();
        await h.Service.DisposeAsync();
        Assert.Equal(503, (await h.Service.HandleAsync("GET", "/i6/hello", new Dictionary<string, string>(), ReadOnlyMemory<byte>.Empty, "")).Status);
        _ = await Assert.ThrowsAsync<ObjectDisposedException>(() => h.Service.GetStatusAsync());
    }

    [Fact]
    public async Task IgnoresUnknownOutboxAcknowledgmentsWithoutRemovingOtherItems()
    {
        var h = await Harness.CreateAsync();
        await using var hLifetime = h.ConfigureAwait(true);
        await h.PairAsync();
        Assert.Equal(404, (await h.Service.HandleAsync("DELETE", "/i6/hello", new Dictionary<string, string>(), ReadOnlyMemory<byte>.Empty, "")).Status);
        var path = Path.Combine(h.Root, "outbox");
        await File.WriteAllTextAsync(path, "payload");
        _ = await h.Service.QueueFilesAsync(h.DeviceId, [path]);
        Assert.Equal(404, (await h.PostAsync("pull", $"{{\"tid\":\"{Tid}\",\"i\":0,\"offset\":0,\"length\":1}}")).Reply.Status);
        Assert.Equal(200, (await h.PostAsync("pulled", End)).Reply.Status);
        _ = Assert.Single((await h.Service.GetStatusAsync()).Outbox);
    }

    [Fact]
    public async Task InvalidStartupRollsBackTheStoreAndAddressDiscoveryFailureIsNonFatal()
    {
        var root = Path.Combine(Path.GetTempPath(), "i6-core-invalid-" + Guid.NewGuid().ToString("N"));
        try
        {
            var options = new HubServiceOptions { DataDirectory = root, ReceiveDirectory = Path.Combine(root, "receive"), Port = 0 };
            await RejectStartupAsync<ArgumentOutOfRangeException>(options);
            await RejectStartupAsync<ArgumentOutOfRangeException>(options with
            {
                Port = 65536
            }, failLoad: true);
            await RejectStartupAsync<IOException>(options with
            {
                Port = 47616
            }, failLoad: true);
            await RejectStartupAsync<ArgumentOutOfRangeException>(options with
            {
                Port = 47616,
                PartialTtlMs = -1
            });
            var service = await HubService.CreateAsync(options with
            {
                Port = 47616,
                Addresses = () => throw new IOException("interfaces")
            });
            await using var serviceLifetime = service.ConfigureAwait(true);
            Assert.Empty((await service.GetStatusAsync()).Addrs);
        }
        finally { Directory.Delete(root, true); }
    }
    private static async Task RejectStartupAsync<TException>(HubServiceOptions options, bool failLoad = false) where TException : Exception
    {
        var store = new FaultStore(options.DataDirectory) { FailLoad = failLoad };
        await using var storeLifetime = store.ConfigureAwait(true);
        _ = await Assert.ThrowsAsync<TException>(() => HubService.CreateAsync(options, store, path => new FileTransferSink(path))).ConfigureAwait(true);
        Assert.True(store.Disposed);
    }

    [Fact]
    public void HubErrorsDefaultToInternalStatusAndPreserveTheirCause()
    {
        var defaultError = new HubOperationException();
        Assert.Equal(500, defaultError.Status);
        Assert.Equal("internal", defaultError.Code);
        var messageError = new HubOperationException("failed");
        Assert.Equal(500, messageError.Status);
        Assert.Equal("failed", messageError.Code);
        var cause = new IOException("disk");
        var wrappedError = new HubOperationException("failed", cause);
        Assert.Equal(500, wrappedError.Status);
        Assert.Equal("failed", wrappedError.Code);
        Assert.Same(cause, wrappedError.InnerException);
    }

    [Fact]
    public async Task NetworkDiscoveryFailureDoesNotPreventLocalAdministration()
    {
        using var directory = new StorageDirectory();
        var service = await HubService.CreateAsync(new HubServiceOptions
        {
            DataDirectory = directory.Data,
            ReceiveDirectory = directory.Receive,
            Addresses = () => throw new System.Net.NetworkInformation.NetworkInformationException(),
        });
        await using var serviceLifetime = service.ConfigureAwait(true);
        Assert.Empty((await service.GetStatusAsync()).Addrs);
        Assert.NotEmpty((await service.NewPairCodeAsync()).Payload);
    }

}
