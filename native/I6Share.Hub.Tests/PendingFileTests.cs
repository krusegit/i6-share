using I6Share.Hub.Storage;

namespace I6Share.Hub.Tests;

public sealed class PendingFileTests
{
    [Fact]
    public async Task CleanupDrainsEveryWriterEvenWhenUnlinkingOneFileFails()
    {
        var directory = Path.Combine(Path.GetTempPath(), "i6-pending-failure-" + Guid.NewGuid().ToString("N"));
        _ = Directory.CreateDirectory(directory);
        var partialDirectory = Path.Combine(directory, ".i6-partials");
        try
        {
            var sink = new FileTransferSink(directory);
            var first = await sink.CreateAsync(sink.ReserveName("first.bin")).ConfigureAwait(true);
            var second = await sink.CreateAsync(sink.ReserveName("second.bin")).ConfigureAwait(true);
            File.SetUnixFileMode(partialDirectory, UnixFileMode.UserRead | UnixFileMode.UserExecute);
            var cleanup = sink.DisposeAsync().AsTask();
            _ = await Assert.ThrowsAsync<UnauthorizedAccessException>(() => cleanup).ConfigureAwait(true);
            _ = await Assert.ThrowsAsync<IOException>(() => first.WriteAsync(new byte[] { 1 })).ConfigureAwait(true);
            _ = await Assert.ThrowsAsync<IOException>(() => second.WriteAsync(new byte[] { 2 })).ConfigureAwait(true);
            File.SetUnixFileMode(partialDirectory, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
            var replacement = new FileTransferSink(directory);
            await using var replacementLifetime = replacement.ConfigureAwait(true);
            Assert.Empty(Directory.GetFiles(partialDirectory, "*.part"));
        }
        finally
        {
            File.SetUnixFileMode(partialDirectory, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
            Directory.Delete(directory, recursive: true);
        }
    }

    [Fact]
    public async Task DisposalIsSharedAndTerminalOperationsRemainIdempotent()
    {
        var directory = Path.Combine(Path.GetTempPath(), "i6-pending-" + Guid.NewGuid().ToString("N"));
        _ = Directory.CreateDirectory(directory);
        try
        {
            var sink = new FileTransferSink(directory);
            await using var sinkLifetime = sink.ConfigureAwait(true);
            var pending = await sink.CreateAsync(sink.ReserveName("test.bin")).ConfigureAwait(true);
            await using var pendingLifetime = pending.ConfigureAwait(true);
            var writes = Enumerable.Range(0, 8).Select(_ => pending.WriteAsync(new byte[1024])).ToArray();
            var first = sink.DisposeAsync().AsTask();
            var second = sink.DisposeAsync().AsTask();
            Assert.Same(first, second);
            await Task.WhenAll(writes).ConfigureAwait(true);
            await first.ConfigureAwait(true);
            await pending.DisposeAsync().ConfigureAwait(true);
            await pending.CompleteAsync().ConfigureAwait(true);
            await pending.AbortAsync().ConfigureAwait(true);
            _ = await Assert.ThrowsAsync<IOException>(() => pending.WriteAsync(new byte[] { 1 })).ConfigureAwait(true);
            Assert.False(File.Exists(pending.FilePath));
            Assert.Empty(Directory.GetFiles(Path.Combine(directory, ".i6-partials"), "*.part"));
            var replacement = new FileTransferSink(directory);
            await using var replacementLifetime = replacement.ConfigureAwait(true);
            Assert.Equal("test.bin", replacement.ReserveName("test.bin"));
        }
        finally { Directory.Delete(directory, recursive: true); }
    }
}
