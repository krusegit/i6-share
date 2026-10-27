namespace I6Share.Contracts;

[WireContract]
public sealed record FileMetadata
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
}

[WireContract]
public sealed record OfferedFileMetadata
{
    public string? Name
    {
        get; init;
    }
    public required long Size
    {
        get; init;
    }
    public string? Type
    {
        get; init;
    }
    public long? LastModified
    {
        get; init;
    }
}

[WireContract]
public sealed record OutboxEntry
{
    public required string Tid
    {
        get; init;
    }
    public required IReadOnlyList<FileMetadata> Files
    {
        get; init;
    }
}

[WireContract]
public sealed record HelloResponse
{
    [WireLiteral("i6-share-hub")]
    public required string App
    {
        get; init;
    }
    public required int V
    {
        get; init;
    }
    public required string Id
    {
        get; init;
    }
    public required string Name
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
}

[WireContract]
[WireOperation("pair", typeof(PairResponse))]
public sealed record PairRequest
{
    public required string DeviceId
    {
        get; init;
    }
    public string? Name
    {
        get; init;
    }
    public string? Os
    {
        get; init;
    }
}

[WireContract]
public sealed record PairResponse
{
    public required string Secret
    {
        get; init;
    }
    public required string HubId
    {
        get; init;
    }
    public required string Name
    {
        get; init;
    }
}

[WireContract]
[WireOperation("sync", typeof(SyncResponse))]
public sealed record SyncRequest
{
    public int? Wait
    {
        get; init;
    }
    public string? Name
    {
        get; init;
    }
    public string? Os
    {
        get; init;
    }
}

[WireContract]
public sealed record SyncResponse
{
    public required string Name
    {
        get; init;
    }
    public required IReadOnlyList<string> Addrs
    {
        get; init;
    }
    public required IReadOnlyList<OutboxEntry> Outbox
    {
        get; init;
    }
}

[WireContract]
[WireOperation("offer", typeof(OfferResponse))]
public sealed record OfferRequest
{
    public required string Tid
    {
        get; init;
    }
    public required IReadOnlyList<OfferedFileMetadata> Files
    {
        get; init;
    }
}

[WireContract]
public sealed record OfferResponse
{
    public required IReadOnlyList<long> Received
    {
        get; init;
    }
}

[WireContract]
[WireOperation("put", typeof(PutResponse))]
public sealed record PutRequest
{
    public required string Tid
    {
        get; init;
    }
    public required int I
    {
        get; init;
    }
    public required long Offset
    {
        get; init;
    }
}

[WireContract]
public sealed record PutResponse
{
    public required long Bytes
    {
        get; init;
    }
    public string? Error
    {
        get; init;
    }
}

[WireContract]
[WireOperation("end", typeof(OperationResponse))]
[WireOperation("cancel", typeof(OperationResponse))]
[WireOperation("pulled", typeof(OperationResponse))]
public sealed record TransferRequest
{
    public required string Tid
    {
        get; init;
    }
}

[WireContract]
[WireOperation("pull", typeof(PullResponse))]
public sealed record PullRequest
{
    public required string Tid
    {
        get; init;
    }
    public required int I
    {
        get; init;
    }
    public required long Offset
    {
        get; init;
    }
    public required int Length
    {
        get; init;
    }
}

[WireContract]
public sealed record PullResponse
{
    public required long Size
    {
        get; init;
    }
}

[WireContract]
[WireOperation("unpair", typeof(OperationResponse))]
public sealed record UnpairRequest;

[WireContract]
public sealed record OperationResponse
{
    public required bool Ok
    {
        get; init;
    }
}

[WireContract]
public sealed record ErrorResponse
{
    public required string Error
    {
        get; init;
    }
}
