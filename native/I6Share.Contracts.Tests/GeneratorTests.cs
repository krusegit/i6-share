using System.Reflection;
using System.Text.Json;
using I6Share.TypeGen;

namespace I6Share.Contracts.Tests;

public sealed class GeneratorTests
{
    [Fact]
    public void ContractsGenerateDeterministicallyAndRespectRequiredNullableAndNestedFields()
    {
        var output = TypeScriptGenerator.Generate();
        Assert.Equal(output, TypeScriptGenerator.Generate());
        Assert.Contains("readonly \"name\"?: string | null;", output, StringComparison.Ordinal);
        Assert.Contains("readonly \"where\": string | null;", output, StringComparison.Ordinal);
        Assert.Contains("readonly \"size\": number;", output, StringComparison.Ordinal);
        Assert.Contains("readonly \"files\": readonly FileMetadata[];", output, StringComparison.Ordinal);
        Assert.Contains("Schema.optionalKey(Schema.NullOr(Schema.Number))", output, StringComparison.Ordinal);
        Assert.Contains("Schema.Literal(\"i6-share-hub\")", output, StringComparison.Ordinal);
        Assert.Contains("export type UnpairRequest = Readonly<Record<string, never>>;", output, StringComparison.Ordinal);
        Assert.Contains("readonly unpair: OperationResponse;", output, StringComparison.Ordinal);
        Assert.True(output.IndexOf("export const FileMetadataSchema", StringComparison.Ordinal) < output.IndexOf("export const OutboxEntrySchema", StringComparison.Ordinal));
        Assert.DoesNotContain("\r", output, StringComparison.Ordinal);
    }

    [Fact]
    public void ContractsUseExplicitSourceGeneratedJsonMetadataAndCamelCase()
    {
        var request = new PairRequest { DeviceId = "0123456789abcdef", Name = "Phone" };
        var json = JsonSerializer.Serialize(request, WireJsonContext.Default.PairRequest);
        Assert.Equal(/*lang=json,strict*/ "{\"deviceId\":\"0123456789abcdef\",\"name\":\"Phone\"}", json);
        Assert.Equal(request, JsonSerializer.Deserialize(json, WireJsonContext.Default.PairRequest));
        _ = Assert.Throws<JsonException>(() => JsonSerializer.Deserialize("{}", WireJsonContext.Default.PairRequest));
        _ = Assert.Throws<JsonException>(() => JsonSerializer.Deserialize("{\"deviceId\":null}", WireJsonContext.Default.PairRequest));
        var metadata = new OfferedFileMetadata { Size = 0 };
        Assert.Equal(/*lang=json,strict*/ "{\"size\":0}", JsonSerializer.Serialize(metadata, WireJsonContext.Default.OfferedFileMetadata));
        var item = new TransferFileSummary { Name = "file", OriginalName = "file", Size = 0, Type = "", Bytes = 0, Done = false, Where = null };
        Assert.Contains("\"where\":null", JsonSerializer.Serialize(item, WireJsonContext.Default.TransferFileSummary), StringComparison.Ordinal);
    }

    [Fact]
    public void EveryContractHasSourceGeneratedMetadataAndRoundTrips()
    {
        foreach (var type in typeof(WireConstants).Assembly.GetTypes().Where(type => type.IsDefined(typeof(WireContractAttribute))))
        {
            var instance = Example(type);
            var json = JsonSerializer.Serialize(instance, type, WireJsonContext.Default);
            var deserialized = JsonSerializer.Deserialize(json, type, WireJsonContext.Default);
            Assert.NotNull(deserialized);
            Assert.Equal(json, JsonSerializer.Serialize(deserialized, type, WireJsonContext.Default));
        }
    }

    [Fact]
    public void RenamedPropertiesUseTheJsonPropertyName()
    {
        var output = TypeScriptGenerator.Generate([new Renamed { Name = "custom" }.GetType()], []);
        Assert.Contains("readonly \"customName\": string;", output, StringComparison.Ordinal);
        Assert.Contains("\"customName\": Schema.String", output, StringComparison.Ordinal);
    }

