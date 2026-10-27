using System.Collections.Immutable;
using System.Diagnostics.CodeAnalysis;
using System.Text.Json;
using System.Text.Json.Serialization.Metadata;
using I6Share.Contracts;
using I6Share.Hub.Protocol;
using I6Share.Hub.Storage;

namespace I6Share.Hub.Core;

/// <summary>Serialized state transitions for the v1 protocol and the local dashboard.</summary>
internal sealed partial class HubService : IAsyncDisposable
{
    public const long OnlineMs = 40_000;
    private const long MaxSafeInteger = 9_007_199_254_740_991;
    private const long LogTtlMs = 7 * 24 * 3_600_000L;
    private readonly HubServiceOptions _options;
    private readonly IHubStore _store;
    private readonly Func<string, ITransferSink> _sinkFactory;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly OperationLifetime _lifetime = new();
    private readonly Lock _disposeLock = new();
    private Task? _disposeTask;
    private readonly TaskCompletionSource _stopping = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private HubSnapshot _snapshot;
    private ITransferSink _sink;
    private ImmutableArray<Token> _tokens = [];
    private ImmutableDictionary<string, Incoming> _incoming = [];
    private ImmutableDictionary<string, OutProgress> _outProgress = [];
    private ImmutableDictionary<string, long> _lastPersisted = [];
    private ImmutableDictionary<string, ImmutableHashSet<TaskCompletionSource>> _waiters = [];
    private bool _disposed;

    private sealed record Token(byte[] Bytes, long ExpiresAt, string? UsedBy);
    private sealed record IncomingFile(FileMetadata Metadata, string Name, long Bytes, bool Done, string? Where, IPendingFile? Pending);
    private sealed record Incoming(string Key, string Tid, string DeviceId, string DeviceName, long CreatedAt, long LastActivity, ImmutableArray<IncomingFile> Files, double Speed, long RateAt, long RateBytes);
    private sealed record OutProgress(long Sent, double Speed, long RateAt, long RateBytes);
    private sealed record WireReply(byte[] Json, byte[] Binary);

    private HubService(HubServiceOptions options, IHubStore store, Func<string, ITransferSink> sinkFactory, HubSnapshot snapshot, ITransferSink sink)
    {
        _options = options;
        _store = store;
        _sinkFactory = sinkFactory;
        _snapshot = snapshot;
        _sink = sink;
    }

    public static Task<HubService> CreateAsync(HubServiceOptions options, CancellationToken cancellationToken = default)
    {
        return CreateAsync(options, new FileHubStore(options.DataDirectory), path => new FileTransferSink(path), cancellationToken);
    }

