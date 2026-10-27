namespace I6Share.Hub.Tests;

public sealed class OperationLifetimeTests
{
    [Fact]
    public async Task ClosingAnIdleLifetimeImmediatelyRejectsFurtherAdmissions()
    {
        var lifetime = new OperationLifetime();
        var drained = lifetime.Close();
        Assert.True(drained.IsCompletedSuccessfully);
        Assert.False(lifetime.TryEnter());
        Assert.Same(drained, lifetime.Close());
        await drained.ConfigureAwait(true);
    }

    [Fact]
    public async Task ClosingWaitsForEveryAdmittedOperationIncludingThoseBetweenLocks()
    {
        var lifetime = new OperationLifetime();
        Assert.True(lifetime.TryEnter());
        Assert.True(lifetime.TryEnter());
        Assert.True(lifetime.TryEnter());
        lifetime.Exit();
        var drained = lifetime.Close();
        Assert.False(drained.IsCompleted);
        Assert.False(lifetime.TryEnter());
        lifetime.Exit();
        Assert.False(drained.IsCompleted);
        Assert.Same(drained, lifetime.Close());
        lifetime.Exit();
        await drained.ConfigureAwait(true);
        Assert.True(drained.IsCompletedSuccessfully);
    }
}
