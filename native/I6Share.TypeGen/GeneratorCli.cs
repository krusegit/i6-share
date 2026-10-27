namespace I6Share.TypeGen;

internal static class GeneratorCli
{
    public static int Run(IReadOnlyList<string> args, string workingDirectory, TextWriter output, TextWriter error)
    {
        var check = false;
        var destination = Path.Combine(workingDirectory, "public", "generated", "contracts.ts");
        for (var index = 0; index < args.Count; index++)
        {
            if (args[index] == "--check")
            {
                check = true;
            }
            else if (args[index] == "--output" && index + 1 < args.Count)
            {
                destination = Path.GetFullPath(args[++index], workingDirectory);
            }
            else
            {
                error.WriteLine("Usage: I6Share.TypeGen [--check] [--output path]");
                return 2;
            }
        }
        try
        {
            var generated = TypeScriptGenerator.Generate();
            if (check)
            {
                if (!File.Exists(destination) || File.ReadAllText(destination) != generated)
                {
                    error.WriteLine($"Generated contracts are stale: {destination}. Run npm run typegen.");
                    return 1;
                }
                output.WriteLine("Generated contracts are current.");
                return 0;
            }
            var parent = Path.GetDirectoryName(destination);
            if (parent is not null)
            {
                _ = Directory.CreateDirectory(parent);
            }

            File.WriteAllText(destination, generated);
            output.WriteLine($"Generated {destination}");
            return 0;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or InvalidOperationException)
        {
            error.WriteLine(exception.Message);
            return 1;
        }
    }
}
