export type PlayerKind = "iina" | "mpv" | "mpvnet" | "vlc" | "potplayer" | "mpc-hc" | "mpc-be";
export type Platform = "darwin" | "win32" | "linux";
export type AppPage = "home" | "library" | "settings" | "setup";
export type SettingsPage = "players" | "appearance" | "servers" | "diagnostics" | "about";
export interface Server {
  id: string;
  name: string;
  url: string;
  providerId: string;
}
export interface ServerCredentials {
  username: string;
  password: string;
}
export interface ServerInput {
  id?: string;
  name: string;
  url: string;
  providerId: string;
  // Omission keeps saved credentials when the server address is unchanged.
  credentials?: ServerCredentials;
}
export interface ServerConnectionInput {
  id?: string;
  url: string;
  providerId: string;
  credentials?: ServerCredentials;
}
export interface ServerConnectionResult {
  serverName: string;
  authenticated: boolean;
  logoutFailed?: boolean;
}
export interface Player {
  id: string;
  name: string;
  kind: PlayerKind;
  executable: string;
  prefixArgs: string[];
  manual?: boolean;
}
export interface Settings {
  servers: Server[];
  activeServerId?: string;
  players: Player[];
  defaultPlayerId?: string;
  autoNext: boolean;
  fullscreen: boolean;
  theme: "system" | "dark" | "light";
  language: import("./i18n").Language;
  setupCompleted: boolean;
  playerScanCompleted: boolean;
}
export interface PlaybackItem {
  id: string;
  title: string;
  seriesTitle?: string;
  providerData?: unknown;
}
export interface PlaybackSource {
  id: string;
  name?: string;
  providerData?: unknown;
}
export interface PlayIntent {
  itemIds: string[];
  startIndex?: number;
  startTicks?: number;
  mediaSourceId?: string;
  audioIndex?: number;
  subtitleIndex?: number;
  shuffle?: boolean;
  expand?: boolean;
}
export interface PreparedMedia {
  item: PlaybackItem;
  source: PlaybackSource;
  playSessionId: string;
  url: string;
  startSeconds: number;
  runTimeTicks?: number;
  audioId?: number;
  subtitleId?: number | "no";
  audioStreamIndex?: number;
  subtitleStreamIndex?: number;
  subtitleUrl?: string;
  headers: Record<string, string>;
}
export type PlaybackRecord =
  | {
      status: "verified";
      position: number;
      reportedPosition: number;
      played: boolean;
      playCount?: number;
      lastPlayedAt?: string;
      minimumResumeSeconds?: number;
    }
  | { status: "unavailable" };
export interface PlaybackState {
  status: "idle" | "preparing" | "playing" | "paused" | "error";
  title?: string;
  playerName?: string;
  position: number;
  duration: number;
  queue: { id: string; title: string }[];
  index: number;
  error?: string;
  syncError?: string;
  sync?: {
    status: "pending" | "success" | "error";
    event: "start" | "progress" | "stop";
    time?: string;
    error?: string;
    record?: PlaybackRecord;
  };
}
export interface Diagnostics {
  version: string;
  platform: string;
  arch: string;
  osRelease: string;
  electron: string;
  chromium: string;
  node: string;
  locale: string;
  theme: string;
  credentialsAvailable: boolean;
  serverCount: number;
  webStatus: AppState["webStatus"];
  adapterStatus?: AppState["adapterStatus"];
  playback: Pick<
    PlaybackState,
    "status" | "position" | "duration" | "error" | "syncError" | "sync"
  >;
  players: { name: string; kind: PlayerKind; default: boolean }[];
  logs: { time: string; message: string }[];
}
export interface AppState {
  settings: Settings;
  playback: PlaybackState;
  platform: Platform;
  version: string;
  webStatus: "closed" | "loading" | "ready" | "error";
  webError?: string;
  credentialsAvailable: boolean;
  serverFavicons: Record<string, string>;
  adapterStatus?: "waiting" | "sign-in" | "ready" | "error";
  locale: import("./i18n").Locale;
  providers: { id: string; name: string }[];
  page: AppPage;
  settingsPage: SettingsPage;
  playbackPopupOpen: boolean;
  serverPopupOpen: boolean;
  playbackSource?: { serverId: string; itemId: string };
  browser: { url: string; serverId?: string; canGoBack: boolean; canGoForward: boolean };
  fullscreen: boolean;
}
export type PlaybackControl =
  | { action: "pause" | "next" | "previous" | "stop" }
  | { action: "seek"; seconds: number }
  | { action: "jump"; index: number };
export interface DesktopAPI {
  getState(): Promise<AppState>;
  saveServer(server: ServerInput): Promise<AppState>;
  getServerCredentials(this: void, id: string): Promise<ServerCredentials | null>;
  testServerConnection(this: void, server: ServerConnectionInput): Promise<ServerConnectionResult>;
  removeServer(id: string): Promise<AppState>;
  openServer(id: string): Promise<AppState>;
  showPage(page: AppPage, section?: SettingsPage): Promise<void>;
  togglePlaybackPopup(anchor: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): Promise<void>;
  hidePlaybackPopup(): Promise<void>;
  toggleServerPopup(anchor: { x: number; y: number; width: number; height: number }): Promise<void>;
  hideServerPopup(): Promise<void>;
  addServer(): Promise<void>;
  openPlaybackItem(): Promise<void>;
  showError(visible: boolean): Promise<void>;
  discoverPlayers(): Promise<AppState>;
  choosePlayer(kind: PlayerKind): Promise<AppState>;
  updateSettings(
    settings: Partial<
      Pick<
        Settings,
        "defaultPlayerId" | "autoNext" | "fullscreen" | "theme" | "language" | "setupCompleted"
      >
    >,
  ): Promise<AppState>;
  control(control: PlaybackControl): Promise<void>;
  surfaceReady(surface: "servers" | "playback"): Promise<void>;
  navigate(action: "back" | "forward" | "reload" | "stop" | "home"): Promise<void>;
  resetSession(id: string): Promise<AppState>;
  openGuide(kind: PlayerKind): Promise<void>;
  exportDiagnostics(): Promise<string | null>;
  getDiagnostics(): Promise<Diagnostics>;
  copyDiagnostics(): Promise<void>;
  openLink(target: "product" | "github" | "issue"): Promise<void>;
  onState(callback: (state: AppState) => void): () => void;
  onAddServer(callback: () => void): () => void;
}
