using System.Text;
using System.Text.Json;
using I6Share.Contracts;
using I6Share.Hub.Core;
using I6Share.Hub.Protocol;

namespace I6Share.Hub.Tests;

public sealed partial class CoreExtraTests
{
    private sealed record Session(string DeviceId, byte[] Key);
    private sealed record Response(int Status, JsonElement Json, byte[] Binary);
    private sealed class Scenario : IAsyncDisposable
    {
        public required string Root
        {
            get; init;
        }
        public required HubService Hub
        {
            get; init;
        }
        public DateTimeOffset Time { get; set; } = DateTimeOffset.FromUnixTimeMilliseconds(1_800_000_000_000);
        public static async Task<Scenario> CreateAsync()
        {
            var root = Path.Combine(Path.GetTempPath(), "i6-core-extra-" + Guid.NewGuid().ToString("N"));
            Scenario? scenario = null;
            var hub = await HubService.CreateAsync(new HubServiceOptions
            {
                DataDirectory = Path.Combine(root, "data"),
                ReceiveDirectory = Path.Combine(root, "received"),
                Clock = () => scenario?.Time ?? DateTimeOffset.FromUnixTimeMilliseconds(1_800_000_000_000),
                Addresses = () => ["127.0.0.1"],
            }).ConfigureAwait(true);
            scenario = new Scenario { Root = root, Hub = hub };
            return scenario;
        }
        public async Task<Session> PairAsync(string deviceId = "1234567890abcdef", PairCodeResponse? code = null)
        {
            code ??= await Hub.NewPairCodeAsync().ConfigureAwait(true);
            var payload = PairingPayload.Decode(code.Payload);
            var key = WireCrypto.PairKey(payload.Token, payload.HubId);
            var envelope = WireCrypto.Seal(key, WireCrypto.RequestAad("pair", "pair"),
                WireCrypto.Serialize(new PairRequest { DeviceId = deviceId, Name = "Test Phone", Os = "Android" }, WireJsonContext.Default.PairRequest));
            var reply = await Hub.HandleAsync("POST", "/i6/pair", new Dictionary<string, string> { ["h"] = payload.HubId }, envelope.Body, "127.0.0.1").ConfigureAwait(true);
            Assert.Equal(200, reply.Status);
            var opened = WireCrypto.Open(key, WireCrypto.ResponseAad("pair", envelope.Iv), reply.Body);
            var response = opened.Json.Deserialize(WireJsonContext.Default.PairResponse) ?? throw new InvalidOperationException("missing pair response");
            return new Session(deviceId, WireCrypto.DeviceKey(WireCrypto.FromBase64Url(response.Secret), deviceId));
        }
        public async Task<Response> SendAsync(Session session, string operation, string json = "{}", byte[]? binary = null, CancellationToken cancellationToken = default)
        {
            var envelope = WireCrypto.Seal(session.Key, WireCrypto.RequestAad(operation, session.DeviceId), Encoding.UTF8.GetBytes(json), binary ?? []);
            var reply = await Hub.HandleAsync("POST", "/i6/" + operation, new Dictionary<string, string> { ["d"] = session.DeviceId }, envelope.Body, "127.0.0.1", cancellationToken).ConfigureAwait(true);
            if (reply.Status == 200)
            {
                var opened = WireCrypto.Open(session.Key, WireCrypto.ResponseAad(operation, envelope.Iv), reply.Body);
                return new Response(reply.Status, opened.Json, opened.Binary);
            }
            using var document = JsonDocument.Parse(reply.Body);
            return new Response(reply.Status, document.RootElement.Clone(), []);
        }
        public async ValueTask DisposeAsync()
        {
            await Hub.DisposeAsync().ConfigureAwait(true);
            if (Directory.Exists(Root))
            {
                Directory.Delete(Root, true);
            }
        }
    }
}