    [Fact]
    public void GeneratorRejectsUnsupportedOrAmbiguousShapes()
    {
        _ = Assert.Throws<InvalidOperationException>(() => TypeScriptGenerator.Generate([new Unsupported { Value = DateTime.UnixEpoch }.GetType()], []));
        _ = Assert.Throws<InvalidOperationException>(() => TypeScriptGenerator.Generate([new UnsupportedCollection { Value = [] }.GetType()], []));
        _ = Assert.Throws<InvalidOperationException>(() => TypeScriptGenerator.Generate([new InvalidLiteral { Value = 1 }.GetType()], []));
        _ = Assert.Throws<InvalidOperationException>(() => TypeScriptGenerator.Generate([new Recursive().GetType()], []));
        _ = Assert.Throws<InvalidOperationException>(() => TypeScriptGenerator.Generate([new FirstDuplicate.Duplicate().GetType(), new SecondDuplicate.Duplicate().GetType()], []));
        _ = Assert.Throws<InvalidOperationException>(() => TypeScriptGenerator.Generate([typeof(PairRequest)], [new WireOperation("pair", typeof(PairRequest), typeof(PairResponse))]));
        _ = Assert.Throws<InvalidOperationException>(() => TypeScriptGenerator.Generate([typeof(PairResponse)], [new WireOperation("pair", typeof(PairRequest), typeof(PairResponse))]));
    }

    [Fact]
    public void GeneratorCommandWritesChecksDriftRejectsUnknownArgumentsAndReportsIoErrors()
    {
        var directory = Path.Combine(Path.GetTempPath(), "i6-contracts-" + Guid.NewGuid().ToString("N"));
        _ = Directory.CreateDirectory(directory);
        try
        {
            using var output = new StringWriter();
            using var error = new StringWriter();
            Assert.Equal(1, GeneratorCli.Run(["--check"], directory, output, error));
            Assert.Equal(0, GeneratorCli.Run([], directory, output, error));
            Assert.Equal(0, GeneratorCli.Run(["--check"], directory, output, error));
            var destination = Path.Combine(directory, "public", "generated", "contracts.ts");
            File.AppendAllText(destination, "stale");
            Assert.Equal(1, GeneratorCli.Run(["--check"], directory, output, error));
            Assert.Equal(0, GeneratorCli.Run(["--output", "nested/output.ts"], directory, output, error));
            Assert.Equal(0, GeneratorCli.Run(["--output", "nested/output.ts", "--check"], directory, output, error));
            Assert.Equal(2, GeneratorCli.Run(["--output"], directory, output, error));
            Assert.Equal(2, GeneratorCli.Run(["--unknown"], directory, output, error));
            Assert.Equal(2, Program.Main(["--unknown"]));
            Assert.Equal(1, GeneratorCli.Run(["--output", directory], directory, output, error));
            Assert.Contains("stale", error.ToString(), StringComparison.Ordinal);
            Assert.Contains("current", output.ToString(), StringComparison.Ordinal);
        }
        finally { Directory.Delete(directory, true); }
    }

    private static object Example(Type type)
    {
        if (type == typeof(string))
        {
            return "sample";
        }

        if (type == typeof(int))
        {
            return 1;
        }

        if (type == typeof(long))
        {
            return 1L;
        }

        if (type == typeof(double))
        {
            return 1d;
        }

        if (type == typeof(bool))
        {
            return true;
        }

        if (Nullable.GetUnderlyingType(type) is { } underlying)
        {
            return Example(underlying);
        }

        if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(IReadOnlyList<>))
        {
            var element = type.GenericTypeArguments[0];
            var values = Array.CreateInstance(element, 1);
            values.SetValue(Example(element), 0);
            return values;
        }
        var instance = Activator.CreateInstance(type) ?? throw new InvalidOperationException("No contract constructor");
        foreach (var property in type.GetProperties())
        {
            property.SetValue(instance, property.GetCustomAttribute<WireLiteralAttribute>()?.Value ?? Example(property.PropertyType));
        }

        return instance;
    }

}
