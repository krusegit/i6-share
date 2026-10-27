using System.Collections.Immutable;
using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;

namespace I6Share.Hub.Storage;

/// <summary>Atomic, source-generated state persistence and private durable outbox files.</summary>
internal sealed class FileHubStore : IHubStore
{
    private readonly FileStream lease;
    private readonly SemaphoreSlim writer = new(1, 1);
    private bool disposed;
    private readonly OperationLifetime lifetime = new();
    private readonly Lock disposeLock = new();
    private Task? disposeTask;

    public FileHubStore(string dataDirectory)
    {
        DataDirectory = Path.GetFullPath(dataDirectory);
        StoragePaths.CreatePrivateDirectory(DataDirectory);
        StoragePaths.RejectLink(DataDirectory);
        StoragePaths.CreatePrivateDirectory(OutboxDirectory);
        StoragePaths.RejectLink(OutboxDirectory);
        var lockPath = Path.Combine(DataDirectory, ".lock");
        if (new FileInfo(lockPath).LinkTarget is not null)
        {
            throw new IOException("The hub lock cannot be a symbolic link.");
        }

        lease = new FileStream(lockPath, StoragePaths.PrivateFileOptions(FileMode.OpenOrCreate, FileAccess.ReadWrite));
    }

    public string DataDirectory
    {
        get;
    }
    private string StatePath => Path.Combine(DataDirectory, "state.json");
    private string OutboxDirectory => Path.Combine(DataDirectory, "outbox");

    public Task<HubSnapshot> LoadAsync(string initialReceiveDir, string initialName, CancellationToken cancellationToken = default)
    {
        return WithLifetimeAsync(() => LoadCoreAsync(initialReceiveDir, initialName, cancellationToken));
    }

    private async Task<HubSnapshot> LoadCoreAsync(string initialReceiveDir, string initialName, CancellationToken cancellationToken)
    {
        if (!File.Exists(StatePath))
        {
            var initial = new HubSnapshot
            {
                HubId = Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(8)),
                Name = string.IsNullOrWhiteSpace(initialName) ? "Linux PC" : initialName.Trim(),
                ReceiveDirectory = Path.GetFullPath(initialReceiveDir),
            };
            await SaveCoreAsync(initial, cancellationToken).ConfigureAwait(false);
            return initial;
        }

