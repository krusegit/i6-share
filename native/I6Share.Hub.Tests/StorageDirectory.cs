namespace I6Share.Hub.Tests;

internal sealed class StorageDirectory : IDisposable
{
    internal string Root { get; } = Path.Combine(Path.GetTempPath(), "i6-storage-tests-" + Guid.NewGuid().ToString("N"));
    internal string Data => Path.Combine(Root, "data");
    internal string Receive => Path.Combine(Root, "received");
    internal StorageDirectory()
    {
        _ = Directory.CreateDirectory(Root);
    }

    public void Dispose()
    {
        Directory.Delete(Root, recursive: true);
    }
}
