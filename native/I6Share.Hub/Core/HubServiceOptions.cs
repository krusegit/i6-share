namespace I6Share.Hub.Core;

internal sealed record HubServiceOptions
{
    public required string DataDirectory
    {
        get; init;
    }
    public required string ReceiveDirectory
    {
        get; init;
    }
    public string Name { get; init; } = "Linux PC";
    public int Port { get; init; } = 47616;
    public Func<DateTimeOffset> Clock { get; init; } = () => DateTimeOffset.UtcNow;
    public Func<IReadOnlyList<string>> Addresses { get; init; } = () => [];
    public Func<int, byte[]> Random { get; init; } = System.Security.Cryptography.RandomNumberGenerator.GetBytes;
    public long PartialTtlMs { get; init; } = 3_600_000;
}

internal sealed record HubReply(int Status, string ContentType, byte[] Body);

internal sealed class HubOperationException(int status, string code, Exception? innerException = null) : Exception(code, innerException)
{
    public int Status { get; } = status;
    public string Code { get; } = code;

    public HubOperationException() : this(500, "internal") { }
    public HubOperationException(string message) : this(500, message) { }
    public HubOperationException(string message, Exception innerException) : this(500, message, innerException) { }
}
