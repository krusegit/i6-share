namespace I6Share.Contracts;

public static class WireConstants
{
    public const int ProtocolVersion = 1;
    public const int Port = 47616;
    public const int ChunkSize = 4 * 1024 * 1024;
    public const int MaxBody = ChunkSize + (64 * 1024);
    public const int SyncWaitMs = 25_000;
    public const int PairTokenTtlMs = 10 * 60 * 1000;
    public const string AppUrl = "https://krusegit.github.io/i6-share/";
}

[AttributeUsage(AttributeTargets.Class)]
public sealed class WireContractAttribute : Attribute;

[AttributeUsage(AttributeTargets.Class, AllowMultiple = true)]
public sealed class WireOperationAttribute(string name, Type responseType) : Attribute
{
    public string Name { get; } = name;
    public Type ResponseType { get; } = responseType;
}

[AttributeUsage(AttributeTargets.Property)]
public sealed class WireLiteralAttribute(string value) : Attribute
{
    public string Value { get; } = value;
}
