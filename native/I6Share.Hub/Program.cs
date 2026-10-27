using I6Share.Hub.Hosting;

namespace I6Share.Hub;

internal static class Program
{
    public static Task<int> Main(string[] args)
    {
        return HubApplication.RunAsync(args, Console.Out, Console.Error);
    }
}
