using System.Collections.Immutable;
using System.Text.Json;
using I6Share.Contracts;
using I6Share.Hub.Storage;

namespace I6Share.Hub.Core;

internal sealed partial class HubService
{
    private void Wake(string deviceId)
    {
        foreach (var waiter in _waiters.GetValueOrDefault(deviceId, []))
        {
            _ = waiter.TrySetResult();
        }
    }

    private async Task<WireReply> SyncAsync(StoredDevice device, SyncRequest request, CancellationToken cancellationToken)
    {
        var updated = device with
        {
            Name = request.Name is null ? device.Name : Clean(request.Name, 60, device.Name),
            Os = request.Os is null ? device.Os : Clean(request.Os, 40)
        };
        if (updated != device)
        {
            await SaveAsync(_snapshot with
            {
                Devices = [.. _snapshot.Devices.Select(item => item.DeviceId == device.DeviceId ? updated : item)]
            }, cancellationToken).ConfigureAwait(false);
        }

        var wait = Math.Clamp(request.Wait ?? 0, 0, WireConstants.SyncWaitMs);
        if (wait > 0 && !_snapshot.Outbox.Any(item => item.DeviceId == device.DeviceId))
        {
            var waiter = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            _waiters = _waiters.SetItem(device.DeviceId, _waiters.GetValueOrDefault(device.DeviceId, []).Add(waiter));
            _ = _gate.Release();
            try
            {
                _ = await Task.WhenAny(waiter.Task, _stopping.Task).WaitAsync(TimeSpan.FromMilliseconds(wait), cancellationToken).ConfigureAwait(false);
            }
            catch (TimeoutException) { }
            finally
            {
                // Complete WhenAny after timeout/cancellation so it detaches from the hub lifetime.
                _ = waiter.TrySetResult();
                await _gate.WaitAsync(CancellationToken.None).ConfigureAwait(false);
                var remaining = _waiters.GetValueOrDefault(device.DeviceId, []).Remove(waiter);
                _waiters = remaining.Count == 0 ? _waiters.Remove(device.DeviceId) : _waiters.SetItem(device.DeviceId, remaining);
            }
        }
        if (_disposed)
        {
            throw new HubOperationException(503, "unavailable");
        }

        var current = Device(device.DeviceId) ?? throw new HubOperationException(401, "unknown-device");
        PutDevice(current with
        {
            LastSeen = Now
        });
        return Reply(new SyncResponse
        {
            Name = _snapshot.Name,
            Addrs = Addresses(),
            Outbox = [.. _snapshot.Outbox.Where(item => item.DeviceId == device.DeviceId).Select(item => new OutboxEntry { Tid = item.Tid, Files = [.. item.Files.Select(FileMetadata)] })],
        }, WireJsonContext.Default.SyncResponse);
    }

    private async Task<WireReply> OperateAsync(string operation, StoredDevice device, JsonElement json, byte[] binary, CancellationToken cancellationToken)
    {
        switch (operation)
        {
            case "offer":
                return await OfferAsync(device, Decode(json, WireJsonContext.Default.OfferRequest), cancellationToken).ConfigureAwait(false);
            case "put":
                return await PutAsync(device, Decode(json, WireJsonContext.Default.PutRequest), binary, cancellationToken).ConfigureAwait(false);
            case "pull":
                return await PullAsync(device, Decode(json, WireJsonContext.Default.PullRequest), cancellationToken).ConfigureAwait(false);
            case "end":
                {
                    var key = $"{device.DeviceId}:{Tid(Decode(json, WireJsonContext.Default.TransferRequest).Tid)}";
                    if (_incoming.TryGetValue(key, out var transfer))
                    {
                        Touch(key);
                        return Okay(transfer.Files.All(file => file.Done));
                    }
                    var completed = _snapshot.Completed.FirstOrDefault(item => item.Key == key);
                    return completed is null ? throw new HubOperationException(404, "not-found") : Okay(completed.Saved.All(saved => saved));
                }
            case "cancel":
                await DiscardAsync($"{device.DeviceId}:{Tid(Decode(json, WireJsonContext.Default.TransferRequest).Tid)}").ConfigureAwait(false);
                return Okay();
            case "pulled":
                {
                    var tid = Tid(Decode(json, WireJsonContext.Default.TransferRequest).Tid);
                    if (_snapshot.Outbox.Any(item => item.Tid == tid && item.DeviceId == device.DeviceId))
                    {
                        _ = await RemoveOutgoingAsync(tid, cancellationToken).ConfigureAwait(false);
                    }

                    return Okay();
                }
            default:
                _ = await RevokeCoreAsync(device.DeviceId, cancellationToken).ConfigureAwait(false);
                return Okay();
        }
    }

