using System.Net;
using System.Text;
using I6Share.Contracts;
using I6Share.Hub.Core;
using I6Share.Hub.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;

namespace I6Share.Hub.Tests;

public sealed partial class HostingTests : IDisposable
{

    [Fact]
    public async Task DispatchesEveryTypedAdminOperation()
    {
        var state = Context();
        await Dispatcher.HandleAsync(state);
        Assert.Contains("receiveDirectory", Text(state), StringComparison.Ordinal);
        var pair = Context("/admin/pair", "POST");
        await Dispatcher.HandleAsync(pair);
        Assert.Contains("pair=code", Text(pair), StringComparison.Ordinal);
        var settings = Context("/admin/settings", "POST", /*lang=json,strict*/ "{\"name\":\"New\",\"receiveDirectory\":\"/folder\"}");
        await Dispatcher.HandleAsync(settings);
        Assert.Equal(("New", "/folder"), _backend.Settings);
        var send = Context("/admin/send", "POST", /*lang=json,strict*/ "{\"deviceId\":\"phone\",\"paths\":[\"/file\"]}");
        await Dispatcher.HandleAsync(send);
        Assert.Equal(/*lang=json,strict*/ "{\"tid\":\"transfer\"}", Text(send));
        Assert.Equal("/file", Assert.Single(_backend.Files));
        var forget = Context("/admin/devices/phone/forget", "POST");
        await Dispatcher.HandleAsync(forget);
        Assert.Equal("phone", _backend.Revoked);
        var cancel = Context("/admin/outbox/transfer/cancel", "POST");
        await Dispatcher.HandleAsync(cancel);
        Assert.Equal("transfer", _backend.Cancelled);
    }

