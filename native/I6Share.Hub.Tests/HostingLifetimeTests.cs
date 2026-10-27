using I6Share.Hub.Hosting;

namespace I6Share.Hub.Tests;

public sealed class HostingLifetimeTests
{
    private sealed class ImmediateTimeProvider : TimeProvider
    {
        public override ITimer CreateTimer(TimerCallback callback, object? state, TimeSpan dueTime, TimeSpan period)
        {
            return new ImmediateTimer(callback, state);
        }
    }
    private sealed class ImmediateTimer(TimerCallback callback, object? state) : ITimer
    {
        public bool Change(TimeSpan dueTime, TimeSpan period)
        {
            callback(state);
            return true;
        }
        public void Dispose()
        {
        }
        public ValueTask DisposeAsync()
        {
            return ValueTask.CompletedTask;
        }
    }
    private sealed class ManualTimeProvider : TimeProvider
    {
        public List<ManualTimer> Timers { get; } = [];
        public TimeSpan Elapsed
        {
            get; private set;
        }
        public override ITimer CreateTimer(TimerCallback callback, object? state, TimeSpan dueTime, TimeSpan period)
        {
            var timer = new ManualTimer(this, callback, state);
            _ = timer.Change(dueTime, period);
            Timers.Add(timer);
            return timer;
        }
        public void Advance(TimeSpan elapsed)
        {
            Elapsed += elapsed;
            foreach (var timer in Timers.ToArray())
            {
                timer.FireIfDue();
            }
        }
    }

    private sealed class ManualTimer(ManualTimeProvider clock, TimerCallback callback, object? state) : ITimer
    {
        private TimeSpan? _deadline;
        public bool Disposed
        {
            get; private set;
        }
        public bool Change(TimeSpan dueTime, TimeSpan period)
        {
            Assert.Equal(Timeout.InfiniteTimeSpan, period);
            _deadline = dueTime == Timeout.InfiniteTimeSpan ? null : clock.Elapsed + dueTime;
            return !Disposed;
        }
        public void Dispose()
        {
            Disposed = true;
        }

        public ValueTask DisposeAsync()
        {
            Dispose();
            return ValueTask.CompletedTask;
        }
        public void FireIfDue()
        {
            if (!Disposed && _deadline is { } deadline && deadline <= clock.Elapsed)
            {
                _deadline = null;
                callback(state);
            }
        }
        public void FireQueuedCallback()
        {
            callback(state);
        }
    }

    [Fact]
    public void StopsIfNoDashboardOpensBeforeStartupDeadline()
    {
        var clock = new ManualTimeProvider();
        var stopped = 0;
        using var lifetime = new DashboardLifetime(clock, TimeSpan.FromSeconds(30), TimeSpan.FromSeconds(5), () => stopped++);
        clock.Advance(TimeSpan.FromSeconds(29));
        Assert.Equal(0, stopped);
        clock.Advance(TimeSpan.FromSeconds(1));
        Assert.Equal(1, stopped);
        Assert.True(clock.Timers[0].Disposed);
        clock.Timers[0].FireQueuedCallback();
        Assert.Equal(1, stopped);
        _ = Assert.Throws<ObjectDisposedException>(lifetime.Connect);
    }

    [Fact]
    public void KeepsHubAliveUntilTheFinalWindowDisconnectsAndGraceElapses()
    {
        var clock = new ManualTimeProvider();
        var stopped = 0;
        using var lifetime = new DashboardLifetime(clock, TimeSpan.FromSeconds(30), TimeSpan.FromSeconds(5), () => stopped++);
        var first = lifetime.Connect();
        var second = lifetime.Connect();
        Assert.True(clock.Timers[0].Disposed);
        clock.Advance(TimeSpan.FromHours(1));
        clock.Timers[0].FireQueuedCallback();
        Assert.Equal(0, stopped);
        first.Dispose();
        first.Dispose();
        clock.Advance(TimeSpan.FromHours(1));
        Assert.Equal(0, stopped);
        second.Dispose();
        Assert.Equal(2, clock.Timers.Count);
        clock.Advance(TimeSpan.FromSeconds(4));
        Assert.Equal(0, stopped);
        clock.Advance(TimeSpan.FromSeconds(1));
        Assert.Equal(1, stopped);
        second.Dispose();
    }

