namespace I6Share.TypeGen;

internal static class Program
{
    public static int Main(string[] args)
    {
        return GeneratorCli.Run(args, Directory.GetCurrentDirectory(), Console.Out, Console.Error);
    }
}