        StoragePaths.RejectLink(StatePath);
        var stream = new FileStream(StatePath, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, FileOptions.Asynchronous);
        await using var streamLease = stream.ConfigureAwait(false);
        HubSnapshot? snapshot;
        try
        {
            snapshot = await JsonSerializer.DeserializeAsync(stream, StorageJsonContext.Default.HubSnapshot, cancellationToken).ConfigureAwait(false);
        }
        catch (JsonException error)
        {
            throw new InvalidDataException("The hub state file is corrupt; it has not been replaced.", error);
        }
        Validate(snapshot);
        return snapshot;
    }

    public async Task SaveAsync(HubSnapshot snapshot, CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(!lifetime.TryEnter(), this);
        try
        {
            await SaveCoreAsync(snapshot, cancellationToken).ConfigureAwait(false);
        }
        finally { lifetime.Exit(); }
    }

    private async Task SaveCoreAsync(HubSnapshot snapshot, CancellationToken cancellationToken = default)
    {
        Validate(snapshot);
        await writer.WaitAsync(cancellationToken).ConfigureAwait(false);
        var temporary = Path.Combine(DataDirectory, $".state-{Guid.NewGuid():N}.tmp");
        try
        {
            var stream = new FileStream(temporary, StoragePaths.PrivateFileOptions(FileMode.CreateNew, FileAccess.Write));
            await using (stream.ConfigureAwait(false))
            {
                await JsonSerializer.SerializeAsync(stream, snapshot, StorageJsonContext.Default.HubSnapshot, cancellationToken).ConfigureAwait(false);
                await stream.FlushAsync(cancellationToken).ConfigureAwait(false);
                StoragePaths.FlushToDisk(stream);
            }
            cancellationToken.ThrowIfCancellationRequested();
            File.Move(temporary, StatePath, overwrite: true);
        }
        finally
        {
            File.Delete(temporary);
            _ = writer.Release();
        }
    }

    public Task<StoredOutbox> ImportOutboxAsync(string tid, string deviceId, IReadOnlyList<OutboxUpload> files, long createdAt, CancellationToken cancellationToken = default)
    {
        return WithLifetimeAsync(() => ImportOutboxCoreAsync(tid, deviceId, files, createdAt, cancellationToken));
    }

    private async Task<StoredOutbox> ImportOutboxCoreAsync(string tid, string deviceId, IReadOnlyList<OutboxUpload> files, long createdAt, CancellationToken cancellationToken)
    {
        RequireId(tid, 24);
        RequireId(deviceId, 16);
        if (files.Count == 0)
        {
            throw new ArgumentException("An outbox item requires at least one file.", nameof(files));
        }

        var temporary = Path.Combine(OutboxDirectory, $".import-{Guid.NewGuid():N}");
        StoragePaths.CreatePrivateDirectory(temporary);
        try
        {
            var imported = ImmutableArray.CreateBuilder<StoredFile>(files.Count);
            for (var index = 0; index < files.Count; index++)
            {
                var upload = files[index];
                var storageName = index.ToString("D6", CultureInfo.InvariantCulture) + ".bin";
                var destination = new FileStream(Path.Combine(temporary, storageName), StoragePaths.PrivateFileOptions(FileMode.CreateNew, FileAccess.Write));
                await using var destinationLease = destination.ConfigureAwait(false);
                await upload.Content.CopyToAsync(destination, cancellationToken).ConfigureAwait(false);
                await destination.FlushAsync(cancellationToken).ConfigureAwait(false);
                StoragePaths.FlushToDisk(destination);
                imported.Add(new StoredFile { Name = FileTransferSink.CleanFileName(upload.Name), Type = upload.Type, LastModified = upload.LastModified, Size = destination.Length, StorageName = storageName });
            }
            cancellationToken.ThrowIfCancellationRequested();
            Directory.Move(temporary, Path.Combine(OutboxDirectory, tid));
            return new StoredOutbox { Tid = tid, DeviceId = deviceId, CreatedAt = createdAt, Files = imported.MoveToImmutable() };
        }
        finally
        {
            if (Directory.Exists(temporary))
            {
                Directory.Delete(temporary, recursive: true);
            }
        }
    }

    public Stream OpenOutboxRead(string tid, StoredFile file)
    {
        ObjectDisposedException.ThrowIf(disposed, this);
        RequireId(tid, 24);
        if (!IsStorageName(file.StorageName))
        {
            throw new InvalidDataException("Invalid outbox storage filename.");
        }

        var directory = Path.Combine(OutboxDirectory, tid);
        StoragePaths.RejectLink(directory);
        var filename = Path.Combine(directory, file.StorageName);
        StoragePaths.RejectLink(filename);
        return new FileStream(filename, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, FileOptions.Asynchronous | FileOptions.RandomAccess);
    }

    public void DeleteOutboxFiles(string tid)
    {
        ObjectDisposedException.ThrowIf(disposed, this);
        RequireId(tid, 24);
        var directory = Path.Combine(OutboxDirectory, tid);
        if (!Directory.Exists(directory))
        {
            return;
        }

        StoragePaths.RejectLink(directory);
        Directory.Delete(directory, recursive: true);
    }

    private async Task<T> WithLifetimeAsync<T>(Func<Task<T>> operation)
    {
        ObjectDisposedException.ThrowIf(!lifetime.TryEnter(), this);
        try
        {
            return await operation().ConfigureAwait(false);
        }
        finally { lifetime.Exit(); }
    }

    public ValueTask DisposeAsync()
    {
        lock (disposeLock)
        {
            disposeTask ??= DisposeCoreAsync();
            return new ValueTask(disposeTask);
        }
    }

    private async Task DisposeCoreAsync()
    {
        disposed = true;
        await lifetime.Close().ConfigureAwait(false);
        try
        {
            await lease.DisposeAsync().ConfigureAwait(false);
        }
        finally { writer.Dispose(); }
    }

    private static bool IsHex(string value, int length)
    {
        return value.Length == length && value.All(char.IsAsciiHexDigitLower);
    }

    private static void RequireId(string value, int length)
    {
        if (!IsHex(value, length))
        {
            throw new ArgumentException("Invalid identifier.", nameof(value));
        }
    }
    private static bool IsStorageName(string value)
    {
        return value.Length >= 10 && value.EndsWith(".bin", StringComparison.Ordinal) && value[..^4].All(char.IsAsciiDigit);
    }

    private static bool IsSecret(string value)
    {
        return value.Length == 43 && value.All(character => char.IsAsciiLetterOrDigit(character) || character is '-' or '_');
    }

    private static void Validate([System.Diagnostics.CodeAnalysis.NotNull] HubSnapshot? snapshot)
    {
        if (snapshot is null || snapshot.Version != 1 || !IsHex(snapshot.HubId, 16) || string.IsNullOrWhiteSpace(snapshot.Name) || !Path.IsPathFullyQualified(snapshot.ReceiveDirectory)
            || snapshot.Devices.IsDefault || snapshot.Completed.IsDefault || snapshot.Outbox.IsDefault || snapshot.Received.IsDefault)
        {
            throw new InvalidDataException("Invalid persisted hub state.");
        }

        if (snapshot.Devices.Any(device => device is null || !IsHex(device.DeviceId, 16) || !IsSecret(device.Secret))
            || snapshot.Devices.Select(device => device.DeviceId).Distinct(StringComparer.Ordinal).Count() != snapshot.Devices.Length)
        {
            throw new InvalidDataException("Invalid persisted paired devices.");
        }

        if (snapshot.Completed.Any(completed => completed is null || completed.Sizes.IsDefault || completed.Names.IsDefault || completed.Saved.IsDefault || completed.Where.IsDefault
            || completed.Sizes.Length != completed.Names.Length || completed.Sizes.Length != completed.Saved.Length || completed.Sizes.Length != completed.Where.Length
            || completed.Sizes.Any(size => size < 0) || completed.Names.Any(name => name is null)))
        {
            throw new InvalidDataException("Invalid persisted transfer log.");
        }

        if (snapshot.Outbox.Any(outbox => outbox is null || !IsHex(outbox.Tid, 24) || !IsHex(outbox.DeviceId, 16) || outbox.Files.IsDefaultOrEmpty
            || outbox.Files.Any(file => file is null || file.Size < 0 || !IsStorageName(file.StorageName)))
            || snapshot.Outbox.Select(outbox => outbox.Tid).Distinct(StringComparer.Ordinal).Count() != snapshot.Outbox.Length)
        {
            throw new InvalidDataException("Invalid persisted outbox.");
        }

        if (snapshot.Received.Any(received => received is null || received.Size < 0))
        {
            throw new InvalidDataException("Invalid received-file history.");
        }
    }
}
