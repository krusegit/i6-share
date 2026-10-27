using System.Collections.Immutable;
using I6Share.Contracts;
using I6Share.Hub.Storage;

namespace I6Share.Hub.Core;

internal sealed partial class HubService
{
    private static FileMetadata Metadata(OfferedFileMetadata offered)
    {
        return offered is null || offered.Size < 0 || offered.Size > MaxSafeInteger
            ? throw Bad()
            : new FileMetadata { Name = Clean(offered.Name, 1000, "file"), Size = offered.Size, Type = (offered.Type ?? "")[..Math.Min(offered.Type?.Length ?? 0, 200)], LastModified = offered.LastModified ?? 0 };
    }
    private Incoming GetTransfer(string key)
    {
        return _incoming.GetValueOrDefault(key) ?? throw new HubOperationException(404, "not-found");
    }

    private IncomingFile GetFile(string key, int index)
    {
        var transfer = GetTransfer(key);
        return index < transfer.Files.Length ? transfer.Files[index] : throw Bad();
    }
    private void SetFile(string key, int index, IncomingFile file)
    {
        var transfer = GetTransfer(key);
        _incoming = _incoming.SetItem(key, transfer with
        {
            Files = transfer.Files.SetItem(index, file)
        });
    }
    private void Touch(string key)
    {
        var transfer = GetTransfer(key);
        _incoming = _incoming.SetItem(key, transfer with
        {
            LastActivity = Now
        });
    }

    private async Task<WireReply> OfferAsync(StoredDevice device, OfferRequest request, CancellationToken cancellationToken)
    {
        var tid = Tid(request.Tid);
        if (request.Files.Count is < 1 or > 10_000)
        {
            throw Bad();
        }

        var metadata = request.Files.Select(Metadata).ToImmutableArray();
        if (metadata.Sum(file => (decimal)file.Size) > MaxSafeInteger)
        {
            throw Bad();
        }

        var key = $"{device.DeviceId}:{tid}";
        if (_incoming.TryGetValue(key, out var existing))
        {
            if (existing.Files.Length != metadata.Length || existing.Files.Where((file, index) => file.Metadata.Size != metadata[index].Size).Any())
            {
                throw Bad();
            }

            Touch(key);
        }
        else
        {
            var prior = _snapshot.Completed.FirstOrDefault(item => item.Key == key && Now - item.At < LogTtlMs && item.Sizes.SequenceEqual(metadata.Select(file => file.Size)));
            var files = ImmutableArray.CreateBuilder<IncomingFile>(metadata.Length);
            try
            {
                for (var index = 0; index < metadata.Length; index++)
                {
                    var file = metadata[index];
                    if (prior is not null && prior.Saved[index])
                    {
                        files.Add(new IncomingFile(file, prior.Names[index], file.Size, true, prior.Where[index], null));
                    }
                    else
                    {
                        files.Add(new IncomingFile(file, _sink.ReserveName(file.Name), 0, false, null, null));
                    }
                }
            }
            catch
            {
                foreach (var file in files.Where(file => !file.Done))
                {
                    _sink.ReleaseName(file.Name);
                }

                throw;
            }
            var incoming = new Incoming(key, tid, device.DeviceId, device.Name, Now, Now, files.ToImmutable(), 0, Now, files.Sum(file => file.Bytes));
            _incoming = _incoming.Add(key, incoming);
        }
        for (var index = 0; index < metadata.Length; index++)
        {
            var file = GetFile(key, index);
            if (!file.Done && file.Metadata.Size == 0)
            {
                await FinalizeAsync(key, index, cancellationToken).ConfigureAwait(false);
            }
        }
        return Reply(new OfferResponse { Received = [.. GetTransfer(key).Files.Select(file => file.Bytes)] }, WireJsonContext.Default.OfferResponse);
    }

