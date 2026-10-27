using System.Text.Json.Serialization;

namespace I6Share.Contracts;

[WireContract]
public sealed record DeviceSummary
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
    public required bool Online
    {
        get; init;
    }
}

[WireContract]
public sealed record TransferFileSummary
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
    public required long Bytes
    {
        get; init;
    }
    public required bool Done
    {
        get; init;
    }
    [JsonIgnore(Condition = JsonIgnoreCondition.Never)]
    public required string? Where
    {
        get; init;
    }
}

[WireContract]
public sealed record IncomingTransferSummary
{
    public required string Tid
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
    public required IReadOnlyList<TransferFileSummary> Files
    {
        get; init;
    }
    public required int Count
    {
        get; init;
    }
    public required int Done
    {
        get; init;
    }
    public required long Bytes
    {
        get; init;
    }
    public required long Total
    {
        get; init;
    }
    public required bool Complete
    {
        get; init;
    }
    public required double Speed
    {
        get; init;
    }
    public required long CreatedAt
    {
        get; init;
    }
    public required long LastActivity
    {
        get; init;
    }
}

[WireContract]
public sealed record OutboxSummary
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
    public required IReadOnlyList<FileMetadata> Files
    {
        get; init;
    }
    public required int Count
    {
        get; init;
    }
    public required long Bytes
    {
        get; init;
    }
    public required long Total
    {
        get; init;
    }
    public required double Speed
    {
        get; init;
    }
    public required bool Started
    {
        get; init;
    }
}

[WireContract]
public sealed record ReceivedFileSummary
{
    public required string Tid
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
    [JsonIgnore(Condition = JsonIgnoreCondition.Never)]
    public required string? Where
    {
        get; init;
    }
    public required long At
    {
        get; init;
    }
}

[WireContract]
public sealed record AdminStatusResponse
{
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
    public required int Port
    {
        get; init;
    }
    public required IReadOnlyList<string> Addrs
    {
        get; init;
    }
    public required IReadOnlyList<DeviceSummary> Devices
    {
        get; init;
    }
    public required IReadOnlyList<IncomingTransferSummary> Transfers
    {
        get; init;
    }
    public required IReadOnlyList<OutboxSummary> Outbox
    {
        get; init;
    }
    public required IReadOnlyList<ReceivedFileSummary> History
    {
        get; init;
    }
}

[WireContract]
public sealed record PairCodeResponse
{
    public required string Payload
    {
        get; init;
    }
    public required string Link
    {
        get; init;
    }
    public required long ExpiresAt
    {
        get; init;
    }
}

[WireContract]
public sealed record AdminSettingsRequest
{
    public string? Name
    {
        get; init;
    }
    public string? ReceiveDirectory
    {
        get; init;
    }
}

[WireContract]
public sealed record QueueFilesRequest
{
    public required string DeviceId
    {
        get; init;
    }
    public required IReadOnlyList<string> Paths
    {
        get; init;
    }
}

[WireContract]
public sealed record QueueFilesResponse
{
    public required string Tid
    {
        get; init;
    }
}