    private static FileMetadata FileMetadata(StoredFile file)
    {
        return new()
        {
            Name = file.Name,
            Size = file.Size,
            Type = file.Type,
            LastModified = file.LastModified
        };
    }

    private async Task<WireReply> PullAsync(StoredDevice device, PullRequest request, CancellationToken cancellationToken)
    {
        var tid = Tid(request.Tid);
        if (request.I < 0 || request.Offset < 0 || request.Offset > MaxSafeInteger || request.Length < 0 || request.Length > WireConstants.ChunkSize)
        {
            throw Bad();
        }

        var outgoing = _snapshot.Outbox.FirstOrDefault(item => item.Tid == tid && item.DeviceId == device.DeviceId) ?? throw new HubOperationException(404, "not-found");
        if (request.I >= outgoing.Files.Length)
        {
            throw Bad();
        }

        var file = outgoing.Files[request.I];
        if (request.Offset > file.Size)
        {
            throw Bad();
        }

        var stream = _store.OpenOutboxRead(tid, file);
        await using var streamLease = stream.ConfigureAwait(false);
        _ = stream.Seek(request.Offset, SeekOrigin.Begin);
        var bytes = new byte[(int)Math.Min(file.Size - request.Offset, request.Length)];
        await stream.ReadExactlyAsync(bytes, cancellationToken).ConfigureAwait(false);
        var before = outgoing.Files.Take(request.I).Sum(item => item.Size);
        var sent = before + request.Offset + bytes.Length;
        var prior = _outProgress.GetValueOrDefault(tid) ?? new OutProgress(0, 0, Now, before + request.Offset);
        var elapsed = Now - prior.RateAt;
        var rate = elapsed >= 500 ? Math.Max(0, sent - prior.RateBytes) * 1000d / elapsed : 0;
        _outProgress = _outProgress.SetItem(tid, elapsed >= 500
            ? new OutProgress(sent, prior.Speed == 0 ? rate : (prior.Speed * .6) + (rate * .4), Now, sent)
            : prior with
            {
                Sent = sent
            });
        return Reply(new PullResponse { Size = file.Size }, WireJsonContext.Default.PullResponse, bytes);
    }

    private async Task<bool> RemoveOutgoingAsync(string tid, CancellationToken cancellationToken)
    {
        if (!_snapshot.Outbox.Any(item => item.Tid == tid))
        {
            return false;
        }

        await SaveAsync(_snapshot with
        {
            Outbox = [.. _snapshot.Outbox.Where(item => item.Tid != tid)]
        }, cancellationToken).ConfigureAwait(false);
        _outProgress = _outProgress.Remove(tid);
        _store.DeleteOutboxFiles(tid);
        return true;
    }

