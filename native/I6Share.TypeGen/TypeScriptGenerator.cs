using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using I6Share.Contracts;

namespace I6Share.TypeGen;

internal sealed record WireOperation(string Name, Type Request, Type Response);

internal static class TypeScriptGenerator
{
    public static IReadOnlyList<WireOperation> Operations
    {
        get;
    } = [.. typeof(WireContractAttribute).Assembly.GetTypes()
        .SelectMany(type => type.GetCustomAttributes<WireOperationAttribute>().Select(operation => new WireOperation(operation.Name, type, operation.ResponseType)))
        .OrderBy(operation => operation.Name, StringComparer.Ordinal)];

    public static string Generate()
    {
        return Generate(typeof(WireContractAttribute).Assembly.GetTypes()
        .Where(type => type.IsDefined(typeof(WireContractAttribute))), Operations);
    }

    public static string Generate(IEnumerable<Type> input, IReadOnlyList<WireOperation> operations)
    {
        var types = input.OrderBy(type => type.Name, StringComparer.Ordinal).ToArray();
        if (types.Select(type => type.Name).Distinct(StringComparer.Ordinal).Count() != types.Length)
        {
            throw new InvalidOperationException("Contract type names must be unique.");
        }

        var known = types.ToHashSet();
        var ordered = OrderTypes(types, known);
        var output = new StringBuilder("// Generated from I6Share.Contracts. Run npm run typegen; do not edit.\nimport { Schema } from 'effect';\n\n");
        _ = output.AppendLine("export const WireConstants = {");
        foreach (var field in typeof(WireConstants).GetFields(BindingFlags.Public | BindingFlags.Static).OrderBy(field => field.Name, StringComparer.Ordinal))
        {
            _ = output.Append("  ").Append(JsonNamingPolicy.CamelCase.ConvertName(field.Name)).Append(": ").Append(JsonSerializer.Serialize(field.GetRawConstantValue())).AppendLine(",");
        }

        _ = output.AppendLine("} as const;\n");
        foreach (var type in ordered)
        {
            var properties = Properties(type);
            if (properties.Length == 0)
            {
                _ = output.Append("export type ").Append(type.Name).AppendLine(" = Readonly<Record<string, never>>;");
            }
            else
            {
                _ = output.Append("export interface ").Append(type.Name).AppendLine(" {");
                foreach (var property in properties)
                {
                    var (TypeScript, Schema) = Shape(property, known);
                    _ = output.Append("  readonly ").Append(Name(property)).Append(property.IsDefined(typeof(RequiredMemberAttribute)) ? ": " : "?: ")
                        .Append(TypeScript).AppendLine(";");
                }
                _ = output.AppendLine("}");
            }
            _ = output.Append("export const ").Append(type.Name).AppendLine("Schema = Schema.Struct({");
            foreach (var property in properties)
            {
                var (TypeScript, Schema) = Shape(property, known);
                var expression = property.IsDefined(typeof(RequiredMemberAttribute)) ? Schema : $"Schema.optionalKey({Schema})";
                _ = output.Append("  ").Append(Name(property)).Append(": ").Append(expression).AppendLine(",");
            }
            _ = output.Append("}) satisfies Schema.Codec<").Append(type.Name).AppendLine(">;\n");
        }
        foreach (var operation in operations)
        {
            if (!known.Contains(operation.Request) || !known.Contains(operation.Response))
            {
                throw new InvalidOperationException($"Operation {operation.Name} references an unknown contract.");
            }
        }

        _ = output.AppendLine("export interface WireRequestMap {");
        foreach (var operation in operations)
        {
            _ = output.Append("  readonly ").Append(operation.Name).Append(": ").Append(operation.Request.Name).AppendLine(";");
        }

        _ = output.AppendLine("}\nexport interface WireResponseMap {");
        foreach (var operation in operations)
        {
            _ = output.Append("  readonly ").Append(operation.Name).Append(": ").Append(operation.Response.Name).AppendLine(";");
        }

        _ = output.AppendLine("}\nexport type WireOperation = keyof WireRequestMap;\n");
        _ = output.AppendLine("export const WireResponseDecoders: { readonly [K in WireOperation]: (input: unknown) => WireResponseMap[K] } = {");
        foreach (var operation in operations)
        {
            _ = output.Append("  ").Append(operation.Name).Append(": Schema.decodeUnknownSync(").Append(operation.Response.Name).AppendLine("Schema),");
        }

        _ = output.AppendLine("};");
        return output.ToString().Replace("\r\n", "\n", StringComparison.Ordinal);
    }

