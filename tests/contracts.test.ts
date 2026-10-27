import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import * as C from '../public/generated/contracts.js';
import type { WireResponseMap } from '../public/generated/contracts.js';

const file = { name: 'photo.jpg', size: 123, type: 'image/jpeg', lastModified: 1234 };
const transferFile = { ...file, originalName: file.name, bytes: 0, done: false, where: null };
const device = { deviceId: '0123456789abcdef', name: 'Phone', os: 'android', pairedAt: 1, lastSeen: 2, lastAddr: '192.168.1.2', online: true };
const transfer = { tid: '123', deviceId: device.deviceId, deviceName: device.name, files: [transferFile], count: 1, done: 0, bytes: 0, total: 123, complete: false, speed: 0, createdAt: 1, lastActivity: 2 };
const outbox = { tid: '123', deviceId: device.deviceId, createdAt: 1, files: [file], count: 1, bytes: 0, total: 123, speed: 0, started: false };
const received = { tid: '123', deviceId: device.deviceId, deviceName: device.name, name: file.name, originalName: file.name, size: file.size, type: file.type, where: null, at: 1234 };
const status = { hubId: 'fedcba9876543210', name: 'PC', receiveDirectory: '/home/me/Downloads', port: 47616, addrs: ['192.168.1.1'], devices: [device], transfers: [transfer], outbox: [outbox], history: [received] };

const cases: readonly { readonly name: string; readonly valid: unknown; readonly invalid: unknown; readonly check: (input: unknown) => boolean }[] = [
  { name: 'FileMetadata', check: Schema.is(C.FileMetadataSchema), valid: file, invalid: { ...file, size: '123' } },
  { name: 'OfferedFileMetadata', check: Schema.is(C.OfferedFileMetadataSchema), valid: { size: 0 }, invalid: {} },
  { name: 'OutboxEntry', check: Schema.is(C.OutboxEntrySchema), valid: { tid: '123', files: [file] }, invalid: { tid: '123', files: [{ size: 0 }] } },
  { name: 'HelloResponse', check: Schema.is(C.HelloResponseSchema), valid: { app: 'i6-share-hub', v: 1, id: 'id', name: 'PC', port: 47616, addrs: [] }, invalid: { app: 'other', v: 1, id: 'id', name: 'PC', port: 47616, addrs: [] } },
  { name: 'PairRequest', check: Schema.is(C.PairRequestSchema), valid: { deviceId: 'id' }, invalid: { deviceId: 1 } },
  { name: 'PairResponse', check: Schema.is(C.PairResponseSchema), valid: { secret: 'secret', hubId: 'id', name: 'PC' }, invalid: { secret: 'secret' } },
  { name: 'SyncRequest', check: Schema.is(C.SyncRequestSchema), valid: { wait: 25_000, name: null }, invalid: { wait: 'wait' } },
  { name: 'SyncResponse', check: Schema.is(C.SyncResponseSchema), valid: { name: 'PC', addrs: [], outbox: [] }, invalid: { name: 'PC', addrs: [null], outbox: [] } },
  { name: 'OfferRequest', check: Schema.is(C.OfferRequestSchema), valid: { tid: 'id', files: [{ size: 0 }] }, invalid: { tid: 'id', files: [null] } },
  { name: 'OfferResponse', check: Schema.is(C.OfferResponseSchema), valid: { received: [0, 3] }, invalid: { received: ['0'] } },
  { name: 'PutRequest', check: Schema.is(C.PutRequestSchema), valid: { tid: 'id', i: 0, offset: 0 }, invalid: { tid: 'id', offset: 0 } },
  { name: 'PutResponse', check: Schema.is(C.PutResponseSchema), valid: { bytes: 3, error: 'offset' }, invalid: { bytes: 3, error: true } },
  { name: 'TransferRequest', check: Schema.is(C.TransferRequestSchema), valid: { tid: 'id' }, invalid: { tid: null } },
  { name: 'PullRequest', check: Schema.is(C.PullRequestSchema), valid: { tid: 'id', i: 0, offset: 0, length: 4096 }, invalid: { tid: 'id', i: 0, offset: 0 } },
  { name: 'PullResponse', check: Schema.is(C.PullResponseSchema), valid: { size: 4096 }, invalid: { size: null } },
  { name: 'UnpairRequest', check: Schema.is(C.UnpairRequestSchema), valid: {}, invalid: null },
  { name: 'OperationResponse', check: Schema.is(C.OperationResponseSchema), valid: { ok: false }, invalid: { ok: 'false' } },
  { name: 'ErrorResponse', check: Schema.is(C.ErrorResponseSchema), valid: { error: 'bad-request' }, invalid: {} },
  { name: 'DeviceSummary', check: Schema.is(C.DeviceSummarySchema), valid: device, invalid: { ...device, online: 1 } },
  { name: 'TransferFileSummary', check: Schema.is(C.TransferFileSummarySchema), valid: transferFile, invalid: { ...transferFile, where: 2 } },
  { name: 'IncomingTransferSummary', check: Schema.is(C.IncomingTransferSummarySchema), valid: transfer, invalid: { ...transfer, files: [file] } },
  { name: 'OutboxSummary', check: Schema.is(C.OutboxSummarySchema), valid: outbox, invalid: { ...outbox, started: 0 } },
  { name: 'ReceivedFileSummary', check: Schema.is(C.ReceivedFileSummarySchema), valid: received, invalid: { ...received, where: false } },
  { name: 'AdminStatusResponse', check: Schema.is(C.AdminStatusResponseSchema), valid: status, invalid: { ...status, devices: [{ secret: 'should-not-be-the-only-field' }] } },
  { name: 'PairCodeResponse', check: Schema.is(C.PairCodeResponseSchema), valid: { payload: 'code', link: 'https://example.test#pair=code', expiresAt: 1234 }, invalid: { payload: 'code', link: 'link', expiresAt: null } },
  { name: 'AdminSettingsRequest', check: Schema.is(C.AdminSettingsRequestSchema), valid: { name: 'PC' }, invalid: { receiveDirectory: 5 } },
  { name: 'QueueFilesRequest', check: Schema.is(C.QueueFilesRequestSchema), valid: { deviceId: 'id', paths: ['/tmp/photo.jpg'] }, invalid: { deviceId: 'id', paths: [4] } },
  { name: 'QueueFilesResponse', check: Schema.is(C.QueueFilesResponseSchema), valid: { tid: 'id' }, invalid: {} },
];

