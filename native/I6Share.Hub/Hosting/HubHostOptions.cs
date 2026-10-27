using System.Globalization;
using System.Net;

namespace I6Share.Hub.Hosting;

internal sealed record HubHostOptions
{
    public string Host { get; init; } = "0.0.0.0";
    public int Port { get; init; } = 47616;
    public required string DataDirectory
    {
        get; init;
    }
    public required string ReceiveDirectory
    {
        get; init;
    }
    public required string WebRoot
    {
        get; init;
    }
    public string? Name
    {
        get; init;
    }
    public bool OpenBrowser
    {
        get; init;
    }
    public bool Help
    {
        get; init;
    }

    public const string Usage = """
        i6-share-hub [options]
          --host ADDRESS       Any-interface or loopback address (default 0.0.0.0)
          --port PORT          LAN TCP port (default 47616; 0 selects a free port)
          --data-dir PATH      Persistent identity, devices, and outgoing files
          --receive-dir PATH   Incoming files (default ~/Downloads/i6-share)
          --web-root PATH      Dashboard assets (default executable/wwwroot)
          --name NAME          Computer name for a new hub
          --open               Open the local dashboard in the default browser
          --help               Show this help
        Closing the last dashboard stops the hub. Ctrl+C also stops it.
        """;

    public static HubHostOptions Parse(IReadOnlyList<string> arguments, string home, string? dataHome, string executableDirectory)
    {
        var result = new HubHostOptions
        {
            DataDirectory = Path.Combine(string.IsNullOrWhiteSpace(dataHome) ? Path.Combine(home, ".local", "share") : dataHome, "i6-share"),
            ReceiveDirectory = Path.Combine(home, "Downloads", "i6-share"),
            WebRoot = Path.Combine(executableDirectory, "wwwroot"),
        };
        for (var index = 0; index < arguments.Count; index++)
        {
            var argument = arguments[index];
            if (argument == "--help")
            {
                result = result with
                {
                    Help = true
                };
                continue;
            }
            if (argument == "--open")
            {
                result = result with
                {
                    OpenBrowser = true
                };
                continue;
            }
            if (++index >= arguments.Count || arguments[index].StartsWith("--", StringComparison.Ordinal))
            {
                throw new ArgumentException($"Missing value for {argument}");
            }

            var value = arguments[index];
            result = argument switch
            {
                "--host" => result with { Host = ParseHost(value) },
                "--port" => result with { Port = ParsePort(value) },
                "--data-dir" => result with { DataDirectory = Path.GetFullPath(value) },
                "--receive-dir" => result with { ReceiveDirectory = Path.GetFullPath(value) },
                "--web-root" => result with { WebRoot = Path.GetFullPath(value) },
                "--name" => result with { Name = value },
                _ => throw new ArgumentException($"Unknown option: {argument}"),
            };
        }
        return result;
    }

    private static string ParseHost(string value)
    {
        return value == "localhost"
            ? "127.0.0.1"
            : !IPAddress.TryParse(value, out var address) || !(address.Equals(IPAddress.Any) || address.Equals(IPAddress.IPv6Any) || IPAddress.IsLoopback(address))
            ? throw new ArgumentException("--host must be 0.0.0.0, ::, or a loopback address so the local dashboard remains reachable")
            : address.ToString();
    }
    private static int ParsePort(string value)
    {
        return int.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out var port) && port <= 65535 ? port : throw new ArgumentException("--port must be an integer from 0 through 65535");
    }

    public string ListenUrl => $"http://{(Host.Contains(':', StringComparison.Ordinal) ? $"[{Host}]" : Host)}:{Port.ToString(CultureInfo.InvariantCulture)}";
    public string DashboardUrl(int port, string token)
    {
        var host = Host switch
        {
            "0.0.0.0" => "127.0.0.1",
            "::" => "::1",
            _ => Host
        };
        return $"http://{(host.Contains(':', StringComparison.Ordinal) ? $"[{host}]" : host)}:{port.ToString(CultureInfo.InvariantCulture)}/#admin={token}";
    }
}
