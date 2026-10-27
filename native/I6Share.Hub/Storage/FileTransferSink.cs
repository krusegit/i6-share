using System.Collections.Immutable;
using System.Globalization;
using System.Text;

namespace I6Share.Hub.Storage;

/// <summary>Reserves collision-free names and atomically publishes completed files.</summary>
internal sealed class FileTransferSink : ITransferSink
{
    private readonly Lock gate = new();
    private readonly FileStream lease;
    private ImmutableHashSet<string> reserved = ImmutableHashSet.Create<string>(StringComparer.OrdinalIgnoreCase);
    private ImmutableHashSet<IPendingFile> pending = [];
    private bool disposed;
    private Task? disposeTask;

    public FileTransferSink(string receiveDirectory)
    {
        DirectoryPath = Path.GetFullPath(receiveDirectory);
        _ = Directory.CreateDirectory(DirectoryPath);
        StoragePaths.CreatePrivateDirectory(PartialDirectory);
        StoragePaths.RejectLink(PartialDirectory);
        var lockPath = Path.Combine(PartialDirectory, ".lock");
        if (new FileInfo(lockPath).LinkTarget is not null)
        {
            throw new IOException("The incoming-file lock cannot be a symbolic link.");
        }

        lease = new FileStream(lockPath, StoragePaths.PrivateFileOptions(FileMode.OpenOrCreate, FileAccess.ReadWrite));
        try
        {
            foreach (var partial in Directory.EnumerateFiles(PartialDirectory, "*.part"))
            {
                var stem = Path.GetFileNameWithoutExtension(partial);
                if (stem.Length == 32 && stem.All(char.IsAsciiHexDigit))
                {
                    File.Delete(partial);
                }
            }
        }
        catch { lease.Dispose(); throw; }
    }

    public string DirectoryPath
    {
        get;
    }
    private string PartialDirectory => Path.Combine(DirectoryPath, ".i6-partials");

    public static string CleanFileName(string name)
    {
        var clean = new string([.. name.Select(character => character is '/' or '\\' || char.IsControl(character) ? '_' : character)])
            .Trim().TrimStart('.').Trim();
        var result = new StringBuilder();
        var bytes = 0;
        foreach (var rune in clean.EnumerateRunes())
        {
            bytes += rune.Utf8SequenceLength;
            if (bytes > 200)
            {
                break;
            }

            _ = result.Append(rune.ToString());
        }
        return result.Length == 0 ? "file" : result.ToString();
    }

    public string ReserveName(string originalName)
    {
        var cleaned = CleanFileName(originalName);
        var extension = Path.GetExtension(cleaned);
        var stem = cleaned[..^extension.Length];
        lock (gate)
        {
            ObjectDisposedException.ThrowIf(disposed, this);
            for (var index = 0; index < 10_000; index++)
            {
                var candidate = index == 0 ? cleaned : stem + " (" + index.ToString(CultureInfo.InvariantCulture) + ")" + extension;
                var path = Path.Combine(DirectoryPath, candidate);
                if (reserved.Contains(candidate) || File.Exists(path) || Directory.Exists(path) || new FileInfo(path).LinkTarget is not null)
                {
                    continue;
                }

                reserved = reserved.Add(candidate);
                return candidate;
            }
        }
        throw new IOException("No unused filename is available.");
    }

    public void ReleaseName(string reservedName)
    {
        lock (gate)
        {
            reserved = reserved.Remove(reservedName);
        }
    }

    public Task<IPendingFile> CreateAsync(string reservedName, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (gate)
        {
            ObjectDisposedException.ThrowIf(disposed, this);
            if (!reserved.Contains(reservedName))
            {
                throw new InvalidOperationException("The filename must be reserved before opening a file.");
            }

            if (pending.Any(file => file.Name == reservedName))
            {
                throw new InvalidOperationException("A writer already owns this filename.");
            }

            var temporary = Path.Combine(PartialDirectory, Guid.NewGuid().ToString("N", CultureInfo.InvariantCulture) + ".part");
            IPendingFile file = new PendingFile(reservedName, Path.Combine(DirectoryPath, reservedName), temporary, Released);
            pending = pending.Add(file);
            return Task.FromResult(file);
        }
    }

    private void Released(IPendingFile file)
    {
        lock (gate)
        {
            pending = pending.Remove(file);
        }
    }

    public ValueTask DisposeAsync()
    {
        lock (gate)
        {
            disposeTask ??= DisposeCoreAsync();
            return new ValueTask(disposeTask);
        }
    }

    private async Task DisposeCoreAsync()
    {
        disposed = true;
        var files = pending;
        pending = [];
        reserved = reserved.Clear();
        try
        {
            await Task.WhenAll(files.Select(file => file.DisposeAsync().AsTask())).ConfigureAwait(false);
        }
        finally { await lease.DisposeAsync().ConfigureAwait(false); }
    }
}