describe('C# generated DTO validators', () => {
  it.each(cases)('$name accepts its wire shape and rejects incompatible data', ({ check, valid, invalid }) => {
    expect(check(valid)).toBe(true);
    expect(check(invalid)).toBe(false);
  });

  it('preserves optional and nullable distinctions from C# required/init properties', () => {
    expect(Schema.decodeUnknownSync(C.OfferedFileMetadataSchema)({ size: 0, name: null, type: null, lastModified: null })).toEqual({ size: 0, name: null, type: null, lastModified: null });
    expect(Schema.decodeUnknownSync(C.SyncRequestSchema)({})).toEqual({});
    expect(Schema.is(C.TransferFileSummarySchema)({ ...transferFile, where: undefined })).toBe(false);
    expect(Schema.is(C.TransferFileSummarySchema)({ ...transferFile, where: '/tmp/file' })).toBe(true);
    expect(Schema.decodeUnknownSync(C.PairRequestSchema)({ deviceId: 'id', name: 'Phone', os: 'android' })).toEqual({ deviceId: 'id', name: 'Phone', os: 'android' });
    expect(Schema.decodeUnknownSync(C.PutResponseSchema)({ bytes: 0, error: null })).toEqual({ bytes: 0, error: null });
  });

  it('decodes each encrypted operation using its exact generated response type', () => {
    const responses: WireResponseMap = {
      pair: { secret: 'secret', hubId: 'id', name: 'PC' },
      sync: { name: 'PC', addrs: [], outbox: [] },
      offer: { received: [0] }, put: { bytes: 0 }, end: { ok: true }, cancel: { ok: true },
      pull: { size: 10 }, pulled: { ok: true }, unpair: { ok: true },
    };
    const operations = ['pair', 'sync', 'offer', 'put', 'end', 'cancel', 'pull', 'pulled', 'unpair'] as const;
    for (const operation of operations) {
      expect(C.WireResponseDecoders[operation](responses[operation])).toEqual(responses[operation]);
      expect(() => C.WireResponseDecoders[operation]({})).toThrow();
    }
  });

  it('generates all framing and retry constants from C#', () => {
    expect(C.WireConstants).toEqual({ appUrl: 'https://krusegit.github.io/i6-share/', chunkSize: 4 * 1024 * 1024, maxBody: 4 * 1024 * 1024 + 64 * 1024, pairTokenTtlMs: 600_000, port: 47616, protocolVersion: 1, syncWaitMs: 25_000 });
  });
});
