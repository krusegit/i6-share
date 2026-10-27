using System.Net;
using System.Text;
using I6Share.Hub.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Primitives;

namespace I6Share.Hub.Tests;

public sealed partial class HostingTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "i6-host-" + Guid.NewGuid().ToString("N"));
    private readonly DashboardLifetime _lifetime = new(TimeProvider.System, TimeSpan.FromHours(1), TimeSpan.FromHours(1), () => { });
    private readonly HostingFakeBackend _backend = new();
    public HostingTests()
    {
        _ = Directory.CreateDirectory(_root);
    }

    public void Dispose()
    {
        _lifetime.Dispose();
        _backend.Dispose();
        Directory.Delete(_root, true);
    }
    private HostDispatcher Dispatcher => new(_backend, "secret", _root, _lifetime);

    private static DefaultHttpContext Context(string path = "/admin/state", string method = "GET", string body = "{}")
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.Request.Method = method;
        context.Request.Scheme = "http";
        context.Request.Host = new HostString("127.0.0.1", 47616);
        context.Connection.RemoteIpAddress = IPAddress.Loopback;
        context.Request.Headers.Authorization = "Bearer secret";
        context.Request.ContentType = "application/json";
        context.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(body));
        context.Response.Body = new MemoryStream();
        return context;
    }
    private static string Text(HttpContext context)
    {
        return Encoding.UTF8.GetString(((MemoryStream)context.Response.Body).ToArray());
    }

    [Fact]
    public void ParsesOptionsAndRejectsInvalidValues()
    {
        var defaults = HubHostOptions.Parse([], "/home/user", null, "/app");
        Assert.Equal("/home/user/.local/share/i6-share", defaults.DataDirectory);
        Assert.Equal("/home/user/Downloads/i6-share", defaults.ReceiveDirectory);
        Assert.Equal("/app/wwwroot", defaults.WebRoot);
        Assert.Equal("http://0.0.0.0:47616", defaults.ListenUrl);
        Assert.Equal("http://127.0.0.1:1000/#admin=token", defaults.DashboardUrl(1000, "token"));
        var options = HubHostOptions.Parse(["--host", "::1", "--port", "0", "--name", "PC", "--open", "--help", "--data-dir", "/data", "--receive-dir", "/received", "--web-root", "/web"], "/home", "/xdg", "/app");
        Assert.Equal("http://[::1]:0", options.ListenUrl);
        Assert.Equal("http://[::1]:1000/#admin=token", options.DashboardUrl(1000, "token"));
        Assert.Equal("http://[::1]:1000/#admin=token", (options with
        {
            Host = "::"
        }).DashboardUrl(1000, "token"));
        Assert.Equal("::", HubHostOptions.Parse(["--host", "::"], "/home", null, "/app").Host);
        Assert.Equal("0.0.0.0", HubHostOptions.Parse(["--host", "0.0.0.0"], "/home", null, "/app").Host);
        Assert.Equal("PC", options.Name);
        Assert.True(options.OpenBrowser);
        Assert.True(options.Help);
        Assert.Equal("/data", options.DataDirectory);
        Assert.Equal("/received", options.ReceiveDirectory);
        Assert.Equal("/web", options.WebRoot);
        Assert.Equal("/xdg/i6-share", HubHostOptions.Parse([], "/home", "/xdg", "/app").DataDirectory);
        Assert.Equal("127.0.0.1", HubHostOptions.Parse(["--host", "localhost"], "/home", " ", "/app").Host);
        foreach (var invalid in new[] { new[] { "--name" }, ["--name", "--open"], ["--bad", "x"], ["--host", "evil.example"], ["--host", "192.168.1.1"], ["--port", "-1"], ["--port", "65536"], ["--port", "oops"] })
        {
            _ = Assert.Throws<ArgumentException>(() => HubHostOptions.Parse(invalid, "/home", null, "/app"));
        }
    }

    [Theory]
    [InlineData(null, "localhost", false)]
    [InlineData("192.168.1.2", "localhost", false)]
    [InlineData("127.0.0.1", "localhost", true)]
    [InlineData("::ffff:127.0.0.1", "LOCALHOST", true)]
    [InlineData("::1", "[::1]", true)]
    [InlineData("127.0.0.1", "127.0.0.1", true)]
    [InlineData("127.0.0.1", "evil.example", false)]
    [InlineData("127.0.0.1", "192.168.1.2", false)]
    public void RestrictsAdministrationToLocalAddresses(string? remote, string host, bool expected)
    {
        var context = Context();
        context.Request.Host = new HostString(host);
        Assert.Equal(expected, AdminSecurity.IsLocal(context.Request, remote is null ? null : IPAddress.Parse(remote)));
    }

    [Fact]
    public void ValidatesOriginAndConstantTimeTokenComparison()
    {
        var context = Context();
        Assert.True(AdminSecurity.HasValidOrigin(context.Request));
        context.Request.Headers.Origin = "http://127.0.0.1:47616";
        Assert.True(AdminSecurity.HasValidOrigin(context.Request));
        context.Request.Headers.Origin = "null";
        Assert.False(AdminSecurity.HasValidOrigin(context.Request));
        context.Request.Headers.Origin = new StringValues(["http://127.0.0.1:47616", "http://127.0.0.1:47616"]);
        Assert.False(AdminSecurity.HasValidOrigin(context.Request));
        Assert.True(AdminSecurity.IsAuthorized(context.Request, "secret"));
        context.Request.Headers.Authorization = "Bearer wrong!";
        Assert.False(AdminSecurity.IsAuthorized(context.Request, "secret"));
        context.Request.Headers.Authorization = "Bearer x";
        Assert.False(AdminSecurity.IsAuthorized(context.Request, "secret"));
        context.Request.Headers.Authorization = new StringValues(["Bearer secret", "Bearer secret"]);
        Assert.False(AdminSecurity.IsAuthorized(context.Request, "secret"));
        context.Request.Headers.Authorization = default;
        Assert.False(AdminSecurity.IsAuthorized(context.Request, "secret"));
        var first = AdminSecurity.NewToken();
        Assert.Equal(64, first.Length);
        Assert.NotEqual(first, AdminSecurity.NewToken());
    }
    [Fact]
    public void BodyLimitErrorsRetainTheirMessageAndCause()
    {
        var cause = new IOException("body stream");
        Assert.Equal("custom limit", new BodyLimitException("custom limit").Message);
        var error = new BodyLimitException("custom limit", cause);
        Assert.Equal("custom limit", error.Message);
        Assert.Same(cause, error.InnerException);
    }

}
