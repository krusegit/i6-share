using System.Collections.Immutable;
using System.Text.Json.Serialization;

namespace I6Share.Hub.Storage;

internal sealed record StoredDevice
{
    public required string DeviceId
    {
        get; init;
    }
    public required string Name
    {
        get; init;
    }
    public required string Os
    {
        get; init;
    }
    public required string Secret
    {
        get; init;
    }
    public required long PairedAt
    {
        get; init;
    }
    public required long LastSeen
    {
        get; init;
    }
    public required string LastAddr
    {
        get; init;
    }
}

internal sealed record CompletedTransfer
{
    public required string Key
    {
        get; init;
    }
    public required long At
    {
        get; init;
    }
    public required ImmutableArray<long> Sizes
    {
        get; init;
    }
    public required ImmutableArray<string> Names
    {
        get; init;
    }
    public required ImmutableArray<bool> Saved
    {
        get; init;
    }
    public required ImmutableArray<string?> Where
    {
        get; init;
    }
}

internal sealed record StoredFile
{
    public required string Name
    {
        get; init;
    }
    public required long Size
    {
        get; init;
    }
    public required string Type
    {
        get; init;
    }
    public required long LastModified
    {
        get; init;
    }
    public required string StorageName
    {
        get; init;
    }
}

internal sealed record StoredOutbox
{
    public required string Tid
    {
        get; init;
    }
    public required string DeviceId
    {
        get; init;
    }
    public required long CreatedAt
    {
        get; init;
    }
    public required ImmutableArray<StoredFile> Files
    {
        get; init;
    }
}

internal sealed record StoredReceived
{
    public required string Name
    {
        get; init;
    }
    public required string OriginalName
    {
        get; init;
    }
    public required long Size
    {
        get; init;
    }
    public required string Type
    {
        get; init;
    }
    public required string DeviceId
    {
        get; init;
    }
    public required string DeviceName
    {
        get; init;
    }
    public required string Tid
    {
        get; init;
    }
    public required string Where
    {
        get; init;
    }
    public required long At
    {
        get; init;
    }
}

internal sealed record HubSnapshot
{
    public int Version { get; init; } = 1;
    public required string HubId
    {
        get; init;
    }
    public required string Name
    {
        get; init;
    }
    public required string ReceiveDirectory
    {
        get; init;
    }
    public ImmutableArray<StoredDevice> Devices { get; init; } = [];
    public ImmutableArray<CompletedTransfer> Completed { get; init; } = [];
    public ImmutableArray<StoredOutbox> Outbox { get; init; } = [];
    public ImmutableArray<StoredReceived> Received { get; init; } = [];
}

internal sealed record OutboxUpload(string Name, string Type, long LastModified, Stream Content);

internal interface IHubStore : IAsyncDisposable
{
    string DataDirectory
    {
        get;
    }
    Task<HubSnapshot> LoadAsync(string initialReceiveDir, string initialName, CancellationToken cancellationToken = default);
    Task SaveAsync(HubSnapshot snapshot, CancellationToken cancellationToken = default);
    Task<StoredOutbox> ImportOutboxAsync(string tid, string deviceId, IReadOnlyList<OutboxUpload> files, long createdAt, CancellationToken cancellationToken = default);
    Stream OpenOutboxRead(string tid, StoredFile file);
    void DeleteOutboxFiles(string tid);
}

internal interface ITransferSink : IAsyncDisposable
{
    string DirectoryPath
    {
        get;
    }
    string ReserveName(string originalName);
    void ReleaseName(string reservedName);
    Task<IPendingFile> CreateAsync(string reservedName, CancellationToken cancellationToken = default);
}

internal interface IPendingFile : IAsyncDisposable
{
    string Name
    {
        get;
    }
    string FilePath
    {
        get;
    }
    Task WriteAsync(ReadOnlyMemory<byte> bytes, CancellationToken cancellationToken = default);
    Task CompleteAsync(CancellationToken cancellationToken = default);
    Task AbortAsync();
}

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    RespectNullableAnnotations = true, RespectRequiredConstructorParameters = true,
    UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow, WriteIndented = true)]
[JsonSerializable(typeof(HubSnapshot))]
internal sealed partial class StorageJsonContext : JsonSerializerContext;