    [Fact]
    public void ReloadReconnectCancelsOldDeadlineAndStartsFreshGraceAfterDisconnect()
    {
        var clock = new ManualTimeProvider();
        var stopped = 0;
        using var lifetime = new DashboardLifetime(clock, TimeSpan.FromSeconds(30), TimeSpan.FromSeconds(5), () => stopped++);
        lifetime.Connect().Dispose();
        clock.Advance(TimeSpan.FromSeconds(4));
        var reloaded = lifetime.Connect();
        Assert.True(clock.Timers[1].Disposed);
        clock.Timers[1].FireQueuedCallback();
        clock.Advance(TimeSpan.FromSeconds(2));
        Assert.Equal(0, stopped);
        reloaded.Dispose();
        clock.Timers[1].FireQueuedCallback();
        clock.Advance(TimeSpan.FromSeconds(4));
        Assert.Equal(0, stopped);
        clock.Advance(TimeSpan.FromSeconds(1));
        Assert.Equal(1, stopped);
    }

    [Fact]
    public void DisposeCancelsAllFutureShutdownWorkAndExistingLeasesAreHarmless()
    {
        var clock = new ManualTimeProvider();
        var stopped = 0;
        var lifetime = new DashboardLifetime(clock, TimeSpan.FromSeconds(30), TimeSpan.FromSeconds(5), () => stopped++);
        var lease = lifetime.Connect();
        lifetime.Dispose();
        lifetime.Dispose();
        lease.Dispose();
        lease.Dispose();
        clock.Timers[0].FireQueuedCallback();
        clock.Advance(TimeSpan.FromHours(1));
        Assert.Equal(0, stopped);
        _ = Assert.Throws<ObjectDisposedException>(lifetime.Connect);
        _ = Assert.Single(clock.Timers);
    }

    [Fact]
    public void DisposingBeforeStartupAndFromStopCallbackDoesNotDeadlock()
    {
        var clock = new ManualTimeProvider();
        var stopped = 0;
        var canceled = new DashboardLifetime(clock, TimeSpan.Zero, TimeSpan.Zero, () => stopped++);
        canceled.Dispose();
        clock.Advance(TimeSpan.Zero);
        Assert.Equal(0, stopped);
        DashboardLifetime? lifetime = null;
        lifetime = new DashboardLifetime(clock, TimeSpan.Zero, TimeSpan.Zero, () => { stopped++; lifetime?.Dispose(); });
        clock.Advance(TimeSpan.Zero);
        Assert.Equal(1, stopped);
        lifetime.Dispose();
    }

    [Fact]
    public void SupportsProvidersThatInvokeZeroDelaySynchronously()
    {
        var stopped = 0;
        using var lifetime = new DashboardLifetime(new ImmediateTimeProvider(), TimeSpan.Zero, TimeSpan.Zero, () => stopped++);
        Assert.Equal(1, stopped);
        _ = Assert.Throws<ObjectDisposedException>(lifetime.Connect);
    }

    [Fact]
    public async Task ConcurrentLeaseDisposalSchedulesExactlyOneFinalDeadline()
    {
        var clock = new ManualTimeProvider();
        var stopped = 0;
        using var lifetime = new DashboardLifetime(clock, TimeSpan.FromSeconds(30), TimeSpan.FromSeconds(5), () => Interlocked.Increment(ref stopped));
        var leases = Enumerable.Range(0, 100).Select(_ => lifetime.Connect()).ToArray();
        await Task.WhenAll(leases.SelectMany(lease => new[] { Task.Run(lease.Dispose), Task.Run(lease.Dispose) }));
        Assert.Equal(2, clock.Timers.Count);
        clock.Advance(TimeSpan.FromSeconds(5));
        Assert.Equal(1, stopped);
    }

    [Fact]
    public void RejectsInvalidDependenciesAndTimerDurations()
    {
        var clock = new ManualTimeProvider();
        _ = Assert.Throws<ArgumentNullException>(() => new DashboardLifetime(null!, TimeSpan.Zero, TimeSpan.Zero, () => { }));
        _ = Assert.Throws<ArgumentNullException>(() => new DashboardLifetime(clock, TimeSpan.Zero, TimeSpan.Zero, null!));
        _ = Assert.Throws<ArgumentOutOfRangeException>(() => new DashboardLifetime(clock, TimeSpan.FromMilliseconds(-1), TimeSpan.Zero, () => { }));
        _ = Assert.Throws<ArgumentOutOfRangeException>(() => new DashboardLifetime(clock, TimeSpan.Zero, TimeSpan.FromMilliseconds(-1), () => { }));
        _ = Assert.Throws<ArgumentOutOfRangeException>(() => new DashboardLifetime(clock, TimeSpan.FromMilliseconds(uint.MaxValue), TimeSpan.Zero, () => { }));
        _ = Assert.Throws<ArgumentOutOfRangeException>(() => new DashboardLifetime(clock, TimeSpan.Zero, TimeSpan.FromMilliseconds(uint.MaxValue), () => { }));
    }
}
