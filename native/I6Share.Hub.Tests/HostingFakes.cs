using System.Net.WebSockets;
using System.Text;
using I6Share.Contracts;
using I6Share.Hub.Core;
using I6Share.Hub.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;

namespace I6Share.Hub.Tests;

internal sealed class HostingFakeBackend : IHubBackend, IDisposable
{
    public Exception? Failure
    {
        get; set;
    }
    public byte[] Body { get; private set; } = [];
    public IReadOnlyDictionary<string, string> Query { get; private set; } = new Dictionary<string, string>();
    public string Remote { get; private set; } = "";
    public (string?, string?) Settings
    {
        get; private set;
    }
    public IReadOnlyList<string> Files { get; private set; } = [];
    public string Revoked { get; private set; } = "";
    public string Cancelled { get; private set; } = "";
    public int Sweeps
    {
        get; private set;
    }
    public bool Disposed
    {
        get; private set;
    }
    public Task<HubReply> HandleAsync(string method, string path, IReadOnlyDictionary<string, string> query, ReadOnlyMemory<byte> body, string remoteAddress, CancellationToken cancellationToken)
    {
        Body = body.ToArray();
        Query = query;
        Remote = remoteAddress;
        return Task.FromResult(new HubReply(200, "application/octet-stream", Encoding.UTF8.GetBytes("reply")));
    }
    public Task<AdminStatusResponse> GetStatusAsync(CancellationToken cancellationToken)
    {
        return Failure is null ? Task.FromResult(new AdminStatusResponse { HubId = "hub", Name = "PC", ReceiveDirectory = "/receive", Port = 47616, Addrs = [], Devices = [], Transfers = [], Outbox = [], History = [] }) : Task.FromException<AdminStatusResponse>(Failure);
    }

    public Task<PairCodeResponse> NewPairCodeAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult(new PairCodeResponse { Payload = "code", Link = "https://example.test/#pair=code", ExpiresAt = 123 });
    }

    public Task SetSettingsAsync(string? name, string? receiveDirectory, CancellationToken cancellationToken)
    {
        Settings = (name, receiveDirectory);
        return Task.CompletedTask;
    }
    public Task<bool> RevokeAsync(string deviceId, CancellationToken cancellationToken)
    {
        Revoked = deviceId;
        return Task.FromResult(true);
    }
    public Task<string> QueueFilesAsync(string deviceId, IReadOnlyList<string> paths, CancellationToken cancellationToken)
    {
        Files = paths;
        return Task.FromResult("transfer");
    }
    public Task<bool> CancelOutboxAsync(string tid, CancellationToken cancellationToken)
    {
        Cancelled = tid;
        return Task.FromResult(true);
    }
    public Task SweepAsync(CancellationToken cancellationToken)
    {
        Sweeps++;
        return Task.CompletedTask;
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
}

internal sealed class HostingWebSocketFeature : IHttpWebSocketFeature
{
    public bool IsWebSocketRequest => true;
    public bool Fail
    {
        get; init;
    }
    public Task<WebSocket> AcceptAsync(WebSocketAcceptContext context)
    {
        return Task.FromResult<WebSocket>(new HostingWebSocket(Fail));
    }
}

internal sealed class HostingWebSocket(bool fail) : WebSocket
{
    private int _received;
    public override WebSocketCloseStatus? CloseStatus => WebSocketCloseStatus.NormalClosure;
    public override string? CloseStatusDescription => null;
    public override WebSocketState State => WebSocketState.Open;
    public override string? SubProtocol => "i6-share-dashboard";
    public override void Abort()
    {
    }
    public override void Dispose()
    {
    }
    public override Task CloseAsync(WebSocketCloseStatus closeStatus, string? statusDescription, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }

    public override Task CloseOutputAsync(WebSocketCloseStatus closeStatus, string? statusDescription, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }

    public override Task<WebSocketReceiveResult> ReceiveAsync(ArraySegment<byte> buffer, CancellationToken cancellationToken)
    {
        return fail ? Task.FromException<WebSocketReceiveResult>(new WebSocketException()) : Task.FromResult(new WebSocketReceiveResult(0, _received++ == 0 ? WebSocketMessageType.Text : WebSocketMessageType.Close, true));
    }

    public override Task SendAsync(ArraySegment<byte> buffer, WebSocketMessageType messageType, bool endOfMessage, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}
