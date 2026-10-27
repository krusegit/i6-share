namespace I6Share.Hub.Storage;

internal sealed class PendingFile(string name, string path, string temporary, Action<IPendingFile> released) : IPendingFile
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly OperationLifetime lifetime = new();
    private readonly Lock disposeLock = new();
    private Task? disposeTask;
    private readonly FileStream stream = new(temporary, StoragePaths.PrivateFileOptions(FileMode.CreateNew, FileAccess.Write));
    private bool closed;
    private bool finished;

    public string Name { get; } = name;
    public string FilePath { get; } = path;

    public async Task WriteAsync(ReadOnlyMemory<byte> bytes, CancellationToken cancellationToken = default)
    {
        if (!await EnterAsync(cancellationToken).ConfigureAwait(false))
        {
            throw new IOException("The incoming file is no longer writable.");
        }
        try
        {
            if (closed)
            {
                throw new IOException("The incoming file is no longer writable.");
            }

            await stream.WriteAsync(bytes, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            _ = gate.Release();
            lifetime.Exit();
        }
    }

    public async Task CompleteAsync(CancellationToken cancellationToken = default)
    {
        if (!await EnterAsync(cancellationToken).ConfigureAwait(false))
        {
            return;
        }
        try
        {
            if (finished)
            {
                return;
            }

            if (!closed)
            {
                await stream.FlushAsync(cancellationToken).ConfigureAwait(false);
                StoragePaths.FlushToDisk(stream);
                await stream.DisposeAsync().ConfigureAwait(false);
                closed = true;
            }
            cancellationToken.ThrowIfCancellationRequested();
            File.Move(temporary, FilePath, overwrite: false);
            finished = true;
            released(this);
        }
        finally
        {
            _ = gate.Release();
            lifetime.Exit();
        }
    }

    public async Task AbortAsync()
    {
        if (!await EnterAsync(CancellationToken.None).ConfigureAwait(false))
        {
            return;
        }
        try
        {
            await AbortCoreAsync().ConfigureAwait(false);
        }
        finally
        {
            _ = gate.Release();
            lifetime.Exit();
        }
    }

    private async Task AbortCoreAsync()
    {
        if (finished)
        {
            return;
        }
        await stream.DisposeAsync().ConfigureAwait(false);
        closed = true;
        File.Delete(temporary);
        finished = true;
        released(this);
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
        await lifetime.Close().ConfigureAwait(false);
        try
        {
            await AbortCoreAsync().ConfigureAwait(false);
        }
        finally { gate.Dispose(); }
    }

    private async Task<bool> EnterAsync(CancellationToken cancellationToken)
    {
        if (!lifetime.TryEnter())
        {
            return false;
        }
        try
        {
            await gate.WaitAsync(cancellationToken).ConfigureAwait(false);
            return true;
        }
        catch
        {
            lifetime.Exit();
            throw;
        }
    }
}
