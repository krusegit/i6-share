using I6Share.Hub.Storage;

namespace I6Share.Hub.Tests;

public sealed class StorageLifetimeTests
{
    [Fact]
    public async Task DisposalKeepsTheDirectoryLockedUntilAnAdmittedImportCompletes()
    {
        using var directory = new StorageDirectory();
        var store = new FileHubStore(directory.Data);
        await using var storeLifetime = store.ConfigureAwait(true);
        _ = await store.LoadAsync(directory.Receive, "PC");
        using var source = new PausedStream();
        const string tid = "0123456789abcdef01234567";
        const string deviceId = "0123456789abcdef";
        var import = store.ImportOutboxAsync(tid, deviceId, [new OutboxUpload("data.bin", "", 0, source)], 1);
        await source.Started.ConfigureAwait(true);
        var disposal = store.DisposeAsync().AsTask();
        try
        {
            Assert.False(disposal.IsCompleted);
            _ = Assert.Throws<IOException>(() => new FileHubStore(directory.Data));
            _ = await Assert.ThrowsAsync<ObjectDisposedException>(() => store.LoadAsync(directory.Receive, "PC"));
            _ = await Assert.ThrowsAsync<ObjectDisposedException>(() => store.ImportOutboxAsync(tid, deviceId, [], 2));
        }
        finally
        {
            source.Release();
            _ = await import.ConfigureAwait(true);
            await disposal.ConfigureAwait(true);
        }

        var imported = await import.ConfigureAwait(true);
        var reopened = new FileHubStore(directory.Data);
        await using var reopenedLifetime = reopened.ConfigureAwait(true);
        using var copied = reopened.OpenOutboxRead(tid, Assert.Single(imported.Files));
        using var bytes = new MemoryStream();
        await copied.CopyToAsync(bytes);
        Assert.Equal(new byte[] { 1, 2, 3 }, bytes.ToArray());
    }

    private sealed class PausedStream() : MemoryStream([1, 2, 3])
    {
        private readonly TaskCompletionSource started = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly TaskCompletionSource released = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public Task Started => started.Task;

        public void Release()
        {
            released.SetResult();
        }

        public override async Task CopyToAsync(Stream destination, int bufferSize, CancellationToken cancellationToken)
        {
            started.SetResult();
            await released.Task.WaitAsync(cancellationToken).ConfigureAwait(true);
            await base.CopyToAsync(destination, bufferSize, cancellationToken).ConfigureAwait(true);
        }
    }
}
