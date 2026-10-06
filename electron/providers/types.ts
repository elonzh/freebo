import type {
  Server,
  PlayIntent,
  PlaybackItem,
  PlaybackSource,
  PreparedMedia,
  ServerCredentials,
  ServerConnectionResult,
} from "../../src/shared/types";
export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
/** A server adapter owns authentication, its wire types and progress reporting. */
export interface PlaybackClient {
  readonly identity: string;
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
  ): Promise<void>;
}
export interface MediaServerProvider {
  readonly id: string;
  readonly name: string;
  readonly preload: string;
  readonly adapterScript: string;
  normalizeUrl(input: string): string;
  testConnection?(
    url: string,
    credentials: ServerCredentials | undefined,
    fetcher: Fetcher,
    version: string,
  ): Promise<ServerConnectionResult>;
  entryUrl(server: Server, home?: boolean): string;
  itemUrl?(server: Server, itemId: string): string;
  parsePlayback(
    input: unknown,
    server: Server,
  ): { intent: PlayIntent; createClient(fetcher: Fetcher): PlaybackClient };
}
