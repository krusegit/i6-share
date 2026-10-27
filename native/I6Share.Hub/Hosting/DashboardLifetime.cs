namespace I6Share.Hub.Hosting;

/// <summary>
/// Keeps the native process alive while a local dashboard is connected. A short
/// reconnect grace permits navigation and reloads without turning the hub into a service.
/// </summary>
internal sealed class DashboardLifetime : IDisposable
{
    private sealed record State(int Connections, long Generation, bool StopRequested, bool Disposed);
    private readonly Lock _gate = new();
    private readonly TimeProvider _timeProvider;
    private readonly TimeSpan _reloadGrace;
    private readonly Action _stop;
    private State _state = new(0, 0, false, false);
    private ITimer? _timer;

    public DashboardLifetime(TimeProvider timeProvider, TimeSpan startupGrace, TimeSpan reloadGrace, Action stop)
    {
        ArgumentNullException.ThrowIfNull(timeProvider);
        ArgumentNullException.ThrowIfNull(stop);
        ValidateGrace(startupGrace, nameof(startupGrace));
        ValidateGrace(reloadGrace, nameof(reloadGrace));
        _timeProvider = timeProvider;
        _reloadGrace = reloadGrace;
        _stop = stop;
        lock (_gate)
        {
            ScheduleStop(startupGrace);
        }
    }

    /// <summary>Each live dashboard connection owns one independently disposable lease.</summary>
    public IDisposable Connect()
    {
        lock (_gate)
        {
            ObjectDisposedException.ThrowIf(_state.Disposed || _state.StopRequested, this);
            _state = _state with
            {
                Connections = _state.Connections + 1,
                Generation = _state.Generation + 1
            };
            CancelTimer();
            return new ConnectionLease(Disconnect);
        }
    }

    public void Dispose()
    {
        lock (_gate)
        {
            if (_state.Disposed)
            {
                return;
            }

            _state = _state with
            {
                Disposed = true,
                Generation = _state.Generation + 1
            };
            CancelTimer();
        }
    }

    private static void ValidateGrace(TimeSpan grace, string parameter)
    {
        if (grace < TimeSpan.Zero || grace.TotalMilliseconds > uint.MaxValue - 1)
        {
            throw new ArgumentOutOfRangeException(parameter, "Grace must be a non-negative, finite timer duration.");
        }
    }

    private void Disconnect()
    {
        lock (_gate)
        {
            if (_state.Disposed)
            {
                return;
            }

            _state = _state with
            {
                Connections = _state.Connections - 1
            };
            if (_state.Connections == 0)
            {
                ScheduleStop(_reloadGrace);
            }
        }
    }

    private void ScheduleStop(TimeSpan grace)
    {
        _state = _state with
        {
            Generation = _state.Generation + 1
        };
        var generation = _state.Generation;
        // Publish the timer before arming it, including when a provider fires a zero delay synchronously.
        _timer = _timeProvider.CreateTimer(_ => OnDeadline(generation), null, Timeout.InfiniteTimeSpan, Timeout.InfiniteTimeSpan);
        _ = _timer.Change(grace, Timeout.InfiniteTimeSpan);
    }

    private void OnDeadline(long generation)
    {
        lock (_gate)
        {
            if (_state.Disposed || _state.StopRequested || _state.Connections != 0 || _state.Generation != generation)
            {
                return;
            }

            _state = _state with
            {
                StopRequested = true
            };
            CancelTimer();
        }
        // StopApplication may synchronously invoke shutdown handlers; never call it under our lock.
        _stop();
    }

    private void CancelTimer()
    {
        _timer?.Dispose();
        _timer = null;
    }

    private sealed class ConnectionLease(Action release) : IDisposable
    {
        private Action? _release = release;
        public void Dispose()
        {
            Interlocked.Exchange(ref _release, null)?.Invoke();
        }
    }
}
