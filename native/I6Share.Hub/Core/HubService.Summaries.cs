using I6Share.Contracts;
using I6Share.Hub.Storage;

namespace I6Share.Hub.Core;

internal sealed partial class HubService
{
    private IncomingTransferSummary Summary(Incoming transfer)
    {
        return new()
        {
            Tid = transfer.Tid,
            DeviceId = transfer.DeviceId,
            DeviceName = _snapshot.Devices.Single(device => device.DeviceId == transfer.DeviceId).Name,
            Files = [.. transfer.Files.Select(file => new TransferFileSummary { Name = file.Name, OriginalName = file.Metadata.Name, Size = file.Metadata.Size, Type = file.Metadata.Type, Bytes = file.Bytes, Done = file.Done, Where = file.Where })],
            Count = transfer.Files.Length,
            Done = transfer.Files.Count(file => file.Done),
            Bytes = transfer.Files.Sum(file => file.Bytes),
            Total = transfer.Files.Sum(file => file.Metadata.Size),
            Complete = transfer.Files.All(file => file.Done),
            Speed = transfer.Speed,
            CreatedAt = transfer.CreatedAt,
            LastActivity = transfer.LastActivity,
        };
    }

    private OutboxSummary Summary(StoredOutbox outgoing)
    {
        var progress = _outProgress.GetValueOrDefault(outgoing.Tid);
        var total = outgoing.Files.Sum(file => file.Size);
        return new OutboxSummary
        {
            Tid = outgoing.Tid,
            DeviceId = outgoing.DeviceId,
            CreatedAt = outgoing.CreatedAt,
            Files = [.. outgoing.Files.Select(FileMetadata)],
            Count = outgoing.Files.Length,
            Bytes = Math.Min(total, progress?.Sent ?? 0),
            Total = total,
            Speed = progress?.Speed ?? 0,
            Started = progress is not null,
        };
    }
    public Task<AdminStatusResponse> GetStatusAsync(CancellationToken cancellationToken = default)
    {
        return LockedAsync(() => Task.FromResult(new AdminStatusResponse
        {
            HubId = _snapshot.HubId,
            Name = _snapshot.Name,
            ReceiveDirectory = _snapshot.ReceiveDirectory,
            Port = _options.Port,
            Addrs = Addresses(),
            Devices = [.. _snapshot.Devices.OrderBy(device => device.PairedAt).Select(device => new DeviceSummary { DeviceId = device.DeviceId, Name = device.Name, Os = device.Os, PairedAt = device.PairedAt, LastSeen = device.LastSeen, LastAddr = device.LastAddr, Online = Now - device.LastSeen < OnlineMs })],
            Transfers = [.. _incoming.Values.OrderBy(transfer => transfer.CreatedAt).Select(Summary)],
            Outbox = [.. _snapshot.Outbox.Select(Summary)],
            History = [.. _snapshot.Received.Select(item => new ReceivedFileSummary { Tid = item.Tid, DeviceId = item.DeviceId, DeviceName = item.DeviceName, Name = item.Name, OriginalName = item.OriginalName, Size = item.Size, Type = item.Type, Where = item.Where, At = item.At })],
        }), cancellationToken);
    }
}