    private static PropertyInfo[] Properties(Type type)
    {
        return [.. type.GetProperties(BindingFlags.Public | BindingFlags.Instance).OrderBy(property => property.MetadataToken)];
    }

    private static string Name(PropertyInfo property)
    {
        return JsonSerializer.Serialize(property.GetCustomAttribute<JsonPropertyNameAttribute>()?.Name ?? JsonNamingPolicy.CamelCase.ConvertName(property.Name));
    }

    private static (string TypeScript, string Schema) Shape(PropertyInfo property, HashSet<Type> known)
    {
        var shape = Shape(property.PropertyType, known);
        var literal = property.GetCustomAttribute<WireLiteralAttribute>();
        if (literal is not null)
        {
            if (property.PropertyType != typeof(string))
            {
                throw new InvalidOperationException("Wire literals must be strings.");
            }

            var text = JsonSerializer.Serialize(literal.Value);
            shape = (text, $"Schema.Literal({text})");
        }
        if (!property.PropertyType.IsValueType && new NullabilityInfoContext().Create(property).ReadState == NullabilityState.Nullable)
        {
            shape = (shape.TypeScript + " | null", $"Schema.NullOr({shape.Schema})");
        }

        return shape;
    }

    private static (string TypeScript, string Schema) Shape(Type type, HashSet<Type> known)
    {
        var nullable = Nullable.GetUnderlyingType(type);
        if (nullable is not null)
        {
            var (TypeScript, Schema) = Shape(nullable, known);
            return (TypeScript + " | null", $"Schema.NullOr({Schema})");
        }
        if (type == typeof(string))
        {
            return ("string", "Schema.String");
        }

        if (type == typeof(bool))
        {
            return ("boolean", "Schema.Boolean");
        }

        if (type == typeof(int) || type == typeof(long) || type == typeof(double))
        {
            return ("number", "Schema.Number");
        }

        if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(IReadOnlyList<>))
        {
            var (TypeScript, Schema) = Shape(type.GenericTypeArguments[0], known);
            return ($"readonly {TypeScript}[]", $"Schema.Array({Schema})");
        }
        return known.Contains(type)
            ? ((string TypeScript, string Schema))(type.Name, type.Name + "Schema")
            : throw new InvalidOperationException($"Unsupported contract type: {type}.");
    }

    private static List<Type> OrderTypes(Type[] types, HashSet<Type> known)
    {
        var visited = new HashSet<Type>();
        var active = new HashSet<Type>();
        var result = new List<Type>();
        void Visit(Type type)
        {
            if (visited.Contains(type))
            {
                return;
            }

            if (!active.Add(type))
            {
                throw new InvalidOperationException($"Recursive contract type: {type}.");
            }

            foreach (var property in Properties(type))
            {
                var dependency = property.PropertyType;
                if (dependency.IsGenericType && dependency.GetGenericTypeDefinition() == typeof(IReadOnlyList<>))
                {
                    dependency = dependency.GenericTypeArguments[0];
                }

                if (known.Contains(dependency))
                {
                    Visit(dependency);
                }
            }
            _ = active.Remove(type);
            _ = visited.Add(type);
            result.Add(type);
        }
        foreach (var type in types)
        {
            Visit(type);
        }

        return result;
    }
}
