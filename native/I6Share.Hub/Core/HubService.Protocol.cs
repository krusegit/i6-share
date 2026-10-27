using System.Text;
using System.Text.Json;
using I6Share.Contracts;
using I6Share.Hub.Protocol;

namespace I6Share.Hub.Core;

internal sealed partial class HubService
{
    private async Task<HubReply> HandleCoreAsync(string method, string path, IReadOnlyDictionary<string, string> query, ReadOnlyMemory<byte> body, string remoteAddress, CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (body.Length > WireConstants.MaxBody)
            {
                return Error(413, "too-large");
            }

            if (method == "GET" && path is "/" or "/index.html")
            {
                return new HubReply(200, "text/html; charset=utf-8", Encoding.UTF8.GetBytes($"<!doctype html><title>i6-share Hub</title><h1>i6-share Hub</h1><p>Open the local dashboard on this computer to pair your phone.</p><a href=\"{WireConstants.AppUrl}\">Phone app</a>"));
            }

            if (method is "GET" or "POST" && path == "/i6/hello")
            {
                return new HubReply(200, "application/json", Serialize(Hello(), WireJsonContext.Default.HelloResponse));
            }

            if (method != "POST" || !path.StartsWith("/i6/", StringComparison.Ordinal))
            {
                return Error(404, "not-found");
            }

            var operation = path[4..];
            if (operation == "pair")
            {
                return await PairAsync(query.GetValueOrDefault("h", ""), body, remoteAddress, cancellationToken).ConfigureAwait(false);
            }

            if (operation is not ("sync" or "offer" or "put" or "end" or "cancel" or "pull" or "pulled" or "unpair"))
            {
                return Error(404, "not-found");
            }

            var deviceId = query.GetValueOrDefault("d", "");
            if (!IsId(deviceId, 16))
            {
                return Error(400, "bad-request");
            }

            var device = Device(deviceId);
            if (device is null)
            {
                return Error(401, "unknown-device");
            }

            var key = WireCrypto.DeviceKey(WireCrypto.FromBase64Url(device.Secret), deviceId);
            OpenedEnvelope message;
            try
            {
                message = WireCrypto.Open(key, WireCrypto.RequestAad(operation, deviceId), body.Span);
            }
            catch (ProtocolException) { return Error(401, "bad-auth"); }
            var seen = device with
            {
                LastSeen = Now,
                LastAddr = remoteAddress
            };
            PutDevice(seen);
            if (Now - _lastPersisted.GetValueOrDefault(deviceId) > 60_000)
            {
                await SaveAsync(_snapshot, cancellationToken).ConfigureAwait(false);
                _lastPersisted = _lastPersisted.SetItem(deviceId, Now);
            }
            var reply = operation == "sync"
                ? await SyncAsync(seen, Decode(message.Json, WireJsonContext.Default.SyncRequest), cancellationToken).ConfigureAwait(false)
                : await OperateAsync(operation, seen, message.Json, message.Binary, cancellationToken).ConfigureAwait(false);
            var sealedResponse = WireCrypto.Seal(key, WireCrypto.ResponseAad(operation, message.Iv), reply.Json, reply.Binary);
            return new HubReply(200, "application/octet-stream", sealedResponse.Body);
        }
        catch (HubOperationException error) { return Error(error.Status, error.Code); }
        catch (JsonException) { return Error(400, "bad-request"); }
        catch (Exception error) when (error is not OperationCanceledException) { return Error(500, "internal"); }
        finally { _ = _gate.Release(); }
    }

}
