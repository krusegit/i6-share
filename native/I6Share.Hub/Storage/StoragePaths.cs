namespace I6Share.Hub.Storage;

internal static class StoragePaths
{
    internal static void CreatePrivateDirectory(string path)
    {
        _ = Directory.CreateDirectory(path, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
    }

    internal static FileStreamOptions PrivateFileOptions(FileMode mode, FileAccess access)
    {
        return new FileStreamOptions
        {
            Mode = mode,
            Access = access,
            Share = FileShare.None,
            Options = FileOptions.Asynchronous,
            UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite,
        };
    }

    // FlushAsync drains managed buffers; the separate fsync is required for durable renames.
    internal static void FlushToDisk(FileStream stream)
    {
        stream.Flush(flushToDisk: true);
    }

    internal static void RejectLink(string path)
    {
        if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
        {
            throw new IOException("Symbolic links are not allowed inside hub storage.");
        }
    }
}
