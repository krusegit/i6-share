using System.Text.Json.Serialization;

namespace I6Share.Contracts.Tests;

internal sealed record Renamed
{
    [JsonPropertyName("customName")]
    public required string Name
    {
        get; init;
    }
}
internal sealed record Unsupported
{
    public required DateTime Value
    {
        get; init;
    }
}
internal sealed record UnsupportedCollection
{
    public required Dictionary<string, string> Value
    {
        get; init;
    }
}
internal sealed record InvalidLiteral
{
    [WireLiteral("invalid")]
    public required int Value
    {
        get; init;
    }
}
internal sealed record Recursive
{
    public Recursive? Child
    {
        get; init;
    }
}
