using System.Collections.Immutable;
using System.Text;
using System.Text.Json.Nodes;
using I6Share.Hub.Storage;

namespace I6Share.Hub.Tests;

public sealed partial class StorageTests
{
    [Fact]
    public async Task IdentityAndAllStateSurviveRestartWithoutChangingSecrets()
    {
        using var directory = new StorageDirectory();
        HubSnapshot snapshot;
        var store = new FileHubStore(directory.Data);
        await using (store.ConfigureAwait(true))
        {
            snapshot = await store.LoadAsync(directory.Receive, "  Computer  ");
            Assert.Matches("^[0-9a-f]{16}$", snapshot.HubId);
            Assert.Equal("Computer", snapshot.Name);
            var device = Device();
            var outgoing = await store.ImportOutboxAsync(Tid, device.DeviceId, [new OutboxUpload("photo.jpg", "image/jpeg", 123, new MemoryStream([1, 2, 3]))], 456);
            snapshot = snapshot with
            {
                Devices = [device],
                Outbox = [outgoing],
                Completed = [new CompletedTransfer { Key = device.DeviceId + ":" + Tid, At = 50, Sizes = [3, 0], Names = ["photo.jpg", "empty"], Saved = [true, false], Where = [directory.Receive, null] }],
                Received = [new StoredReceived { Name = "photo.jpg", OriginalName = "photo.jpg", Size = 3, Type = "image/jpeg", DeviceId = device.DeviceId, DeviceName = device.Name, Tid = Tid, Where = directory.Receive, At = 50 }],
            };
            await store.SaveAsync(snapshot);
            _ = Assert.Throws<IOException>(() => new FileHubStore(directory.Data));
            Assert.Equal(UnixFileMode.UserRead | UnixFileMode.UserWrite, File.GetUnixFileMode(Path.Combine(directory.Data, "state.json")));
        }
        var reopened = new FileHubStore(directory.Data);
        await using var reopenedLifetime = reopened.ConfigureAwait(true);
        var loaded = await reopened.LoadAsync("/ignored", "ignored");
        Assert.Equal(snapshot.HubId, loaded.HubId);
        Assert.Equal(snapshot.Name, loaded.Name);
        Assert.Equal(snapshot.Devices.ToArray(), loaded.Devices.ToArray());
        Assert.Equal([.. snapshot.Completed[0].Saved], [.. loaded.Completed[0].Saved]);
        Assert.Equal(snapshot.Received.ToArray(), loaded.Received.ToArray());
        Assert.Equal(snapshot.Outbox[0].Files[0], loaded.Outbox[0].Files[0]);
        using var stream = reopened.OpenOutboxRead(Tid, loaded.Outbox[0].Files[0]);
        using var data = new MemoryStream();
        await stream.CopyToAsync(data);
        Assert.Equal(new byte[] { 1, 2, 3 }, data.ToArray());
    }

