// Generated from I6Share.Contracts. Run npm run typegen; do not edit.
import { Schema } from 'effect';

export const WireConstants = {
  appUrl: "https://krusegit.github.io/i6-share/",
  chunkSize: 4194304,
  maxBody: 4259840,
  pairTokenTtlMs: 600000,
  port: 47616,
  protocolVersion: 1,
  syncWaitMs: 25000,
} as const;

export interface AdminSettingsRequest {
  readonly "name"?: string | null;
  readonly "receiveDirectory"?: string | null;
}
export const AdminSettingsRequestSchema = Schema.Struct({
  "name": Schema.optionalKey(Schema.NullOr(Schema.String)),
  "receiveDirectory": Schema.optionalKey(Schema.NullOr(Schema.String)),
}) satisfies Schema.Codec<AdminSettingsRequest>;

export interface DeviceSummary {
  readonly "deviceId": string;
  readonly "name": string;
  readonly "os": string;
  readonly "pairedAt": number;
  readonly "lastSeen": number;
  readonly "lastAddr": string;
  readonly "online": boolean;
}
export const DeviceSummarySchema = Schema.Struct({
  "deviceId": Schema.String,
  "name": Schema.String,
  "os": Schema.String,
  "pairedAt": Schema.Number,
  "lastSeen": Schema.Number,
  "lastAddr": Schema.String,
  "online": Schema.Boolean,
}) satisfies Schema.Codec<DeviceSummary>;

export interface TransferFileSummary {
  readonly "name": string;
  readonly "originalName": string;
  readonly "size": number;
  readonly "type": string;
  readonly "bytes": number;
  readonly "done": boolean;
  readonly "where": string | null;
}
export const TransferFileSummarySchema = Schema.Struct({
  "name": Schema.String,
  "originalName": Schema.String,
  "size": Schema.Number,
  "type": Schema.String,
  "bytes": Schema.Number,
  "done": Schema.Boolean,
  "where": Schema.NullOr(Schema.String),
}) satisfies Schema.Codec<TransferFileSummary>;

export interface IncomingTransferSummary {
  readonly "tid": string;
  readonly "deviceId": string;
  readonly "deviceName": string;
  readonly "files": readonly TransferFileSummary[];
  readonly "count": number;
  readonly "done": number;
  readonly "bytes": number;
  readonly "total": number;
  readonly "complete": boolean;
  readonly "speed": number;
  readonly "createdAt": number;
  readonly "lastActivity": number;
}
export const IncomingTransferSummarySchema = Schema.Struct({
  "tid": Schema.String,
  "deviceId": Schema.String,
  "deviceName": Schema.String,
  "files": Schema.Array(TransferFileSummarySchema),
  "count": Schema.Number,
  "done": Schema.Number,
  "bytes": Schema.Number,
  "total": Schema.Number,
  "complete": Schema.Boolean,
  "speed": Schema.Number,
  "createdAt": Schema.Number,
  "lastActivity": Schema.Number,
}) satisfies Schema.Codec<IncomingTransferSummary>;

export interface FileMetadata {
  readonly "name": string;
  readonly "size": number;
  readonly "type": string;
  readonly "lastModified": number;
}
export const FileMetadataSchema = Schema.Struct({
  "name": Schema.String,
  "size": Schema.Number,
  "type": Schema.String,
  "lastModified": Schema.Number,
}) satisfies Schema.Codec<FileMetadata>;

export interface OutboxSummary {
  readonly "tid": string;
  readonly "deviceId": string;
  readonly "createdAt": number;
  readonly "files": readonly FileMetadata[];
  readonly "count": number;
  readonly "bytes": number;
  readonly "total": number;
  readonly "speed": number;
  readonly "started": boolean;
}
export const OutboxSummarySchema = Schema.Struct({
  "tid": Schema.String,
  "deviceId": Schema.String,
  "createdAt": Schema.Number,
  "files": Schema.Array(FileMetadataSchema),
  "count": Schema.Number,
  "bytes": Schema.Number,
  "total": Schema.Number,
  "speed": Schema.Number,
  "started": Schema.Boolean,
}) satisfies Schema.Codec<OutboxSummary>;

export interface ReceivedFileSummary {
  readonly "tid": string;
  readonly "deviceId": string;
  readonly "deviceName": string;
  readonly "name": string;
  readonly "originalName": string;
  readonly "size": number;
  readonly "type": string;
  readonly "where": string | null;
  readonly "at": number;
}
export const ReceivedFileSummarySchema = Schema.Struct({
  "tid": Schema.String,
  "deviceId": Schema.String,
  "deviceName": Schema.String,
  "name": Schema.String,
  "originalName": Schema.String,
  "size": Schema.Number,
  "type": Schema.String,
  "where": Schema.NullOr(Schema.String),
  "at": Schema.Number,
}) satisfies Schema.Codec<ReceivedFileSummary>;

