using System.Diagnostics;
using System.Net;
using System.Net.NetworkInformation;
using System.Text.Json;
using System.Text.Json.Serialization;
using I6Share.Hub.Core;

namespace I6Share.Hub.Hosting;

internal sealed record ReadyMessage(int Port, string AdminUrl);
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(ReadyMessage))]
internal partial class HostJsonContext : JsonSerializerContext;

internal sealed class RunningHub(WebApplication application, IHubBackend backend, DashboardLifetime lifetime, int port, string adminToken, string adminUrl) : IAsyncDisposable
{
    public WebApplication Application { get; } = application;
    public IHubBackend Backend { get; } = backend;
    public int Port { get; } = port;
    public string AdminToken { get; } = adminToken;
    public string AdminUrl { get; } = adminUrl;
    public async ValueTask DisposeAsync()
    {
        lifetime.Dispose();
        Application.Lifetime.StopApplication();
        try
        {
            await Backend.DisposeAsync().ConfigureAwait(false);
        }
        finally
        {
            try
            {
                await Application.StopAsync().ConfigureAwait(false);
            }
            finally { await Application.DisposeAsync().ConfigureAwait(false); }
        }
    }
}

internal static class HubApplication
{
    public static async Task<RunningHub> StartAsync(HubHostOptions options, Func<HubServiceOptions, CancellationToken, Task<IHubBackend>> factory, CancellationToken cancellationToken)
    {
        var builder = WebApplication.CreateSlimBuilder(new WebApplicationOptions { Args = [] });
        _ = builder.WebHost.UseUrls(options.ListenUrl);
        _ = builder.WebHost.ConfigureKestrel(server => server.Limits.MaxRequestBodySize = null);
        var application = builder.Build();
        _ = application.UseWebSockets();
        var ready = new TaskCompletionSource<HostDispatcher>(TaskCreationOptions.RunContinuationsAsynchronously);
        application.Run(async context =>
        {
            using var requestLifetime = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted, application.Lifetime.ApplicationStopping);
            context.RequestAborted = requestLifetime.Token;
            await (await ready.Task.WaitAsync(context.RequestAborted).ConfigureAwait(false)).HandleAsync(context).ConfigureAwait(false);
        });
        try
        {
            await application.StartAsync(cancellationToken).ConfigureAwait(false);
            var port = new Uri(application.Urls.Single()).Port;
            var backend = await factory(new HubServiceOptions
            {
                DataDirectory = options.DataDirectory,
                ReceiveDirectory = options.ReceiveDirectory,
                Name = options.Name ?? "Linux PC",
                Port = port,
                Addresses = () => AdvertisedAddresses(options.Host, EnumerateAddresses()),
            }, cancellationToken).ConfigureAwait(false);
            var token = AdminSecurity.NewToken();
            var lifetime = new DashboardLifetime(TimeProvider.System, TimeSpan.FromSeconds(60), TimeSpan.FromSeconds(2), application.Lifetime.StopApplication);
            ready.SetResult(new HostDispatcher(backend, token, options.WebRoot, lifetime));
            return new RunningHub(application, backend, lifetime, port, token, options.DashboardUrl(port, token));
        }
        catch (Exception error)
        {
            _ = ready.TrySetException(error);
            await application.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    public static IReadOnlyList<string> AdvertisedAddresses(string host, IEnumerable<IPAddress> addresses)
    {
        var bound = IPAddress.Parse(host);
        return !bound.Equals(IPAddress.Any) && !bound.Equals(IPAddress.IPv6Any)
            ? [bound.ToString()]
            : [.. addresses.Where(address => !bound.Equals(IPAddress.Any) || address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
            .Where(IsLanAddress).Select(address => address.ToString()).Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal)];
    }

    public static bool IsLanAddress(IPAddress address)
    {
        var bytes = address.GetAddressBytes();
        return bytes.Length == 4
            ? bytes[0] == 10 || (bytes[0] == 172 && bytes[1] is >= 16 and <= 31) || (bytes[0] == 192 && bytes[1] == 168)
            : (bytes[0] & 0xfe) == 0xfc;
    }

    private static IEnumerable<IPAddress> EnumerateAddresses()
    {
        return NetworkInterface.GetAllNetworkInterfaces()
        .Where(network => network.OperationalStatus == OperationalStatus.Up)
        .SelectMany(network => network.GetIPProperties().UnicastAddresses.Select(address => address.Address));
    }

    public static async Task SweepLoopAsync(IHubBackend backend, TimeSpan interval, CancellationToken cancellationToken)
    {
        using var timer = new PeriodicTimer(interval);
        try
        {
            while (true)
            {
                _ = await timer.WaitForNextTickAsync(cancellationToken).ConfigureAwait(false);
                await backend.SweepAsync(cancellationToken).ConfigureAwait(false);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { }
    }

    public static string ReadyLine(RunningHub hub)
    {
        return "I6_SHARE_READY " + JsonSerializer.Serialize(new ReadyMessage(hub.Port, hub.AdminUrl), HostJsonContext.Default.ReadyMessage);
    }

    public static ProcessStartInfo BrowserStartInfo(string url)
    {
        return new(url)
        {
            UseShellExecute = true
        };
    }

    public static void LaunchBrowser(string url)
    {
        LaunchBrowser(url, Process.Start);
    }

    public static void LaunchBrowser(string url, Func<ProcessStartInfo, Process?> start)
    {
        start(BrowserStartInfo(url))?.Dispose();
    }

    public static async Task<int> RunAsync(string[] args, TextWriter output, TextWriter error, Action<string>? openBrowser = null, CancellationToken cancellationToken = default)
    {
        var result = 0;
        try
        {
            var options = HubHostOptions.Parse(args, Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), Environment.GetEnvironmentVariable("XDG_DATA_HOME"), AppContext.BaseDirectory);
            if (options.Help)
            {
                await output.WriteLineAsync(HubHostOptions.Usage).ConfigureAwait(false);
                return 0;
            }
            var hub = await StartAsync(options, async (settings, token) => new HubBackend(await HubService.CreateAsync(settings, token).ConfigureAwait(false)), cancellationToken).ConfigureAwait(false);
            await using var hubLease = hub.ConfigureAwait(false);
            await output.WriteLineAsync(ReadyLine(hub)).ConfigureAwait(false);
            var launch = openBrowser ?? LaunchBrowser;
            if (options.OpenBrowser)
            {
                try
                {
                    launch(hub.AdminUrl);
                }
                catch (System.ComponentModel.Win32Exception exception) { await error.WriteLineAsync($"Open this dashboard in your browser: {hub.AdminUrl}\n{exception.Message}").ConfigureAwait(false); }
            }
            using var stop = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, hub.Application.Lifetime.ApplicationStopping);
            var sweep = SweepLoopAsync(hub.Backend, TimeSpan.FromMinutes(5), stop.Token);
            var stopped = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            using var registration = stop.Token.Register(() => stopped.TrySetResult());
            await stopped.Task.ConfigureAwait(false);
            await sweep.ConfigureAwait(false);
        }
        catch (Exception exception) when (exception is ArgumentException or IOException or InvalidOperationException or UnauthorizedAccessException)
        {
            await error.WriteLineAsync(exception.Message).ConfigureAwait(false);
            result = 1;
        }
        return result;
    }
}