    [Theory]
    [InlineData("/admin/unknown", "POST", "{}", 404)]
    [InlineData("/admin/foo/id/forget", "POST", "{}", 404)]
    [InlineData("/admin/devices/id/unknown", "POST", "{}", 404)]
    [InlineData("/admin/outbox/id/unknown", "POST", "{}", 404)]
    [InlineData("/admin/pair", "GET", "{}", 405)]
    [InlineData("/admin/settings", "POST", "null", 400)]
    [InlineData("/admin/settings", "POST", "no-json", 400)]
    [InlineData("/admin/send", "POST", "{}", 400)]
    [InlineData("/admin/send", "POST", /*lang=json,strict*/ "{\"deviceId\":\"\",\"paths\":[\"/file\"]}", 400)]
    [InlineData("/admin/send", "POST", /*lang=json,strict*/ "{\"deviceId\":\"phone\",\"paths\":null}", 400)]
    [InlineData("/admin/send", "POST", /*lang=json,strict*/ "{\"deviceId\":\"phone\",\"paths\":[]}", 400)]
    [InlineData("/admin/send", "POST", /*lang=json,strict*/ "{\"deviceId\":\"phone\",\"paths\":[\" \"]}", 400)]
    public async Task RejectsMalformedAdministration(string path, string method, string body, int status)
    {
        var context = Context(path, method, body);
        await Dispatcher.HandleAsync(context);
        Assert.Equal(status, context.Response.StatusCode);
        Assert.False(context.Response.Headers.ContainsKey("Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task RejectsUnauthorizedAndCrossOriginRequests()
    {
        var missing = Context();
        missing.Request.Headers.Authorization = "";
        await Dispatcher.HandleAsync(missing);
        Assert.Equal(401, missing.Response.StatusCode);
        var remote = Context();
        remote.Connection.RemoteIpAddress = IPAddress.Parse("10.0.0.2");
        await Dispatcher.HandleAsync(remote);
        Assert.Equal(403, remote.Response.StatusCode);
        var origin = Context();
        origin.Request.Headers.Origin = "https://evil.example";
        await Dispatcher.HandleAsync(origin);
        Assert.Equal(403, origin.Response.StatusCode);
        foreach (var contentType in new string?[] { "text/plain", null })
        {
            var context = Context("/admin/pair", "POST");
            context.Request.ContentType = contentType;
            await Dispatcher.HandleAsync(context);
            Assert.Equal(415, context.Response.StatusCode);
        }
    }

    [Fact]
    public async Task PreservesProtocolCorsAndBodyWithoutAdminAuthentication()
    {
        var preflight = Context("/i6/offer", "OPTIONS");
        await Dispatcher.HandleAsync(preflight);
        Assert.Equal(204, preflight.Response.StatusCode);
        Assert.Equal("true", preflight.Response.Headers["Access-Control-Allow-Private-Network"]);
        var request = Context("/i6/offer", "POST", "bytes");
        request.Request.QueryString = new QueryString("?d=phone");
        request.Connection.RemoteIpAddress = null;
        await Dispatcher.HandleAsync(request);
        Assert.Equal("bytes", Encoding.UTF8.GetString(_backend.Body));
        Assert.Equal("phone", _backend.Query["d"]);
        Assert.Equal("", _backend.Remote);
        Assert.Equal("*", request.Response.Headers.AccessControlAllowOrigin);
        Assert.Equal("reply", Text(request));
        var tooLarge = Context("/i6/put", "POST");
        tooLarge.Request.Body = new MemoryStream(new byte[WireConstants.MaxBody + 1]);
        await Dispatcher.HandleAsync(tooLarge);
        Assert.Equal(413, tooLarge.Response.StatusCode);
        var adminTooLarge = Context("/admin/pair", "POST");
        adminTooLarge.Request.Body = new MemoryStream(new byte[WireConstants.MaxBody + 1]);
        await Dispatcher.HandleAsync(adminTooLarge);
        Assert.Equal(413, adminTooLarge.Response.StatusCode);
    }

    [Fact]
    public async Task ReadsBoundedBodiesAndMapsExpectedFailures()
    {
        Assert.Equal(new byte[] { 1, 2 }, await HostDispatcher.ReadBodyAsync(new MemoryStream([1, 2]), 2, default));
        _ = await Assert.ThrowsAsync<BodyLimitException>(() => HostDispatcher.ReadBodyAsync(new MemoryStream([1]), 0, default));
        foreach (var (exception, status) in new (Exception, int)[] { (new ArgumentException(), 400), (new KeyNotFoundException(), 404), (new UnauthorizedAccessException(), 403), (new IOException(), 500), (new HubOperationException(409, "conflict"), 409) })
        {
            _backend.Failure = exception;
            var context = Context();
            await Dispatcher.HandleAsync(context);
            Assert.Equal(status, context.Response.StatusCode);
        }
        _backend.Failure = new OperationCanceledException();
        var aborted = Context();
        aborted.RequestAborted = new CancellationToken(true);
        await Dispatcher.HandleAsync(aborted);
    }

    [Fact]
    public async Task ServesOnlyLocalStaticAssetsWithoutTraversalOrSymlinks()
    {
        await File.WriteAllTextAsync(Path.Combine(_root, "index.html"), "dashboard");
        _ = Directory.CreateDirectory(Path.Combine(_root, "nested"));
        await File.WriteAllTextAsync(Path.Combine(_root, "nested", "app.js"), "app");
        var page = Context("/");
        await Dispatcher.HandleAsync(page);
        Assert.Equal("dashboard", Text(page));
        Assert.Contains("frame-ancestors 'none'", page.Response.Headers.ContentSecurityPolicy.ToString(), StringComparison.Ordinal);
        var head = Context("/nested/app.js", "HEAD");
        await Dispatcher.HandleAsync(head);
        Assert.Equal(3, head.Response.ContentLength);
        Assert.Equal("", Text(head));
        var traversal = Context("/../package.json");
        await Dispatcher.HandleAsync(traversal);
        Assert.Equal(404, traversal.Response.StatusCode);
        var missing = Context("/missing");
        await Dispatcher.HandleAsync(missing);
        Assert.Equal(404, missing.Response.StatusCode);
        var post = Context("/", "POST");
        await Dispatcher.HandleAsync(post);
        Assert.Equal(405, post.Response.StatusCode);
        _ = File.CreateSymbolicLink(Path.Combine(_root, "link.js"), Path.Combine(_root, "nested", "app.js"));
        var link = Context("/link.js");
        await Dispatcher.HandleAsync(link);
        Assert.Equal(404, link.Response.StatusCode);
        var remote = Context("/");
        remote.Connection.RemoteIpAddress = IPAddress.Parse("10.0.0.1");
        await Dispatcher.HandleAsync(remote);
        Assert.Contains("local dashboard", Text(remote), StringComparison.Ordinal);
        var remoteFile = Context("/index.html");
        remoteFile.Connection.RemoteIpAddress = IPAddress.Parse("10.0.0.1");
        await Dispatcher.HandleAsync(remoteFile);
        Assert.Equal(404, remoteFile.Response.StatusCode);
        var remotePost = Context("/", "POST");
        remotePost.Connection.RemoteIpAddress = IPAddress.Parse("10.0.0.1");
        await Dispatcher.HandleAsync(remotePost);
        Assert.Equal(404, remotePost.Response.StatusCode);
        var emptyPath = Context("");
        await Dispatcher.HandleAsync(emptyPath);
        Assert.Equal(404, emptyPath.Response.StatusCode);
        var nullPath = Context();
        nullPath.Request.Path = default;
        await Dispatcher.HandleAsync(nullPath);
        Assert.Equal(404, nullPath.Response.StatusCode);
    }

    [Theory]
    [InlineData("index.html", "text/html; charset=utf-8")]
    [InlineData("app.js", "text/javascript; charset=utf-8")]
    [InlineData("app.css", "text/css; charset=utf-8")]
    [InlineData("app.json", "application/json")]
    [InlineData("app.map", "application/json")]
    [InlineData("icon.svg", "image/svg+xml")]
    [InlineData("icon.png", "image/png")]
    [InlineData("icon.ico", "image/x-icon")]
    [InlineData("unknown", "application/octet-stream")]
    public void TypesStaticResponses(string file, string type)
    {
        Assert.Equal(type, HostDispatcher.MimeType(file));
    }

    [Fact]
    public async Task ValidatesWebsocketHandshakeBeforeAccepting()
    {
        var missing = Context("/admin/lifetime");
        await Dispatcher.HandleAsync(missing);
        Assert.Equal(400, missing.Response.StatusCode);
        var remote = Context("/admin/lifetime");
        remote.Connection.RemoteIpAddress = IPAddress.Parse("10.0.0.1");
        await Dispatcher.HandleAsync(remote);
        Assert.Equal(403, remote.Response.StatusCode);
        var origin = Context("/admin/lifetime");
        origin.Request.Headers.Origin = "https://evil.example";
        await Dispatcher.HandleAsync(origin);
        Assert.Equal(403, origin.Response.StatusCode);
        foreach (var protocols in new[] { "", "other, secret", "i6-share-dashboard, bad" })
        {
            var context = Context("/admin/lifetime");
            context.Request.Headers.SecWebSocketProtocol = protocols;
            context.Features.Set<IHttpWebSocketFeature>(new HostingWebSocketFeature());
            await Dispatcher.HandleAsync(context);
            Assert.Equal(401, context.Response.StatusCode);
        }
        foreach (var fail in new[] { false, true })
        {
            var context = Context("/admin/lifetime");
            context.Request.Headers.SecWebSocketProtocol = "i6-share-dashboard, secret";
            context.Features.Set<IHttpWebSocketFeature>(new HostingWebSocketFeature { Fail = fail });
            await Dispatcher.HandleAsync(context);
        }
    }
}
