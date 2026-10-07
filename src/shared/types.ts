export type PlayerKind = "iina" | "mpv" | "mpvnet" | "vlc" | "potplayer" | "mpc-hc" | "mpc-be";
export type Platform = "darwin" | "win32" | "linux";
export type AppPage = "home" | "library" | "settings" | "setup";
export type SettingsPage = "players" | "general" | "servers" | "diagnostics" | "about";
export type AppDirectory = "program" | "data";
export type AppDirectories = Record<AppDirectory, string>;
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
  runInBackground: boolean;
  remindOnClose: boolean;
}
export interface PlaybackItem {
  id: string;
  title: string;
  seriesTitle?: string;
  providerData?: unknown;
  // A following file segment of the same item, independent of the auto-next preference.
  continuation?: boolean;
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
export interface UpdateState {
  status:
    | "disabled"
    | "idle"
    | "checking"
    | "up-to-date"
    | "downloading"
    | "downloaded"
    | "installing"
    | "error";
  reason?: "development" | "unsigned-mac" | "unsupported-package";
  version?: string;
  percent?: number;
}
export interface AppState {
  revision: number;
  settings: Settings;
  playback: PlaybackState;
  platform: Platform;
  version: string;
  updates: UpdateState;
  webStatus: "closed" | "loading" | "ready" | "error";
  webError?: string;
  credentialsAvailable: boolean;
  serverFavicons: Record<string, string>;
  adapterStatus?: "waiting" | "sign-in" | "ready" | "error";
  locale: import("./i18n").Locale;
  providers: { id: string; name: string; supportsCredentials?: boolean }[];
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
  getState(this: void): Promise<AppState>;
  saveServer(this: void, server: ServerInput): Promise<AppState>;
  getServerCredentials(this: void, id: string): Promise<ServerCredentials | null>;
  testServerConnection(this: void, server: ServerConnectionInput): Promise<ServerConnectionResult>;
  removeServer(this: void, id: string): Promise<AppState>;
  openServer(this: void, id: string): Promise<AppState>;
  showPage(this: void, page: AppPage, section?: SettingsPage): Promise<void>;
  togglePlaybackPopup(
    this: void,
    anchor: {
      x: number;
      y: number;
      width: number;
      height: number;
    },
  ): Promise<void>;
  hidePlaybackPopup(this: void): Promise<void>;
  toggleServerPopup(
    this: void,
    anchor: { x: number; y: number; width: number; height: number },
  ): Promise<void>;
  hideServerPopup(this: void): Promise<void>;
  addServer(this: void): Promise<void>;
  openPlaybackItem(this: void): Promise<void>;
  showError(this: void, visible: boolean): Promise<void>;
  discoverPlayers(this: void): Promise<AppState>;
  choosePlayer(this: void, kind: PlayerKind): Promise<AppState>;
  updateSettings(
    this: void,
    settings: Partial<
      Pick<
        Settings,
        | "defaultPlayerId"
        | "autoNext"
        | "fullscreen"
        | "theme"
        | "language"
        | "setupCompleted"
        | "runInBackground"
        | "remindOnClose"
      >
    >,
  ): Promise<AppState>;
  control(this: void, control: PlaybackControl): Promise<void>;
  surfaceReady(this: void, surface: "servers" | "playback"): Promise<void>;
  navigate(this: void, action: "back" | "forward" | "reload" | "stop" | "home"): Promise<void>;
  resetSession(this: void, id: string): Promise<AppState>;
  openGuide(this: void, kind: PlayerKind): Promise<void>;
  exportDiagnostics(this: void): Promise<string | null>;
  getDiagnostics(this: void): Promise<Diagnostics & { directories: AppDirectories }>;
  openDirectory(this: void, target: AppDirectory): Promise<void>;
  copyDiagnostics(this: void): Promise<void>;
  openLink(this: void, target: "product" | "github" | "issue"): Promise<void>;
  checkForUpdates(this: void): Promise<void>;
  installUpdate(this: void): Promise<void>;
  openReleases(this: void): Promise<void>;
  onState(this: void, callback: (state: AppState) => void): () => void;
  onAddServer(this: void, callback: () => void): () => void;
}
