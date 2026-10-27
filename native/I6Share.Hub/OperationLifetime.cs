namespace I6Share.Hub;

/// <summary>Rejects new work during shutdown and waits for admitted operations to leave.</summary>
internal sealed class OperationLifetime
{
    private readonly Lock gate = new();
    private readonly TaskCompletionSource drained = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private int active;
    private bool closing;

    public bool TryEnter()
    {
        lock (gate)
        {
            if (closing)
            {
                return false;
            }
            active++;
            return true;
        }
    }

    public void Exit()
    {
        lock (gate)
        {
            active--;
            if (closing && active == 0)
            {
                _ = drained.TrySetResult();
            }
        }
    }

    public Task Close()
    {
        lock (gate)
        {
            closing = true;
            if (active == 0)
            {
                _ = drained.TrySetResult();
            }
            return drained.Task;
        }
    }
}
