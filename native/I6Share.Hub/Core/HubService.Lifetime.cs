namespace I6Share.Hub.Core;

internal sealed partial class HubService
{
    private async Task<T> LockedAsync<T>(Func<Task<T>> operation, CancellationToken cancellationToken)
    {
        ObjectDisposedException.ThrowIf(!_lifetime.TryEnter(), this);
        try
        {
            await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
            try
            {
                ObjectDisposedException.ThrowIf(_disposed, this);
                return await operation().ConfigureAwait(false);
            }
            finally { _ = _gate.Release(); }
        }
        finally { _lifetime.Exit(); }
    }

    public async Task<HubReply> HandleAsync(string method, string path, IReadOnlyDictionary<string, string> query, ReadOnlyMemory<byte> body, string remoteAddress, CancellationToken cancellationToken = default)
    {
        if (!_lifetime.TryEnter())
        {
            return Error(503, "unavailable");
        }
        try
        {
            return await HandleCoreAsync(method, path, query, body, remoteAddress, cancellationToken).ConfigureAwait(false);
        }
        finally { _lifetime.Exit(); }
    }

    public ValueTask DisposeAsync()
    {
        lock (_disposeLock)
        {
            _disposeTask ??= DisposeCoreAsync();
            return new ValueTask(_disposeTask);
        }
    }

    private async Task DisposeCoreAsync()
    {
        var drained = _lifetime.Close();
        await _gate.WaitAsync().ConfigureAwait(false);
        try
        {
            _disposed = true;
            _ = _stopping.TrySetResult();
            foreach (var deviceId in _waiters.Keys)
            {
                Wake(deviceId);
            }
        }
        finally { _ = _gate.Release(); }
        await drained.ConfigureAwait(false);
        try
        {
            try
            {
                await _sink.DisposeAsync().ConfigureAwait(false);
            }
            finally { await _store.DisposeAsync().ConfigureAwait(false); }
        }
        finally { _gate.Dispose(); }
    }
}