    public static async Task<HubService> CreateAsync(HubServiceOptions options, IHubStore store, Func<string, ITransferSink> sinkFactory, CancellationToken cancellationToken = default)
    {
        try
        {
            if (options.Port is < 1 or > 65535 || options.PartialTtlMs < 0)
            {
                throw new ArgumentOutOfRangeException(nameof(options));
            }

            var snapshot = await store.LoadAsync(options.ReceiveDirectory, Clean(options.Name, 40, "Linux PC"), cancellationToken).ConfigureAwait(false);
            var sink = sinkFactory(snapshot.ReceiveDirectory);
            return new HubService(options, store, sinkFactory, snapshot, sink);
        }
        catch
        {
            await store.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    private long Now => _options.Clock().ToUnixTimeMilliseconds();
    private string RandomId(int bytes)
    {
        return Convert.ToHexStringLower(_options.Random(bytes));
    }

    private static bool IsId([NotNullWhen(true)] string? value, int length)
    {
        return value is not null && value.Length == length && value.All(c => c is (>= '0' and <= '9') or (>= 'a' and <= 'f'));
    }

    private static string Clean(string? text, int maximum, string fallback = "")
    {
        var clean = string.Concat((text ?? "").Select(c => c is < ' ' or (char)127 ? ' ' : c)).Trim();
        return clean.Length == 0 ? fallback : clean[..Math.Min(clean.Length, maximum)];
    }
    private IReadOnlyList<string> Addresses()
    {
        try
        {
            return [.. _options.Addresses().Where(address => !string.IsNullOrWhiteSpace(address)).Distinct(StringComparer.Ordinal)];
        }
        catch (Exception error) when (error is IOException or System.Net.NetworkInformation.NetworkInformationException) { return []; }
    }
    private HelloResponse Hello()
    {
        return new()
        {
            App = "i6-share-hub",
            V = WireConstants.ProtocolVersion,
            Id = _snapshot.HubId,
            Name = _snapshot.Name,
            Port = _options.Port,
            Addrs = Addresses()
        };
    }

    private static byte[] Serialize<T>(T value, JsonTypeInfo<T> info)
    {
        return JsonSerializer.SerializeToUtf8Bytes(value, info);
    }

    private static T Decode<T>(JsonElement json, JsonTypeInfo<T> info) where T : class
    {
        var value = json.Deserialize(info);
        ArgumentNullException.ThrowIfNull(value);
        return value;
    }
    private static HubOperationException Bad()
    {
        return new(400, "bad-request");
    }

    private static string Tid(string? value)
    {
        return IsId(value, 24) ? value : throw Bad();
    }

    private static HubReply Error(int status, string code)
    {
        return new(status, "application/json", Serialize(new ErrorResponse { Error = code }, WireJsonContext.Default.ErrorResponse));
    }

    private static WireReply Reply<T>(T value, JsonTypeInfo<T> info, byte[]? binary = null)
    {
        return new(Serialize(value, info), binary ?? []);
    }

    private static WireReply Okay(bool okay = true)
    {
        return Reply(new OperationResponse { Ok = okay }, WireJsonContext.Default.OperationResponse);
    }

    private StoredDevice? Device(string id)
    {
        return _snapshot.Devices.FirstOrDefault(device => device.DeviceId == id);
    }

    private void PutDevice(StoredDevice device)
    {
        _snapshot = _snapshot with
        {
            Devices = [.. _snapshot.Devices.Where(item => item.DeviceId != device.DeviceId), device]
        };
    }

    private async Task SaveAsync(HubSnapshot snapshot, CancellationToken cancellationToken)
    {
        await _store.SaveAsync(snapshot, cancellationToken).ConfigureAwait(false);
        _snapshot = snapshot;
    }
    private async Task<HubReply> PairAsync(string hubId, ReadOnlyMemory<byte> body, string remoteAddress, CancellationToken cancellationToken)
    {
        if (hubId != _snapshot.HubId)
        {
            return Error(401, "bad-auth");
        }

        if (body.Length > 65536)
        {
            return Error(413, "too-large");
        }

        foreach (var token in _tokens.Reverse().Where(token => token.ExpiresAt > Now))
        {
            var key = WireCrypto.PairKey(token.Bytes, _snapshot.HubId);
            OpenedEnvelope message;
            try
            {
                message = WireCrypto.Open(key, WireCrypto.RequestAad("pair", "pair"), body.Span);
            }
            catch (ProtocolException) { continue; }
            var request = Decode(message.Json, WireJsonContext.Default.PairRequest);
            if (!IsId(request.DeviceId, 16))
            {
                return Error(400, "bad-request");
            }

            var existing = Device(request.DeviceId);
            if (token.UsedBy is not null && (token.UsedBy != request.DeviceId || existing is null))
            {
                return Error(401, "bad-auth");
            }

            var device = existing;
            if (token.UsedBy is null)
            {
                device = new StoredDevice
                {
                    DeviceId = request.DeviceId,
                    Name = Clean(request.Name, 60, "Phone"),
                    Os = Clean(request.Os, 40),
                    Secret = WireCrypto.Base64Url(_options.Random(32)),
                    PairedAt = Now,
                    LastSeen = Now,
                    LastAddr = remoteAddress,
                };
            }

            ArgumentNullException.ThrowIfNull(device);
            if (token.UsedBy is null)
            {
                await SaveAsync(_snapshot with
                {
                    Devices = [.. _snapshot.Devices.Where(item => item.DeviceId != device.DeviceId), device]
                }, cancellationToken).ConfigureAwait(false);
                _tokens = [.. _tokens.Select(item => ReferenceEquals(item.Bytes, token.Bytes) ? item with { UsedBy = device.DeviceId } : item)];
            }
            var response = new PairResponse { Secret = device.Secret, HubId = _snapshot.HubId, Name = _snapshot.Name };
            return new HubReply(200, "application/octet-stream", WireCrypto.Seal(key, WireCrypto.ResponseAad("pair", message.Iv), Serialize(response, WireJsonContext.Default.PairResponse)).Body);
        }
        return Error(401, "bad-auth");
    }

    public Task<PairCodeResponse> NewPairCodeAsync(CancellationToken cancellationToken = default)
    {
        return LockedAsync(() =>
    {
        var token = new Token(_options.Random(16), Now + WireConstants.PairTokenTtlMs, null);
        _tokens = [.. _tokens.Where(item => item.ExpiresAt > Now).Append(token).TakeLast(5)];
        var payload = PairingPayload.Encode(new PairingCode(_snapshot.HubId, token.Bytes, _options.Port, Addresses(), _snapshot.Name));
        return Task.FromResult(new PairCodeResponse { Payload = payload, Link = PairingPayload.Link(payload), ExpiresAt = token.ExpiresAt });
    }, cancellationToken);
    }
}