    private async Task<WireReply> PutAsync(StoredDevice device, PutRequest request, byte[] bytes, CancellationToken cancellationToken)
    {
        var key = $"{device.DeviceId}:{Tid(request.Tid)}";
        if (request.I < 0 || request.Offset < 0 || request.Offset > MaxSafeInteger)
        {
            throw Bad();
        }

        if (bytes.Length > WireConstants.ChunkSize)
        {
            throw new HubOperationException(413, "too-large");
        }

        var file = GetFile(key, request.I);
        if (request.Offset != file.Bytes)
        {
            return Reply(new PutResponse { Bytes = file.Bytes, Error = "offset" }, WireJsonContext.Default.PutResponse);
        }

        if (file.Done)
        {
            return Reply(new PutResponse { Bytes = file.Bytes }, WireJsonContext.Default.PutResponse);
        }

        if (bytes.Length == 0)
        {
            if (file.Metadata.Size == 0)
            {
                await FinalizeAsync(key, request.I, cancellationToken).ConfigureAwait(false);
            }

            return Reply(new PutResponse { Bytes = file.Bytes }, WireJsonContext.Default.PutResponse);
        }
        if (file.Bytes + bytes.Length > file.Metadata.Size)
        {
            throw Bad();
        }

        Touch(key);
        try
        {
            var pending = file.Pending ?? await _sink.CreateAsync(file.Name, cancellationToken).ConfigureAwait(false);
            SetFile(key, request.I, file with
            {
                Pending = pending,
                Where = pending.FilePath
            });
            await pending.WriteAsync(bytes, cancellationToken).ConfigureAwait(false);
            SetFile(key, request.I, GetFile(key, request.I) with
            {
                Bytes = file.Bytes + bytes.Length
            });
        }
        catch
        {
            await ResetFileAsync(key, request.I).ConfigureAwait(false);
            throw;
        }
        if (file.Bytes + bytes.Length == file.Metadata.Size)
        {
            await FinalizeAsync(key, request.I, cancellationToken).ConfigureAwait(false);
        }

        var transfer = GetTransfer(key);
        var total = transfer.Files.Sum(entry => entry.Bytes);
        var elapsed = Now - transfer.RateAt;
        if (elapsed >= 500)
        {
            var rate = Math.Max(0, total - transfer.RateBytes) * 1000d / elapsed;
            _incoming = _incoming.SetItem(key, transfer with
            {
                Speed = transfer.Speed == 0 ? rate : (transfer.Speed * .6) + (rate * .4),
                RateAt = Now,
                RateBytes = total
            });
        }
        return Reply(new PutResponse { Bytes = GetFile(key, request.I).Bytes }, WireJsonContext.Default.PutResponse);
    }

    private async Task ResetFileAsync(string key, int index)
    {
        var file = GetFile(key, index);
        SetFile(key, index, file with
        {
            Pending = null,
            Bytes = 0,
            Done = false
        });
        if (file.Pending is not null)
        {
            await file.Pending.AbortAsync().ConfigureAwait(false);
            await file.Pending.DisposeAsync().ConfigureAwait(false);
        }

        _sink.ReleaseName(file.Name);
        SetFile(key, index, GetFile(key, index) with
        {
            Name = _sink.ReserveName(file.Metadata.Name),
            Where = null
        });
    }

    private async Task FinalizeAsync(string key, int index, CancellationToken cancellationToken)
    {
        var file = GetFile(key, index);
        string finalPath;
        try
        {
            var pending = file.Pending ?? await _sink.CreateAsync(file.Name, cancellationToken).ConfigureAwait(false);
            SetFile(key, index, file with
            {
                Pending = pending,
                Where = pending.FilePath
            });
            await pending.CompleteAsync(cancellationToken).ConfigureAwait(false);
            await pending.DisposeAsync().ConfigureAwait(false);
            finalPath = pending.FilePath;
            SetFile(key, index, GetFile(key, index) with
            {
                Done = true,
                Pending = null
            });
            _sink.ReleaseName(file.Name);
        }
        catch
        {
            await ResetFileAsync(key, index).ConfigureAwait(false);
            throw;
        }
        var transfer = GetTransfer(key);
        var saved = transfer.Files[index];
        var completed = new CompletedTransfer
        {
            Key = key,
            At = Now,
            Sizes = [.. transfer.Files.Select(item => item.Metadata.Size)],
            Names = [.. transfer.Files.Select(item => item.Name)],
            Saved = [.. transfer.Files.Select(item => item.Done)],
            Where = [.. transfer.Files.Select(item => item.Where)],
        };
        var history = new StoredReceived
        {
            Tid = transfer.Tid,
            DeviceId = transfer.DeviceId,
            DeviceName = _snapshot.Devices.Single(device => device.DeviceId == transfer.DeviceId).Name,
            Name = saved.Name,
            OriginalName = saved.Metadata.Name,
            Size = saved.Metadata.Size,
            Type = saved.Metadata.Type,
            Where = finalPath,
            At = Now,
        };
        await SaveAsync(_snapshot with
        {
            Completed = [.. _snapshot.Completed.Where(item => item.Key != key && Now - item.At < LogTtlMs).Append(completed).TakeLast(300)],
            Received = [.. _snapshot.Received.Insert(0, history).Take(100)],
        }, cancellationToken).ConfigureAwait(false);
    }

    private async Task DiscardAsync(string key)
    {
        if (!_incoming.TryGetValue(key, out var transfer))
        {
            return;
        }

        foreach (var file in transfer.Files.Where(file => !file.Done))
        {
            if (file.Pending is not null)
            {
                await file.Pending.AbortAsync().ConfigureAwait(false);
                await file.Pending.DisposeAsync().ConfigureAwait(false);
            }

            _sink.ReleaseName(file.Name);
        }
        _incoming = _incoming.Remove(key);
    }

    public Task SweepAsync(CancellationToken cancellationToken = default)
    {
        return LockedAsync(async () =>
    {
        _tokens = [.. _tokens.Where(token => token.ExpiresAt > Now)];
        foreach (var transfer in _incoming.Values.Where(transfer => Now - transfer.LastActivity > _options.PartialTtlMs).ToArray())
        {
            await DiscardAsync(transfer.Key).ConfigureAwait(false);
        }

        return true;
    }, cancellationToken);
    }
}
