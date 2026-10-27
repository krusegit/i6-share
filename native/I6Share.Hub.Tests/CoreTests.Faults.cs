using I6Share.Hub.Storage;

namespace I6Share.Hub.Tests;

public sealed partial class CoreTests
{
    private sealed class FaultStore(string directory) : IHubStore
    {
        private readonly FileHubStore _inner = new(directory);
        public bool FailSave;
        public bool FailLoad;
        public bool FailRead;
        public bool Disposed;
        public string DataDirectory => _inner.DataDirectory;
        public Task<HubSnapshot> LoadAsync(string directory, string name, CancellationToken cancellationToken = default)
        {
            return FailLoad ? throw new IOException("load") : _inner.LoadAsync(directory, name, cancellationToken);
        }

        public Task SaveAsync(HubSnapshot snapshot, CancellationToken cancellationToken = default)
        {
            return FailSave ? throw new IOException("save") : _inner.SaveAsync(snapshot, cancellationToken);
        }

        public Task<StoredOutbox> ImportOutboxAsync(string tid, string deviceId, IReadOnlyList<OutboxUpload> files, long createdAt, CancellationToken cancellationToken = default)
        {
            return _inner.ImportOutboxAsync(tid, deviceId, files, createdAt, cancellationToken);
        }

        public Stream OpenOutboxRead(string tid, StoredFile file)
        {
            return FailRead ? throw new IOException("read") : _inner.OpenOutboxRead(tid, file);
        }

        public void DeleteOutboxFiles(string tid)
        {
            _inner.DeleteOutboxFiles(tid);
        }

        public async ValueTask DisposeAsync()
        {
            Disposed = true;
            await _inner.DisposeAsync().ConfigureAwait(true);
        }
    }
    private sealed class FaultSink(ITransferSink inner) : ITransferSink
    {
        public bool FailCreate;
        public bool FailWrite;
        public bool FailComplete;
        public int FailReservationAt = -1;
        public int Reservations;
        public bool Disposed;
        public string DirectoryPath => inner.DirectoryPath;
        public string ReserveName(string name)
        {
            return Reservations++ == FailReservationAt ? throw new IOException("reserve") : inner.ReserveName(name);
        }

        public void ReleaseName(string name)
        {
            inner.ReleaseName(name);
        }

        public async Task<IPendingFile> CreateAsync(string name, CancellationToken cancellationToken = default)
        {
            return FailCreate ? throw new IOException("create") : new FaultFile(await inner.CreateAsync(name, cancellationToken).ConfigureAwait(true), this);
        }

        public async ValueTask DisposeAsync()
        {
            Disposed = true;
            await inner.DisposeAsync().ConfigureAwait(true);
        }
        private sealed class FaultFile(IPendingFile inner, FaultSink owner) : IPendingFile
        {
            public string Name => inner.Name;
            public string FilePath => inner.FilePath;
            public Task WriteAsync(ReadOnlyMemory<byte> bytes, CancellationToken cancellationToken = default)
            {
                return owner.FailWrite ? throw new IOException("write") : inner.WriteAsync(bytes, cancellationToken);
            }

            public Task CompleteAsync(CancellationToken cancellationToken = default)
            {
                return owner.FailComplete ? throw new IOException("close") : inner.CompleteAsync(cancellationToken);
            }

            public Task AbortAsync()
            {
                return inner.AbortAsync();
            }

            public ValueTask DisposeAsync()
            {
                return inner.DisposeAsync();
            }
        }
    }
}
