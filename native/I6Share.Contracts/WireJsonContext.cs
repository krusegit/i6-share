using System.Text.Json.Serialization;

namespace I6Share.Contracts;

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    RespectNullableAnnotations = true,
    GenerationMode = JsonSourceGenerationMode.Metadata)]
[JsonSerializable(typeof(FileMetadata))]
[JsonSerializable(typeof(OfferedFileMetadata))]
[JsonSerializable(typeof(OutboxEntry))]
[JsonSerializable(typeof(HelloResponse))]
[JsonSerializable(typeof(PairRequest))]
[JsonSerializable(typeof(PairResponse))]
[JsonSerializable(typeof(SyncRequest))]
[JsonSerializable(typeof(SyncResponse))]
[JsonSerializable(typeof(OfferRequest))]
[JsonSerializable(typeof(OfferResponse))]
[JsonSerializable(typeof(PutRequest))]
[JsonSerializable(typeof(PutResponse))]
[JsonSerializable(typeof(TransferRequest))]
[JsonSerializable(typeof(PullRequest))]
[JsonSerializable(typeof(PullResponse))]
[JsonSerializable(typeof(UnpairRequest))]
[JsonSerializable(typeof(OperationResponse))]
[JsonSerializable(typeof(ErrorResponse))]
[JsonSerializable(typeof(DeviceSummary))]
[JsonSerializable(typeof(TransferFileSummary))]
[JsonSerializable(typeof(IncomingTransferSummary))]
[JsonSerializable(typeof(OutboxSummary))]
[JsonSerializable(typeof(ReceivedFileSummary))]
[JsonSerializable(typeof(AdminStatusResponse))]
[JsonSerializable(typeof(PairCodeResponse))]
[JsonSerializable(typeof(AdminSettingsRequest))]
[JsonSerializable(typeof(QueueFilesRequest))]
[JsonSerializable(typeof(QueueFilesResponse))]
public partial class WireJsonContext : JsonSerializerContext;