export interface AdminStatusResponse {
  readonly "hubId": string;
  readonly "name": string;
  readonly "receiveDirectory": string;
  readonly "port": number;
  readonly "addrs": readonly string[];
  readonly "devices": readonly DeviceSummary[];
  readonly "transfers": readonly IncomingTransferSummary[];
  readonly "outbox": readonly OutboxSummary[];
  readonly "history": readonly ReceivedFileSummary[];
}
export const AdminStatusResponseSchema = Schema.Struct({
  "hubId": Schema.String,
  "name": Schema.String,
  "receiveDirectory": Schema.String,
  "port": Schema.Number,
  "addrs": Schema.Array(Schema.String),
  "devices": Schema.Array(DeviceSummarySchema),
  "transfers": Schema.Array(IncomingTransferSummarySchema),
  "outbox": Schema.Array(OutboxSummarySchema),
  "history": Schema.Array(ReceivedFileSummarySchema),
}) satisfies Schema.Codec<AdminStatusResponse>;

export interface ErrorResponse {
  readonly "error": string;
}
export const ErrorResponseSchema = Schema.Struct({
  "error": Schema.String,
}) satisfies Schema.Codec<ErrorResponse>;

export interface HelloResponse {
  readonly "app": "i6-share-hub";
  readonly "v": number;
  readonly "id": string;
  readonly "name": string;
  readonly "port": number;
  readonly "addrs": readonly string[];
}
export const HelloResponseSchema = Schema.Struct({
  "app": Schema.Literal("i6-share-hub"),
  "v": Schema.Number,
  "id": Schema.String,
  "name": Schema.String,
  "port": Schema.Number,
  "addrs": Schema.Array(Schema.String),
}) satisfies Schema.Codec<HelloResponse>;

export interface OfferedFileMetadata {
  readonly "name"?: string | null;
  readonly "size": number;
  readonly "type"?: string | null;
  readonly "lastModified"?: number | null;
}
export const OfferedFileMetadataSchema = Schema.Struct({
  "name": Schema.optionalKey(Schema.NullOr(Schema.String)),
  "size": Schema.Number,
  "type": Schema.optionalKey(Schema.NullOr(Schema.String)),
  "lastModified": Schema.optionalKey(Schema.NullOr(Schema.Number)),
}) satisfies Schema.Codec<OfferedFileMetadata>;

export interface OfferRequest {
  readonly "tid": string;
  readonly "files": readonly OfferedFileMetadata[];
}
export const OfferRequestSchema = Schema.Struct({
  "tid": Schema.String,
  "files": Schema.Array(OfferedFileMetadataSchema),
}) satisfies Schema.Codec<OfferRequest>;

export interface OfferResponse {
  readonly "received": readonly number[];
}
export const OfferResponseSchema = Schema.Struct({
  "received": Schema.Array(Schema.Number),
}) satisfies Schema.Codec<OfferResponse>;

export interface OperationResponse {
  readonly "ok": boolean;
}
export const OperationResponseSchema = Schema.Struct({
  "ok": Schema.Boolean,
}) satisfies Schema.Codec<OperationResponse>;

export interface OutboxEntry {
  readonly "tid": string;
  readonly "files": readonly FileMetadata[];
}
export const OutboxEntrySchema = Schema.Struct({
  "tid": Schema.String,
  "files": Schema.Array(FileMetadataSchema),
}) satisfies Schema.Codec<OutboxEntry>;

export interface PairCodeResponse {
  readonly "payload": string;
  readonly "link": string;
  readonly "expiresAt": number;
}
export const PairCodeResponseSchema = Schema.Struct({
  "payload": Schema.String,
  "link": Schema.String,
  "expiresAt": Schema.Number,
}) satisfies Schema.Codec<PairCodeResponse>;

export interface PairRequest {
  readonly "deviceId": string;
  readonly "name"?: string | null;
  readonly "os"?: string | null;
}
export const PairRequestSchema = Schema.Struct({
  "deviceId": Schema.String,
  "name": Schema.optionalKey(Schema.NullOr(Schema.String)),
  "os": Schema.optionalKey(Schema.NullOr(Schema.String)),
}) satisfies Schema.Codec<PairRequest>;

export interface PairResponse {
  readonly "secret": string;
  readonly "hubId": string;
  readonly "name": string;
}
export const PairResponseSchema = Schema.Struct({
  "secret": Schema.String,
  "hubId": Schema.String,
  "name": Schema.String,
}) satisfies Schema.Codec<PairResponse>;