    private async Task<bool> RevokeCoreAsync(string deviceId, CancellationToken cancellationToken)
    {
        if (Device(deviceId) is null)
        {
            return false;
        }

        var outgoing = _snapshot.Outbox.Where(item => item.DeviceId == deviceId).ToArray();
        await SaveAsync(_snapshot with
        {
            Devices = [.. _snapshot.Devices.Where(item => item.DeviceId != deviceId)],
            Outbox = [.. _snapshot.Outbox.Where(item => item.DeviceId != deviceId)]
        }, cancellationToken).ConfigureAwait(false);
        _tokens = [.. _tokens.Where(token => token.UsedBy != deviceId)];
        _lastPersisted = _lastPersisted.Remove(deviceId);
        foreach (var transfer in _incoming.Values.Where(item => item.DeviceId == deviceId).ToArray())
        {
            await DiscardAsync(transfer.Key).ConfigureAwait(false);
        }

        foreach (var item in outgoing)
        {
            _outProgress = _outProgress.Remove(item.Tid);
            _store.DeleteOutboxFiles(item.Tid);
        }
        Wake(deviceId);
        return true;
    }

    public Task<bool> RevokeAsync(string deviceId, CancellationToken cancellationToken = default)
    {
        return LockedAsync(() => RevokeCoreAsync(deviceId, cancellationToken), cancellationToken);
    }

    public Task<bool> CancelOutboxAsync(string tid, CancellationToken cancellationToken = default)
    {
        return LockedAsync(() => RemoveOutgoingAsync(tid, cancellationToken), cancellationToken);
    }

    public Task<string> QueueFilesAsync(string deviceId, IReadOnlyList<string> paths, CancellationToken cancellationToken = default)
    {
        return LockedAsync(async () =>
    {
        if (Device(deviceId) is null)
        {
            throw new HubOperationException(404, "unknown-device");
        }

        if (paths.Count is < 1 or > 10_000)
        {
            throw Bad();
        }

        var uploads = new List<OutboxUpload>();
        string tid;
        try
        {
            foreach (var path in paths)
            {
                var file = new FileInfo(path);
                uploads.Add(new OutboxUpload(file.Name, "application/octet-stream", new DateTimeOffset(file.LastWriteTimeUtc).ToUnixTimeMilliseconds(), file.OpenRead()));
            }
            tid = RandomId(12);
            var outgoing = await _store.ImportOutboxAsync(tid, deviceId, uploads, Now, cancellationToken).ConfigureAwait(false);
            try
            {
                await SaveAsync(_snapshot with
                {
                    Outbox = _snapshot.Outbox.Add(outgoing)
                }, cancellationToken).ConfigureAwait(false);
            }
            catch { _store.DeleteOutboxFiles(tid); throw; }
            Wake(deviceId);
        }
        finally
        {
            foreach (var upload in uploads)
            {
                await upload.Content.DisposeAsync().ConfigureAwait(false);
            }
        }
        return tid;
    }, cancellationToken);
    }

    public Task SetSettingsAsync(string? name, string? receiveDirectory, CancellationToken cancellationToken = default)
    {
        return LockedAsync(async () =>
    {
        var nextName = name is null ? _snapshot.Name : Clean(name, 40, "Linux PC");
        var directory = receiveDirectory is null ? _snapshot.ReceiveDirectory : Path.GetFullPath(receiveDirectory);
        if (directory == _snapshot.ReceiveDirectory)
        {
            await SaveAsync(_snapshot with
            {
                Name = nextName
            }, cancellationToken).ConfigureAwait(false);
            return true;
        }
        if (_incoming.Values.Any(transfer => transfer.Files.Any(file => !file.Done)))
        {
            throw new HubOperationException(409, "transfers-active");
        }

        var sink = _sinkFactory(directory);
        try
        {
            await SaveAsync(_snapshot with
            {
                Name = nextName,
                ReceiveDirectory = directory
            }, cancellationToken).ConfigureAwait(false);
        }
        catch { await sink.DisposeAsync().ConfigureAwait(false); throw; }
        var old = _sink;
        _sink = sink;
        await old.DisposeAsync().ConfigureAwait(false);
        return true;
    }, cancellationToken);
    }

}
