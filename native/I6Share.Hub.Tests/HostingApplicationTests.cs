using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using I6Share.Hub.Core;
using I6Share.Hub.Hosting;
using I6Share.Hub.Protocol;

namespace I6Share.Hub.Tests;

public sealed class HostingApplicationTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "i6-app-" + Guid.NewGuid().ToString("N"));
    public HostingApplicationTests()
    {
        _ = Directory.CreateDirectory(_root);
    }

    public void Dispose()
    {
        Directory.Delete(_root, true);
    }

    private HubHostOptions Options => new() { Host = "127.0.0.1", Port = 0, DataDirectory = Path.Combine(_root, "data"), ReceiveDirectory = Path.Combine(_root, "receive"), WebRoot = _root };

    [Fact]
    public async Task StartsKestrelWithActualEphemeralPortAndWebSocketLifetime()
    {
        var backend = new HostingFakeBackend();
        await using var backendLifetime = backend.ConfigureAwait(true);
        var hub = await HubApplication.StartAsync(Options with
        {
            Name = "Test PC"
        }, (settings, _) =>
        {
            Assert.NotEqual(0, settings.Port);
            Assert.Equal("Test PC", settings.Name);
            Assert.Equal("127.0.0.1", Assert.Single(settings.Addresses()));
            return Task.FromResult<IHubBackend>(backend);
        }, default);
        await using (hub.ConfigureAwait(true))
        {
            using var client = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{hub.Port}") };
            var protocol = await client.GetAsync(new Uri("/i6/hello", UriKind.Relative));
            Assert.Equal("reply", await protocol.Content.ReadAsStringAsync());
            client.DefaultRequestHeaders.Authorization = new("Bearer", hub.AdminToken);
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(new Uri("/admin/state", UriKind.Relative))).StatusCode);
            var ready = HubApplication.ReadyLine(hub);
            Assert.StartsWith("I6_SHARE_READY {\"port\":", ready, StringComparison.Ordinal);
            Assert.Contains(hub.AdminUrl, ready, StringComparison.Ordinal);
            using var socket = new ClientWebSocket();
            socket.Options.AddSubProtocol("i6-share-dashboard");
            socket.Options.AddSubProtocol(hub.AdminToken);
            await socket.ConnectAsync(new Uri($"ws://127.0.0.1:{hub.Port}/admin/lifetime"), default);
            Assert.Equal("i6-share-dashboard", socket.SubProtocol);
            await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "done", default);
        }
        Assert.True(backend.Disposed);
    }

    [Fact]
    public async Task RollsBackListenerOnBackendInitializationFailure()
    {
        _ = await Assert.ThrowsAsync<IOException>(() => HubApplication.StartAsync(Options, (_, _) => Task.FromException<IHubBackend>(new IOException("storage failed")), default));
    }

    [Fact]
    public async Task ShutdownCancelsActiveLongPollStalledBodyAndDashboardSocket()
    {
        var hub = await HubApplication.StartAsync(Options, async (settings, token) => new HubBackend(await HubService.CreateAsync(settings, token).ConfigureAwait(true)), default);
        using var client = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{hub.Port}") };
        var code = await hub.Backend.NewPairCodeAsync(default);
        var payload = PairingPayload.Decode(code.Payload);
        const string device = "0102030405060708";
        var pairKey = WireCrypto.PairKey(payload.Token, payload.HubId);
        var request = WireCrypto.Seal(pairKey, WireCrypto.RequestAad("pair", "pair"), Encoding.UTF8.GetBytes($"{{\"deviceId\":\"{device}\",\"name\":\"Phone\",\"os\":\"Android\"}}"));
        using var pairBody = new ByteArrayContent(request.Body);
        using var paired = await client.PostAsync(new Uri("/i6/pair?h=" + payload.HubId, UriKind.Relative), pairBody);
        _ = paired.EnsureSuccessStatusCode();
        var pairedBody = await paired.Content.ReadAsByteArrayAsync();
        var secret = WireCrypto.Open(pairKey, WireCrypto.ResponseAad("pair", request.Iv), pairedBody).Json.GetProperty("secret").GetString();
        Assert.NotNull(secret);
        var key = WireCrypto.DeviceKey(WireCrypto.FromBase64Url(secret), device);
        var sync = WireCrypto.Seal(key, WireCrypto.RequestAad("sync", device), /*lang=json,strict*/ "{\"wait\":25000}"u8);
        var pending = PollAsync();
        async Task PollAsync()
        {
            using var syncBody = new ByteArrayContent(sync.Body);
            using var response = await client.PostAsync(new Uri("/i6/sync?d=" + device, UriKind.Relative), syncBody).ConfigureAwait(true);
        }
        using var stalled = new TcpClient();
        await stalled.ConnectAsync(IPAddress.Loopback, hub.Port);
        await stalled.GetStream().WriteAsync(Encoding.ASCII.GetBytes($"POST /i6/put HTTP/1.1\r\nHost: 127.0.0.1:{hub.Port}\r\nContent-Length: 1024\r\n\r\nx"));
        using var socket = new ClientWebSocket();
        socket.Options.AddSubProtocol("i6-share-dashboard");
        socket.Options.AddSubProtocol(hub.AdminToken);
        await socket.ConnectAsync(new Uri($"ws://127.0.0.1:{hub.Port}/admin/lifetime"), default);
        await Task.Delay(50);
        await hub.DisposeAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(2));
        try
        {
            await pending.ConfigureAwait(true);
        }
        catch (HttpRequestException) { }
        using var probe = new TcpClient();
        _ = await Assert.ThrowsAsync<SocketException>(() => probe.ConnectAsync(IPAddress.Loopback, hub.Port));
    }

    [Fact]
    public async Task AdaptsNativeServiceAndEnumeratesActualNetworkInterfaces()
    {
        var service = await HubService.CreateAsync(new HubServiceOptions { DataDirectory = Path.Combine(_root, "data"), ReceiveDirectory = Path.Combine(_root, "receive") });
        await using var serviceLifetime = service.ConfigureAwait(true);
        var backend = new HubBackend(service);
        await using var backendLifetime = backend.ConfigureAwait(true);
        Assert.Equal(200, (await backend.HandleAsync("GET", "/i6/hello", new Dictionary<string, string>(), ReadOnlyMemory<byte>.Empty, "127.0.0.1", default)).Status);
        Assert.NotEmpty((await backend.GetStatusAsync(default)).HubId);
        Assert.Contains("#pair=", (await backend.NewPairCodeAsync(default)).Link, StringComparison.Ordinal);
        await backend.SetSettingsAsync("Renamed", null, default);
        Assert.False(await backend.RevokeAsync("unknown", default));
        Assert.False(await backend.CancelOutboxAsync("unknown", default));
        _ = await Assert.ThrowsAsync<HubOperationException>(() => backend.QueueFilesAsync("unknown", ["/missing"], default));
        await backend.SweepAsync(default);
        var hub = await HubApplication.StartAsync(Options with
        {
            Host = "0.0.0.0"
        }, (settings, _) =>
        {
            Assert.All(settings.Addresses(), value => Assert.True(HubApplication.IsLanAddress(IPAddress.Parse(value))));
            return Task.FromResult<IHubBackend>(new HostingFakeBackend());
        }, default);
        await using var hubLifetime = hub.ConfigureAwait(true);
    }

    [Fact]
    public async Task RunsPeriodicSweepAndCancelsCleanly()
    {
        var backend = new HostingFakeBackend();
        await using var backendLifetime = backend.ConfigureAwait(true);
        using var stop = new CancellationTokenSource();
        var task = HubApplication.SweepLoopAsync(backend, TimeSpan.FromMilliseconds(1), stop.Token);
        while (backend.Sweeps == 0)
        {
            await Task.Delay(1);
        }

        await stop.CancelAsync();
        await task.ConfigureAwait(true);
        Assert.True(backend.Sweeps > 0);
    }

    [Theory]
    [InlineData("10.0.0.1", true)]
    [InlineData("172.16.0.1", true)]
    [InlineData("172.31.0.1", true)]
    [InlineData("172.15.0.1", false)]
    [InlineData("172.32.0.1", false)]
    [InlineData("192.168.0.1", true)]
    [InlineData("192.169.0.1", false)]
    [InlineData("8.8.8.8", false)]
    [InlineData("127.0.0.1", false)]
    [InlineData("fd00::1", true)]
    [InlineData("fc00::1", true)]
    [InlineData("fe80::1", false)]
    [InlineData("::1", false)]
    public void AdvertisesOnlyReachablePrivateAddresses(string address, bool expected)
    {
        Assert.Equal(expected, HubApplication.IsLanAddress(IPAddress.Parse(address)));
    }

    [Fact]
    public void DeduplicatesAdvertisedAddressesAndRespectsExplicitBinding()
    {
        var addresses = new[] { IPAddress.Parse("10.0.0.2"), IPAddress.Parse("10.0.0.2"), IPAddress.Parse("192.168.1.1"), IPAddress.Parse("8.8.8.8") };
        Assert.Equal(["10.0.0.2", "192.168.1.1"], HubApplication.AdvertisedAddresses("0.0.0.0", addresses));
        Assert.Equal(["10.0.0.2", "192.168.1.1"], HubApplication.AdvertisedAddresses("::", addresses));
        Assert.Equal(["127.0.0.1"], HubApplication.AdvertisedAddresses("127.0.0.1", addresses));
        Assert.Empty(HubApplication.AdvertisedAddresses("0.0.0.0", [IPAddress.Parse("fd00::1")]));
    }

    [Fact]
    public async Task CliShowsHelpAndErrorsWithoutStartingAListener()
    {
        using var output = new StringWriter();
        using var error = new StringWriter();
        Assert.Equal(0, await HubApplication.RunAsync(["--help"], output, error));
        Assert.Contains("--receive-dir", output.ToString(), StringComparison.Ordinal);
        Assert.Equal(1, await HubApplication.RunAsync(["--port", "wrong"], output, error));
        Assert.Contains("--port", error.ToString(), StringComparison.Ordinal);
        Assert.Equal(0, await Program.Main(["--help"]));
        var info = HubApplication.BrowserStartInfo("http://127.0.0.1:47616/#admin=token");
        Assert.True(info.UseShellExecute);
        Assert.Equal("http://127.0.0.1:47616/#admin=token", info.FileName);
        HubApplication.LaunchBrowser("/usr/bin/true");
        HubApplication.LaunchBrowser("http://localhost", _ => null);
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(true, true)]
    public async Task CliRunsNativeBackendAndHandlesBrowserLaunchFailure(bool open, bool fail)
    {
        using var stop = new CancellationTokenSource();
        using var output = new HostingReadyWriter(stop);
        using var error = new StringWriter();
        var args = new[] { "--host", "127.0.0.1", "--port", "0", "--data-dir", Path.Combine(_root, "data"), "--receive-dir", Path.Combine(_root, "receive") }.Concat(open ? ["--open"] : Array.Empty<string>()).ToArray();
        var opened = new List<string>();
        Action<string>? launch = open ? url => { opened.Add(url); if (fail) { throw new System.ComponentModel.Win32Exception("no browser"); } }
        : null;
        Assert.Equal(0, await HubApplication.RunAsync(args, output, error, launch, stop.Token));
        Assert.Contains("I6_SHARE_READY", output.ToString(), StringComparison.Ordinal);
        Assert.Equal(open ? 1 : 0, opened.Count);
        Assert.Equal(fail, error.ToString().Contains("no browser", StringComparison.Ordinal));
    }
}

internal sealed class HostingReadyWriter(CancellationTokenSource stop) : StringWriter
{
    public override async Task WriteLineAsync(string? value)
    {
        await base.WriteLineAsync(value).ConfigureAwait(true);
        if (value?.StartsWith("I6_SHARE_READY", StringComparison.Ordinal) == true)
        {
            await stop.CancelAsync().ConfigureAwait(true);
        }
    }
}
