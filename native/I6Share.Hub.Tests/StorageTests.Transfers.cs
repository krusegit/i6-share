using System.Text;
using I6Share.Hub.Storage;

namespace I6Share.Hub.Tests;

public sealed partial class StorageTests
{
    [Fact]
    public async Task FilesRemainPrivateUntilAtomicCompletionAndNeverOverwriteExistingFiles()
    {
        using var directory = new StorageDirectory();
        var sink = new FileTransferSink(directory.Receive);
        await using var sinkLifetime = sink.ConfigureAwait(true);
        var name = sink.ReserveName("../photo.jpg");
        Assert.Equal("_photo.jpg", name);
        var file = await sink.CreateAsync(name);
        await using var fileLifetime = file.ConfigureAwait(true);
        Assert.Equal(name, file.Name);
        Assert.Equal(Path.Combine(directory.Receive, name), file.FilePath);
        await file.WriteAsync(new byte[] { 1, 2 });
        await file.WriteAsync(new byte[] { 3 });
        Assert.False(File.Exists(file.FilePath));
        await file.CompleteAsync();
        await file.CompleteAsync();
        await file.AbortAsync();
        Assert.Equal(new byte[] { 1, 2, 3 }, await File.ReadAllBytesAsync(file.FilePath));
        _ = await Assert.ThrowsAsync<IOException>(() => file.WriteAsync(new byte[] { 4 }));
        sink.ReleaseName(name);
        Assert.Equal("_photo (1).jpg", sink.ReserveName("../photo.jpg"));
        Assert.Empty(Directory.GetFiles(Path.Combine(directory.Receive, ".i6-partials"), "*.part"));
    }

    [Fact]
    public async Task ReservationsPreventConcurrentCollisionAndAbortAllowsRetry()
    {
        using var directory = new StorageDirectory();
        var sink = new FileTransferSink(directory.Receive);
        await using var sinkLifetime = sink.ConfigureAwait(true);
        Assert.Equal("name", sink.ReserveName("name"));
        Assert.Equal("NAME (1)", sink.ReserveName("NAME"));
        var file = await sink.CreateAsync("name");
        _ = await Assert.ThrowsAsync<InvalidOperationException>(() => sink.CreateAsync("name"));
        _ = await Assert.ThrowsAsync<InvalidOperationException>(() => sink.CreateAsync("../evil"));
        await file.WriteAsync(new byte[] { 1 });
        await file.AbortAsync();
        await file.AbortAsync();
        var retry = await sink.CreateAsync("name");
        await using var retryLifetime = retry.ConfigureAwait(true);
        await retry.CompleteAsync();
        Assert.Equal(0, new FileInfo(retry.FilePath).Length);
        sink.ReleaseName("name (1)");
        Assert.Equal("NAME (1)", sink.ReserveName("NAME"));
        var pending = await sink.CreateAsync("NAME (1)");
        await sink.DisposeAsync();
        await sink.DisposeAsync();
        Assert.Empty(Directory.GetFiles(Path.Combine(directory.Receive, ".i6-partials"), "*.part"));
        _ = Assert.Throws<ObjectDisposedException>(() => sink.ReserveName("later"));
        _ = await Assert.ThrowsAsync<ObjectDisposedException>(() => sink.CreateAsync("later"));
        await pending.DisposeAsync();
    }

    [Fact]
    public async Task CancelledAndConflictingWritersLeaveOtherFilesUntouched()
    {
        using var directory = new StorageDirectory();
        var sink = new FileTransferSink(directory.Receive);
        await using var sinkLifetime = sink.ConfigureAwait(true);
        var name = sink.ReserveName("collision");
        _ = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => sink.CreateAsync(name, new CancellationToken(true)));
        var file = await sink.CreateAsync(name);
        await using var fileLifetime = file.ConfigureAwait(true);
        _ = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => file.WriteAsync(new byte[] { 1 }, new CancellationToken(true)));
        _ = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => file.CompleteAsync(new CancellationToken(true)));
        await file.WriteAsync(new byte[] { 2 });
        await File.WriteAllTextAsync(file.FilePath, "external");
        _ = await Assert.ThrowsAsync<IOException>(() => file.CompleteAsync());
        _ = await Assert.ThrowsAsync<IOException>(() => file.CompleteAsync());
        Assert.Equal("external", await File.ReadAllTextAsync(file.FilePath));
        await file.AbortAsync();
        Assert.Equal("external", await File.ReadAllTextAsync(file.FilePath));
        _ = Directory.CreateDirectory(Path.Combine(directory.Receive, "directory"));
        Assert.Equal("directory (1)", sink.ReserveName("directory"));
    }

    [Theory]
    [InlineData("", "file")]
    [InlineData("... ", "file")]
    [InlineData(" . ", "file")]
    [InlineData("../a\\b\0\u001f\u007f", "_a_b___")]
    [InlineData("  notes.txt  ", "notes.txt")]
    public void FileNamesCannotTraverseDirectories(string input, string expected)
    {
        Assert.Equal(expected, FileTransferSink.CleanFileName(input));
    }

    [Fact]
    public async Task FileNamesAreBoundedAndReservedSuffixesEventuallyFail()
    {
        Assert.Equal(200, FileTransferSink.CleanFileName(new string('x', 201)).Length);
        Assert.Equal(200, Encoding.UTF8.GetByteCount(FileTransferSink.CleanFileName(string.Concat(Enumerable.Repeat("😀", 80)))));
        using var directory = new StorageDirectory();
        var sink = new FileTransferSink(directory.Receive);
        for (var index = 0; index < 10_000; index++)
        {
            _ = sink.ReserveName(index == 0 ? "one.txt" : $"one ({index}).txt");
        }

        _ = Assert.Throws<IOException>(() => sink.ReserveName("one.txt"));
        await sink.DisposeAsync();
    }
}
