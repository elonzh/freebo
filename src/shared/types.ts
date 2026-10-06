export type PlayerKind = "iina" | "mpv" | "mpvnet" | "vlc";
export type Platform = "darwin" | "win32" | "linux";
export type AppPage = "home" | "library" | "settings" | "setup";
export type SettingsPage =
  | "players"
  | "playback"
  | "appearance"
  | "servers"
  | "diagnostics"
  | "about";
export interface Server {
  id: string;
  name: string;
  url: string;
  providerId: string;
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
  audioId?: number;
  subtitleId?: number | "no";
  audioStreamIndex?: number;
  subtitleStreamIndex?: number;
  subtitleUrl?: string;
  headers: Record<string, string>;
}
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
}
export interface AppState {
  settings: Settings;
  playback: PlaybackState;
  platform: Platform;
  version: string;
  webStatus: "closed" | "loading" | "ready" | "error";
  webError?: string;
  adapterStatus?: "waiting" | "sign-in" | "ready" | "error";
  locale: import("./i18n").Locale;
  providers: { id: string; name: string }[];
  page: AppPage;
  settingsPage: SettingsPage;
  playbackPopupOpen: boolean;
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
  saveServer(server: {
    id?: string;
    name: string;
    url: string;
    providerId: string;
  }): Promise<AppState>;
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
  confirm(action: "remove" | "sign-out", id: string): Promise<boolean>;
  navigate(action: "back" | "forward" | "reload" | "home"): Promise<void>;
  resetSession(id: string): Promise<AppState>;
  openGuide(kind: PlayerKind): Promise<void>;
  exportDiagnostics(): Promise<string | null>;
  onState(callback: (state: AppState) => void): () => void;
}
