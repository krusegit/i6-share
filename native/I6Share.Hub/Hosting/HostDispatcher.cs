using System.Net.WebSockets;
using System.Text.Json;
using System.Text.Json.Serialization.Metadata;
using I6Share.Contracts;
using I6Share.Hub.Core;

namespace I6Share.Hub.Hosting;

internal sealed class HostDispatcher(IHubBackend backend, string token, string webRoot, DashboardLifetime lifetime)
{
    public async Task HandleAsync(HttpContext context)
    {
        context.Response.Headers.CacheControl = "no-store";
        context.Response.Headers.XContentTypeOptions = "nosniff";
        var path = context.Request.Path.ToString();
        try
        {
            if (path == "/admin/lifetime")
            {
                await LifetimeAsync(context).ConfigureAwait(false);
                return;
            }
            if (path.StartsWith("/i6/", StringComparison.Ordinal))
            {
                await ProtocolAsync(context, path).ConfigureAwait(false);
                return;
            }
            if (path.StartsWith("/admin/", StringComparison.Ordinal))
            {
                await AdminAsync(context, path).ConfigureAwait(false);
                return;
            }
            if (!AdminSecurity.IsLocal(context.Request, context.Connection.RemoteIpAddress))
            {
                if (path == "/" && HttpMethods.IsGet(context.Request.Method))
                {
                    context.Response.ContentType = "text/html; charset=utf-8";
                    await context.Response.WriteAsync("<!doctype html><title>i6-share Hub</title><h1>i6-share Hub</h1><p>Open the local dashboard on this computer to pair a phone.</p>", context.RequestAborted).ConfigureAwait(false);
                }
                else
                {
                    await ErrorAsync(context, 404, "not-found").ConfigureAwait(false);
                }

                return;
            }
            await StaticAsync(context, path).ConfigureAwait(false);
        }
        catch (BodyLimitException) { await ErrorAsync(context, 413, "too-large").ConfigureAwait(false); }
        catch (HubOperationException error) { await ErrorAsync(context, error.Status, error.Code).ConfigureAwait(false); }
        catch (JsonException) { await ErrorAsync(context, 400, "bad-request").ConfigureAwait(false); }
        catch (ArgumentException) { await ErrorAsync(context, 400, "bad-request").ConfigureAwait(false); }
        catch (KeyNotFoundException) { await ErrorAsync(context, 404, "not-found").ConfigureAwait(false); }
        catch (UnauthorizedAccessException) { await ErrorAsync(context, 403, "access-denied").ConfigureAwait(false); }
        catch (IOException) { await ErrorAsync(context, 500, "io-error").ConfigureAwait(false); }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { context.Abort(); }
    }