    [Fact]
    public async Task FirstLaunchDefaultsNameAndCancelledSavePreservesExistingState()
    {
        using var directory = new StorageDirectory();
        var store = new FileHubStore(directory.Data);
        await using var storeLifetime = store.ConfigureAwait(true);
        var initial = await store.LoadAsync(directory.Receive, " \t");
        Assert.Equal("Linux PC", initial.Name);
        _ = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => store.SaveAsync(initial with { Name = "Changed" }, new CancellationToken(true)));
        Assert.Equal("Linux PC", (await store.LoadAsync(directory.Receive, "ignored")).Name);
        Assert.Empty(Directory.GetFiles(directory.Data, ".state-*.tmp"));
        await store.DisposeAsync();
        await store.DisposeAsync();
        _ = await Assert.ThrowsAsync<ObjectDisposedException>(() => store.LoadAsync(directory.Receive, "name"));
        _ = await Assert.ThrowsAsync<ObjectDisposedException>(() => store.SaveAsync(initial));
        _ = await Assert.ThrowsAsync<ObjectDisposedException>(() => store.ImportOutboxAsync(Tid, DeviceId, [], 1));
        _ = Assert.Throws<ObjectDisposedException>(() => store.DeleteOutboxFiles(Tid));
        _ = Assert.Throws<ObjectDisposedException>(() => store.OpenOutboxRead(Tid, StoredFile()));
    }

    [Fact]
    public async Task CorruptStateIsNeverSilentlyReplaced()
    {
        using var directory = new StorageDirectory();
        var store = new FileHubStore(directory.Data);
        await using var storeLifetime = store.ConfigureAwait(true);
        var path = Path.Combine(directory.Data, "state.json");
        await File.WriteAllTextAsync(path, "{broken");
        var error = await Assert.ThrowsAsync<InvalidDataException>(() => store.LoadAsync(directory.Receive, "name"));
        _ = Assert.IsType<System.Text.Json.JsonException>(error.InnerException);
        Assert.Equal("{broken", await File.ReadAllTextAsync(path));
        await File.WriteAllTextAsync(path, "null");
        _ = await Assert.ThrowsAsync<InvalidDataException>(() => store.LoadAsync(directory.Receive, "name"));
    }

    [Theory]
    [InlineData("version", "2")]
    [InlineData("hubId", "\"bad\"")]
    [InlineData("hubId", "\"GGGGGGGGGGGGGGGG\"")]
    [InlineData("name", "\" \"")]
    [InlineData("receiveDirectory", "\"relative\"")]
    [InlineData("devices", "null")]
    [InlineData("completed", "null")]
    [InlineData("outbox", "null")]
    [InlineData("received", "null")]
    [InlineData("devices", "[null]")]
    [InlineData("completed", "[null]")]
    [InlineData("outbox", "[null]")]
    [InlineData("received", "[null]")]
    public async Task InvalidSnapshotIsRejected(string property, string value)
    {
        using var directory = new StorageDirectory();
        var store = new FileHubStore(directory.Data);
        await using var storeLifetime = store.ConfigureAwait(true);
        _ = await store.LoadAsync(directory.Receive, "name");
        var path = Path.Combine(directory.Data, "state.json");
        var json = JsonNode.Parse(await File.ReadAllTextAsync(path)) ?? throw new InvalidOperationException();
        json[property] = JsonNode.Parse(value);
        await File.WriteAllTextAsync(path, json.ToJsonString());
        _ = await Assert.ThrowsAsync<InvalidDataException>(() => store.LoadAsync(directory.Receive, "name"));
    }

    [Fact]
    public async Task InvalidDeviceLogAndOutboxSnapshotsCannotBeSaved()
    {
        using var directory = new StorageDirectory();
        var store = new FileHubStore(directory.Data);
        await using var storeLifetime = store.ConfigureAwait(true);
        var state = await store.LoadAsync(directory.Receive, "name");
        foreach (var devices in new ImmutableArray<StoredDevice>[] { [Device() with { DeviceId = "bad" }], [Device() with { Secret = "bad" }], [Device() with { Secret = new string('!', 43) }], [Device(), Device()] })
        {
            _ = await Assert.ThrowsAsync<InvalidDataException>(() => store.SaveAsync(state with { Devices = devices }));
        }

        var log = new CompletedTransfer { Key = "key", At = 0, Sizes = [1], Names = ["one"], Saved = [true], Where = [null] };
        foreach (var invalid in new[] { log with { Sizes = default }, log with { Names = default }, log with { Saved = default }, log with { Where = default }, log with { Names = [] }, log with { Saved = [] }, log with { Where = [] }, log with { Sizes = [-1] } })
        {
            _ = await Assert.ThrowsAsync<InvalidDataException>(() => store.SaveAsync(state with { Completed = [invalid] }));
        }

        var item = new StoredOutbox { Tid = Tid, DeviceId = DeviceId, CreatedAt = 1, Files = [StoredFile()] };
        foreach (var invalid in new[] { item with { Tid = "bad" }, item with { DeviceId = "bad" }, item with { Files = [] }, item with { Files = [StoredFile() with { Size = -1 }] }, item with { Files = [StoredFile() with { StorageName = "../unsafe" }] } })
        {
            _ = await Assert.ThrowsAsync<InvalidDataException>(() => store.SaveAsync(state with { Outbox = [invalid] }));
        }

        _ = await Assert.ThrowsAsync<InvalidDataException>(() => store.SaveAsync(state with { Outbox = [item, item] }));
        var received = new StoredReceived { Name = "name", OriginalName = "original", Size = -1, Type = "", DeviceId = DeviceId, DeviceName = "phone", Tid = Tid, Where = "folder", At = 0 };
        _ = await Assert.ThrowsAsync<InvalidDataException>(() => store.SaveAsync(state with { Received = [received] }));
        foreach (var invalid in new[] { state with { Devices = default }, state with { Completed = default }, state with { Outbox = default }, state with { Received = default } })
        {
            _ = await Assert.ThrowsAsync<InvalidDataException>(() => store.SaveAsync(invalid));
        }

        Assert.Equal("name", (await store.LoadAsync(directory.Receive, "ignored")).Name);
    }

    [Fact]
    public async Task OutboxImportsCopyBytesAndKeepCallerStreamsOpen()
    {
        using var directory = new StorageDirectory();
        var store = new FileHubStore(directory.Data);
        await using var storeLifetime = store.ConfigureAwait(true);
        using var source = new MemoryStream(Encoding.UTF8.GetBytes("hello"));
        var outgoing = await store.ImportOutboxAsync(Tid, DeviceId, [new OutboxUpload("../note.txt", "text/plain", 12, source), new OutboxUpload("empty", "", 0, Stream.Null)], 100);
        Assert.True(source.CanRead);
        Assert.Equal(5, outgoing.Files[0].Size);
        Assert.Equal("_note.txt", outgoing.Files[0].Name);
        Assert.Equal(0, outgoing.Files[1].Size);
        _ = await Assert.ThrowsAsync<IOException>(() => store.ImportOutboxAsync(Tid, DeviceId, [new OutboxUpload("one", "", 0, Stream.Null)], 0));
        Assert.Empty(Directory.GetDirectories(Path.Combine(directory.Data, "outbox"), ".import-*"));
        foreach (var bad in new[] { "../bad", new string('G', 24) })
        {
            _ = Assert.Throws<ArgumentException>(() => store.OpenOutboxRead(bad, outgoing.Files[0]));
            _ = Assert.Throws<ArgumentException>(() => store.DeleteOutboxFiles(bad));
            _ = await Assert.ThrowsAsync<ArgumentException>(() => store.ImportOutboxAsync(bad, DeviceId, [], 0));
        }
        _ = await Assert.ThrowsAsync<ArgumentException>(() => store.ImportOutboxAsync(Tid, "bad", [], 0));
        _ = await Assert.ThrowsAsync<ArgumentException>(() => store.ImportOutboxAsync(Tid, DeviceId, [], 0));
        foreach (var bad in new[] { "bad", "000000.txt", "xxxxxx.bin" })
        {
            _ = Assert.Throws<InvalidDataException>(() => store.OpenOutboxRead(Tid, outgoing.Files[0] with { StorageName = bad }));
        }

        store.DeleteOutboxFiles(Tid);
        store.DeleteOutboxFiles(Tid);
        Assert.False(Directory.Exists(Path.Combine(directory.Data, "outbox", Tid)));
        _ = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => store.ImportOutboxAsync(Tid, DeviceId, [new OutboxUpload("cancelled", "", 0, Stream.Null)], 0, new CancellationToken(true)));
        Assert.Empty(Directory.GetDirectories(Path.Combine(directory.Data, "outbox"), ".import-*"));
    }
    private const string DeviceId = "0123456789abcdef";
    private const string Tid = "0123456789abcdef01234567";
    private static StoredDevice Device()
    {
        return new()
        {
            DeviceId = DeviceId,
            Name = "Phone",
            Os = "Android",
            Secret = "abcdefghijklmnopqrstuvwxyz0123456789_______",
            PairedAt = 1,
            LastSeen = 2,
            LastAddr = "127.0.0.1"
        };
    }

    private static StoredFile StoredFile()
    {
        return new()
        {
            Name = "file",
            Size = 0,
            Type = "",
            LastModified = 0,
            StorageName = "000000.bin"
        };
    }
}
