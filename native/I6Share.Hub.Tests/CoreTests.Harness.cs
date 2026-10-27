using System.Text;
using System.Text.Json;
using I6Share.Hub.Core;
using I6Share.Hub.Protocol;
using I6Share.Hub.Storage;

namespace I6Share.Hub.Tests;

public sealed partial class CoreTests
{
    private sealed class Harness : IAsyncDisposable
    {
        public readonly string Root = Path.Combine(Path.GetTempPath(), "i6-core-" + Guid.NewGuid().ToString("N"));
        public long Time = 1_000_000;
        public required HubService Service;
        public required FaultStore Store;
        public required FaultSink Sink;
        public string DeviceId = "0102030405060708";
        public byte[] Key = [];
        public HubServiceOptions Options => new() { DataDirectory = Path.Combine(Root, "data"), ReceiveDirectory = Path.Combine(Root, "received"), Clock = () => DateTimeOffset.FromUnixTimeMilliseconds(Time), Addresses = () => ["127.0.0.1", "127.0.0.1"] };
        private Harness()
        {
        }
        public static async Task<Harness> CreateAsync()
        {
            var harness = new Harness { Service = null!, Store = null!, Sink = null! };
            harness.Store = new FaultStore(harness.Options.DataDirectory);
            harness.Service = await HubService.CreateAsync(harness.Options, harness.Store, directory => harness.Sink = new FaultSink(new FileTransferSink(directory))).ConfigureAwait(true);
            return harness;
        }
        public async Task PairAsync()
        {
            var code = await Service.NewPairCodeAsync().ConfigureAwait(true);
            var payload = PairingPayload.Decode(code.Payload);
            var pairKey = WireCrypto.PairKey(payload.Token, payload.HubId);
            var request = WireCrypto.Seal(pairKey, WireCrypto.RequestAad("pair", "pair"), Encoding.UTF8.GetBytes($"{{\"deviceId\":\"{DeviceId}\",\"name\":\"Test Phone\",\"os\":\"Android\"}}"));
            var reply = await Service.HandleAsync("POST", "/i6/pair", new Dictionary<string, string> { ["h"] = payload.HubId }, request.Body, "127.0.0.1").ConfigureAwait(true);
            Assert.Equal(200, reply.Status);
            var secret = WireCrypto.Open(pairKey, WireCrypto.ResponseAad("pair", request.Iv), reply.Body).Json.GetProperty("secret").GetString() ?? throw new InvalidOperationException();
            Key = WireCrypto.DeviceKey(WireCrypto.FromBase64Url(secret), DeviceId);
        }
        public async Task<(HubReply Reply, JsonElement Json, byte[] Binary)> PostAsync(string op, string json, byte[]? bytes = null)
        {
            var request = WireCrypto.Seal(Key, WireCrypto.RequestAad(op, DeviceId), Encoding.UTF8.GetBytes(json), bytes ?? []);
            var reply = await Service.HandleAsync("POST", "/i6/" + op, new Dictionary<string, string> { ["d"] = DeviceId }, request.Body, "127.0.0.2").ConfigureAwait(true);
            if (reply.Status != 200)
            {
                return (reply, JsonDocument.Parse(reply.Body).RootElement.Clone(), []);
            }

            var opened = WireCrypto.Open(Key, WireCrypto.ResponseAad(op, request.Iv), reply.Body);
            return (reply, opened.Json, opened.Binary);
        }
        public async ValueTask DisposeAsync()
        {
            await Service.DisposeAsync().ConfigureAwait(true);
            Directory.Delete(Root, true);
        }
    }
    private const string Tid = "112233445566778899001122";
    private static string Offer(string files)
    {
        return $"{{\"tid\":\"{Tid}\",\"files\":[{files}]}}";
    }

    private static string Operation(int index = 0, long offset = 0)
    {
        return $"{{\"tid\":\"{Tid}\",\"i\":{index},\"offset\":{offset}}}";
    }

    private static string End => $"{{\"tid\":\"{Tid}\"}}";
}
