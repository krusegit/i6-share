using I6Share.Contracts;
using I6Share.Hub.Core;

namespace I6Share.Hub.Hosting;

internal interface IHubBackend : IAsyncDisposable
{
    Task<HubReply> HandleAsync(string method, string path, IReadOnlyDictionary<string, string> query, ReadOnlyMemory<byte> body, string remoteAddress, CancellationToken cancellationToken);
    Task<AdminStatusResponse> GetStatusAsync(CancellationToken cancellationToken);
    Task<PairCodeResponse> NewPairCodeAsync(CancellationToken cancellationToken);
    Task SetSettingsAsync(string? name, string? receiveDirectory, CancellationToken cancellationToken);
    Task<bool> RevokeAsync(string deviceId, CancellationToken cancellationToken);
    Task<string> QueueFilesAsync(string deviceId, IReadOnlyList<string> paths, CancellationToken cancellationToken);
    Task<bool> CancelOutboxAsync(string tid, CancellationToken cancellationToken);
    Task SweepAsync(CancellationToken cancellationToken);
}

internal sealed class HubBackend(HubService service) : IHubBackend
{
    public Task<HubReply> HandleAsync(string method, string path, IReadOnlyDictionary<string, string> query, ReadOnlyMemory<byte> body, string remoteAddress, CancellationToken cancellationToken)
    {
        return service.HandleAsync(method, path, query, body, remoteAddress, cancellationToken);
    }

    public Task<AdminStatusResponse> GetStatusAsync(CancellationToken cancellationToken)
    {
        return service.GetStatusAsync(cancellationToken);
    }

    public Task<PairCodeResponse> NewPairCodeAsync(CancellationToken cancellationToken)
    {
        return service.NewPairCodeAsync(cancellationToken);
    }

    public Task SetSettingsAsync(string? name, string? receiveDirectory, CancellationToken cancellationToken)
    {
        return service.SetSettingsAsync(name, receiveDirectory, cancellationToken);
    }

    public Task<bool> RevokeAsync(string deviceId, CancellationToken cancellationToken)
    {
        return service.RevokeAsync(deviceId, cancellationToken);
    }

    public Task<string> QueueFilesAsync(string deviceId, IReadOnlyList<string> paths, CancellationToken cancellationToken)
    {
        return service.QueueFilesAsync(deviceId, paths, cancellationToken);
    }

    public Task<bool> CancelOutboxAsync(string tid, CancellationToken cancellationToken)
    {
        return service.CancelOutboxAsync(tid, cancellationToken);
    }

    public Task SweepAsync(CancellationToken cancellationToken)
    {
        return service.SweepAsync(cancellationToken);
    }

    public ValueTask DisposeAsync()
    {
        return service.DisposeAsync();
    }
}
