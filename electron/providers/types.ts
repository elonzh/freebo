import type {
  Server,
  PlayIntent,
  PlaybackItem,
  PlaybackSource,
  PreparedMedia,
  PlaybackRecord,
  ServerCredentials,
  ServerConnectionResult,
} from "../../src/shared/types";
import { UserFacingError, type MessageKey } from "../../src/shared/i18n";
export class ServerAccessError extends UserFacingError {
  constructor(key: MessageKey, code: number) {
    super(key, { code });
  }
}
export interface BrowserClientIdentity {
  deviceId: string;
  deviceName: string;
}
export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
/** A server adapter owns authentication, its wire types and progress reporting. */
export interface PlaybackClient {
  readonly identity: string;
  itemUrl?(itemId: string): Promise<string>;
  resolveQueue(intent: PlayIntent): Promise<PlaybackItem[]>;
  prepare(
    item: PlaybackItem,
    intent: PlayIntent,
    source?: PlaybackSource,
    tracks?: Pick<PreparedMedia, "audioStreamIndex" | "subtitleStreamIndex">,
  ): Promise<PreparedMedia>;
  report(
    media: PreparedMedia,
    event: "start" | "progress" | "stop",
    position: number,
    paused?: boolean,
  ): Promise<PlaybackRecord | void>;
}
export interface MediaServerProvider {
  readonly id: string;
  readonly name: string;
  readonly preload: string;
  readonly adapterScript: string;
  readonly supportsCredentials?: boolean;
  normalizeUrl(input: string): string;
  testConnection?(
    url: string,
    credentials: ServerCredentials | undefined,
    fetcher: Fetcher,
    identity: BrowserClientIdentity,
  ): Promise<ServerConnectionResult>;
  entryUrl(server: Server, home?: boolean): string;
  parsePlayback(
    input: unknown,
    server: Server,
  ): { intent: PlayIntent; createClient(fetcher: Fetcher): PlaybackClient };
}
