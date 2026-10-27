using I6Share.Hub.Storage;

namespace I6Share.Hub.Tests;

public sealed partial class StorageTests
{
    [Fact]
    public async Task SymlinksInsidePrivateStorageAreRejected()
    {
        using var directory = new StorageDirectory();
        var outside = Path.Combine(directory.Root, "outside");
        _ = Directory.CreateDirectory(outside);
        _ = Directory.CreateSymbolicLink(directory.Data, outside);
        _ = Assert.Throws<IOException>(() => new FileHubStore(directory.Data));
        Directory.Delete(directory.Data);
        _ = Directory.CreateDirectory(directory.Data);
        _ = Directory.CreateSymbolicLink(Path.Combine(directory.Data, "outbox"), outside);
        _ = Assert.Throws<IOException>(() => new FileHubStore(directory.Data));
        Directory.Delete(Path.Combine(directory.Data, "outbox"));
        _ = File.CreateSymbolicLink(Path.Combine(directory.Data, ".lock"), Path.Combine(outside, "lock"));
        _ = Assert.Throws<IOException>(() => new FileHubStore(directory.Data));
        File.Delete(Path.Combine(directory.Data, ".lock"));
        var store = new FileHubStore(directory.Data);
        await using var storeLifetime = store.ConfigureAwait(true);
        await File.WriteAllTextAsync(Path.Combine(outside, "state"), "private");
        _ = File.CreateSymbolicLink(Path.Combine(directory.Data, "state.json"), Path.Combine(outside, "state"));
        _ = await Assert.ThrowsAsync<IOException>(() => store.LoadAsync(directory.Receive, "name"));
        var outbox = Path.Combine(directory.Data, "outbox", Tid);
        _ = Directory.CreateSymbolicLink(outbox, outside);
        _ = Assert.Throws<IOException>(() => store.OpenOutboxRead(Tid, StoredFile()));
        _ = Assert.Throws<IOException>(() => store.DeleteOutboxFiles(Tid));
        Directory.Delete(outbox);
        _ = Directory.CreateDirectory(outbox);
        _ = File.CreateSymbolicLink(Path.Combine(outbox, "000000.bin"), Path.Combine(outside, "state"));
        _ = Assert.Throws<IOException>(() => store.OpenOutboxRead(Tid, StoredFile()));
        _ = Directory.CreateDirectory(directory.Receive);
        _ = Directory.CreateSymbolicLink(Path.Combine(directory.Receive, ".i6-partials"), outside);
        _ = Assert.Throws<IOException>(() => new FileTransferSink(directory.Receive));
        Directory.Delete(Path.Combine(directory.Receive, ".i6-partials"));
        _ = Directory.CreateDirectory(Path.Combine(directory.Receive, ".i6-partials"));
        _ = File.CreateSymbolicLink(Path.Combine(directory.Receive, ".i6-partials", ".lock"), Path.Combine(outside, "lock"));
        _ = Assert.Throws<IOException>(() => new FileTransferSink(directory.Receive));
        File.Delete(Path.Combine(directory.Receive, ".i6-partials", ".lock"));
        var sink = new FileTransferSink(directory.Receive);
        await using var sinkLifetime = sink.ConfigureAwait(true);
        _ = File.CreateSymbolicLink(Path.Combine(directory.Receive, "dangling"), Path.Combine(outside, "missing"));
        Assert.Equal("dangling (1)", sink.ReserveName("dangling"));
    }

    [Fact]
    public async Task OnlyOrphanedHubPartialsAreRemovedAfterObtainingExclusiveFolderOwnership()
    {
        using var directory = new StorageDirectory();
        var partial = Path.Combine(directory.Receive, ".i6-partials");
        _ = Directory.CreateDirectory(partial);
        var stale = Path.Combine(partial, new string('a', 32) + ".part");
        var unrelated = Path.Combine(partial, "unrelated.part");
        var nonhex = Path.Combine(partial, new string('g', 32) + ".part");
        await File.WriteAllTextAsync(stale, "orphan");
        await File.WriteAllTextAsync(unrelated, "keep");
        await File.WriteAllTextAsync(nonhex, "keep");
        var sink = new FileTransferSink(directory.Receive);
        await using var sinkLifetime = sink.ConfigureAwait(true);
        Assert.False(File.Exists(stale));
        Assert.True(File.Exists(unrelated));
        Assert.True(File.Exists(nonhex));
        _ = Assert.Throws<IOException>(() => new FileTransferSink(directory.Receive));
    }

    [Fact]
    public async Task FailedOrphanCleanupReleasesTheDirectoryLock()
    {
        using var directory = new StorageDirectory();
        var partial = Path.Combine(directory.Receive, ".i6-partials");
        _ = Directory.CreateDirectory(partial);
        await File.WriteAllTextAsync(Path.Combine(partial, ".lock"), "");
        await File.WriteAllTextAsync(Path.Combine(partial, new string('a', 32) + ".part"), "orphan");
        File.SetUnixFileMode(partial, UnixFileMode.UserRead | UnixFileMode.UserExecute);
        try
        {
            _ = Assert.Throws<UnauthorizedAccessException>(() => new FileTransferSink(directory.Receive));
        }
        finally { File.SetUnixFileMode(partial, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute); }
        var sink = new FileTransferSink(directory.Receive);
        await using var sinkLifetime = sink.ConfigureAwait(true);
        Assert.Empty(Directory.GetFiles(partial, "*.part"));
    }
}