    private async Task LifetimeAsync(HttpContext context)
    {
        if (!AdminSecurity.IsLocal(context.Request, context.Connection.RemoteIpAddress) || !AdminSecurity.HasValidOrigin(context.Request))
        {
            await ErrorAsync(context, 403, "local-only").ConfigureAwait(false);
            return;
        }
        if (!context.WebSockets.IsWebSocketRequest)
        {
            await ErrorAsync(context, 400, "websocket-required").ConfigureAwait(false);
            return;
        }
        var protocols = context.WebSockets.WebSocketRequestedProtocols;
        if (protocols.Count != 2 || protocols[0] != "i6-share-dashboard" || !AdminSecurity.TokenEquals(protocols[1], token))
        {
            await ErrorAsync(context, 401, "unauthorized").ConfigureAwait(false);
            return;
        }
        using var socket = await context.WebSockets.AcceptWebSocketAsync("i6-share-dashboard").ConfigureAwait(false);
        using var lease = lifetime.Connect();
        var buffer = new byte[128];
        try
        {
            while (true)
            {
                var message = await socket.ReceiveAsync(buffer.AsMemory(), context.RequestAborted).ConfigureAwait(false);
                if (message.MessageType != WebSocketMessageType.Close)
                {
                    continue;
                }

                await socket.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, "Dashboard closed", context.RequestAborted).ConfigureAwait(false);
                return;
            }
        }
        catch (WebSocketException) { }
    }

    private async Task ProtocolAsync(HttpContext context, string path)
    {
        var response = context.Response;
        response.Headers.AccessControlAllowOrigin = "*";
        response.Headers.AccessControlAllowMethods = "GET, POST, OPTIONS";
        response.Headers.AccessControlAllowHeaders = "*";
        response.Headers["Access-Control-Allow-Private-Network"] = "true";
        response.Headers.AccessControlMaxAge = "86400";
        if (HttpMethods.IsOptions(context.Request.Method))
        {
            response.StatusCode = 204;
            return;
        }
        var body = await ReadBodyAsync(context.Request.Body, WireConstants.MaxBody, context.RequestAborted).ConfigureAwait(false);
        var query = context.Request.Query.ToDictionary(pair => pair.Key, pair => pair.Value.ToString(), StringComparer.Ordinal);
        var reply = await backend.HandleAsync(context.Request.Method, path, query, body, context.Connection.RemoteIpAddress?.ToString() ?? "", context.RequestAborted).ConfigureAwait(false);
        response.StatusCode = reply.Status;
        response.ContentType = reply.ContentType;
        await response.Body.WriteAsync(reply.Body, context.RequestAborted).ConfigureAwait(false);
    }

    private async Task AdminAsync(HttpContext context, string path)
    {
        var request = context.Request;
        if (!AdminSecurity.IsLocal(request, context.Connection.RemoteIpAddress) || !AdminSecurity.HasValidOrigin(request))
        {
            await ErrorAsync(context, 403, "local-only").ConfigureAwait(false);
            return;
        }
        if (!AdminSecurity.IsAuthorized(request, token))
        {
            await ErrorAsync(context, 401, "unauthorized").ConfigureAwait(false);
            return;
        }
        if (path == "/admin/state" && HttpMethods.IsGet(request.Method))
        {
            await JsonAsync(context, await backend.GetStatusAsync(context.RequestAborted).ConfigureAwait(false), WireJsonContext.Default.AdminStatusResponse).ConfigureAwait(false);
            return;
        }
        if (!HttpMethods.IsPost(request.Method))
        {
            await ErrorAsync(context, 405, "method-not-allowed").ConfigureAwait(false);
            return;
        }
        if (request.ContentType?.Split(';')[0].Trim().Equals("application/json", StringComparison.OrdinalIgnoreCase) != true)
        {
            await ErrorAsync(context, 415, "json-required").ConfigureAwait(false);
            return;
        }
        var body = await ReadBodyAsync(request.Body, WireConstants.MaxBody, context.RequestAborted).ConfigureAwait(false);
        if (path == "/admin/pair")
        {
            await JsonAsync(context, await backend.NewPairCodeAsync(context.RequestAborted).ConfigureAwait(false), WireJsonContext.Default.PairCodeResponse).ConfigureAwait(false);
            return;
        }
        if (path == "/admin/settings")
        {
            var settings = Decode(body, WireJsonContext.Default.AdminSettingsRequest);
            await backend.SetSettingsAsync(settings.Name, settings.ReceiveDirectory, context.RequestAborted).ConfigureAwait(false);
            await JsonAsync(context, new OperationResponse { Ok = true }, WireJsonContext.Default.OperationResponse).ConfigureAwait(false);
            return;
        }
        if (path == "/admin/send")
        {
            var files = Decode(body, WireJsonContext.Default.QueueFilesRequest);
            if (string.IsNullOrWhiteSpace(files.DeviceId) || files.Paths is null || files.Paths.Count == 0 || files.Paths.Any(string.IsNullOrWhiteSpace))
            {
                await ErrorAsync(context, 400, "bad-request").ConfigureAwait(false);
                return;
            }
            var tid = await backend.QueueFilesAsync(files.DeviceId, files.Paths, context.RequestAborted).ConfigureAwait(false);
            await JsonAsync(context, new QueueFilesResponse { Tid = tid }, WireJsonContext.Default.QueueFilesResponse).ConfigureAwait(false);
            return;
        }
        var parts = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 4 && parts[1] == "devices" && parts[3] == "forget")
        {
            await JsonAsync(context, new OperationResponse { Ok = await backend.RevokeAsync(parts[2], context.RequestAborted).ConfigureAwait(false) }, WireJsonContext.Default.OperationResponse).ConfigureAwait(false);
            return;
        }
        if (parts.Length == 4 && parts[1] == "outbox" && parts[3] == "cancel")
        {
            await JsonAsync(context, new OperationResponse { Ok = await backend.CancelOutboxAsync(parts[2], context.RequestAborted).ConfigureAwait(false) }, WireJsonContext.Default.OperationResponse).ConfigureAwait(false);
            return;
        }
        await ErrorAsync(context, 404, "not-found").ConfigureAwait(false);
    }

    private async Task StaticAsync(HttpContext context, string path)
    {
        if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method))
        {
            await ErrorAsync(context, 405, "method-not-allowed").ConfigureAwait(false);
            return;
        }
        var root = Path.GetFullPath(webRoot);
        var relative = path == "/" ? "index.html" : Uri.UnescapeDataString(path.TrimStart('/'));
        var requested = Path.GetFullPath(Path.Combine(root, relative));
        var file = Directory.EnumerateFiles(root, "*", new EnumerationOptions { RecurseSubdirectories = true, AttributesToSkip = FileAttributes.ReparsePoint })
            .FirstOrDefault(candidate => string.Equals(candidate, requested, StringComparison.Ordinal));
        if (file is null)
        {
            await ErrorAsync(context, 404, "not-found").ConfigureAwait(false);
            return;
        }
        context.Response.Headers.ContentSecurityPolicy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
        context.Response.Headers["Referrer-Policy"] = "no-referrer";
        context.Response.ContentType = MimeType(file);
        context.Response.ContentLength = new FileInfo(file).Length;
        if (HttpMethods.IsHead(context.Request.Method))
        {
            return;
        }

        var stream = File.OpenRead(file);
        await using var streamLease = stream.ConfigureAwait(false);
        await stream.CopyToAsync(context.Response.Body, context.RequestAborted).ConfigureAwait(false);
    }

    public static string MimeType(string path)
    {
        return Path.GetExtension(path).ToLowerInvariant() switch
        {
            ".html" => "text/html; charset=utf-8",
            ".js" => "text/javascript; charset=utf-8",
            ".css" => "text/css; charset=utf-8",
            ".json" or ".map" => "application/json",
            ".svg" => "image/svg+xml",
            ".png" => "image/png",
            ".ico" => "image/x-icon",
            _ => "application/octet-stream",
        };
    }

    public static async Task<byte[]> ReadBodyAsync(Stream input, int limit, CancellationToken cancellationToken)
    {
        using var output = new MemoryStream();
        var buffer = new byte[Math.Min(limit + 1, 8192)];
        while (true)
        {
            var count = await input.ReadAsync(buffer, cancellationToken).ConfigureAwait(false);
            if (count == 0)
            {
                return output.ToArray();
            }

            if (output.Length + count > limit)
            {
                throw new BodyLimitException();
            }

            await output.WriteAsync(buffer.AsMemory(0, count), cancellationToken).ConfigureAwait(false);
        }
    }

    private static T Decode<T>(ReadOnlySpan<byte> bytes, JsonTypeInfo<T> type)
    {
        return JsonSerializer.Deserialize(bytes, type) ?? throw new JsonException("A JSON object is required");
    }

    private static async Task JsonAsync<T>(HttpContext context, T value, JsonTypeInfo<T> type)
    {
        context.Response.ContentType = "application/json";
        await JsonSerializer.SerializeAsync(context.Response.Body, value, type, context.RequestAborted).ConfigureAwait(false);
    }
    private static Task ErrorAsync(HttpContext context, int status, string code)
    {
        context.Response.StatusCode = status;
        return JsonAsync(context, new ErrorResponse { Error = code }, WireJsonContext.Default.ErrorResponse);
    }
}

internal sealed class BodyLimitException(string message, Exception? innerException) : Exception(message, innerException)
{
    public BodyLimitException() : this("Request body exceeds the limit.", null) { }
    public BodyLimitException(string message) : this(message, null) { }
}