export interface PullRequest {
  readonly "tid": string;
  readonly "i": number;
  readonly "offset": number;
  readonly "length": number;
}
export const PullRequestSchema = Schema.Struct({
  "tid": Schema.String,
  "i": Schema.Number,
  "offset": Schema.Number,
  "length": Schema.Number,
}) satisfies Schema.Codec<PullRequest>;

export interface PullResponse {
  readonly "size": number;
}
export const PullResponseSchema = Schema.Struct({
  "size": Schema.Number,
}) satisfies Schema.Codec<PullResponse>;

export interface PutRequest {
  readonly "tid": string;
  readonly "i": number;
  readonly "offset": number;
}
export const PutRequestSchema = Schema.Struct({
  "tid": Schema.String,
  "i": Schema.Number,
  "offset": Schema.Number,
}) satisfies Schema.Codec<PutRequest>;

export interface PutResponse {
  readonly "bytes": number;
  readonly "error"?: string | null;
}
export const PutResponseSchema = Schema.Struct({
  "bytes": Schema.Number,
  "error": Schema.optionalKey(Schema.NullOr(Schema.String)),
}) satisfies Schema.Codec<PutResponse>;

export interface QueueFilesRequest {
  readonly "deviceId": string;
  readonly "paths": readonly string[];
}
export const QueueFilesRequestSchema = Schema.Struct({
  "deviceId": Schema.String,
  "paths": Schema.Array(Schema.String),
}) satisfies Schema.Codec<QueueFilesRequest>;

export interface QueueFilesResponse {
  readonly "tid": string;
}
export const QueueFilesResponseSchema = Schema.Struct({
  "tid": Schema.String,
}) satisfies Schema.Codec<QueueFilesResponse>;

export interface SyncRequest {
  readonly "wait"?: number | null;
  readonly "name"?: string | null;
  readonly "os"?: string | null;
}
export const SyncRequestSchema = Schema.Struct({
  "wait": Schema.optionalKey(Schema.NullOr(Schema.Number)),
  "name": Schema.optionalKey(Schema.NullOr(Schema.String)),
  "os": Schema.optionalKey(Schema.NullOr(Schema.String)),
}) satisfies Schema.Codec<SyncRequest>;

export interface SyncResponse {
  readonly "name": string;
  readonly "addrs": readonly string[];
  readonly "outbox": readonly OutboxEntry[];
}
export const SyncResponseSchema = Schema.Struct({
  "name": Schema.String,
  "addrs": Schema.Array(Schema.String),
  "outbox": Schema.Array(OutboxEntrySchema),
}) satisfies Schema.Codec<SyncResponse>;

export interface TransferRequest {
  readonly "tid": string;
}
export const TransferRequestSchema = Schema.Struct({
  "tid": Schema.String,
}) satisfies Schema.Codec<TransferRequest>;

export type UnpairRequest = Readonly<Record<string, never>>;
export const UnpairRequestSchema = Schema.Struct({
}) satisfies Schema.Codec<UnpairRequest>;

export interface WireRequestMap {
  readonly cancel: TransferRequest;
  readonly end: TransferRequest;
  readonly offer: OfferRequest;
  readonly pair: PairRequest;
  readonly pull: PullRequest;
  readonly pulled: TransferRequest;
  readonly put: PutRequest;
  readonly sync: SyncRequest;
  readonly unpair: UnpairRequest;
}
export interface WireResponseMap {
  readonly cancel: OperationResponse;
  readonly end: OperationResponse;
  readonly offer: OfferResponse;
  readonly pair: PairResponse;
  readonly pull: PullResponse;
  readonly pulled: OperationResponse;
  readonly put: PutResponse;
  readonly sync: SyncResponse;
  readonly unpair: OperationResponse;
}
export type WireOperation = keyof WireRequestMap;

export const WireResponseDecoders: { readonly [K in WireOperation]: (input: unknown) => WireResponseMap[K] } = {
  cancel: Schema.decodeUnknownSync(OperationResponseSchema),
  end: Schema.decodeUnknownSync(OperationResponseSchema),
  offer: Schema.decodeUnknownSync(OfferResponseSchema),
  pair: Schema.decodeUnknownSync(PairResponseSchema),
  pull: Schema.decodeUnknownSync(PullResponseSchema),
  pulled: Schema.decodeUnknownSync(OperationResponseSchema),
  put: Schema.decodeUnknownSync(PutResponseSchema),
  sync: Schema.decodeUnknownSync(SyncResponseSchema),
  unpair: Schema.decodeUnknownSync(OperationResponseSchema),
};
