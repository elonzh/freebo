import { vi } from "vitest";
import type { AppState, DesktopAPI, ServerInput } from "../../src/shared/types";

export const fixtureServerId = "70000000-0000-4000-8000-000000000001";
export function createDesktopFixture() {
  let state: AppState = {
    revision: 1,
    settings: {
      servers: [
        { id: fixtureServerId, name: "Test", url: "https://example.test", providerId: "emby" },
      ],
      players: [],
      autoNext: true,
      fullscreen: false,
      theme: "light",
      language: "zh",
      setupCompleted: true,
      playerScanCompleted: true,
    },
    platform: "darwin",
    version: "1.0.0",
    updates: { status: "disabled", reason: "development" },
    locale: "zh",
    webStatus: "closed",
    credentialsAvailable: true,
    providers: [{ id: "emby", name: "Emby Server" }],
    serverFavicons: {},
    page: "home",
    settingsPage: "servers",
    playbackPopupOpen: false,
    serverPopupOpen: false,
    fullscreen: false,
    playback: { status: "idle", position: 0, duration: 0, queue: [], index: 0 },
    browser: { url: "", canGoBack: false, canGoForward: false },
  };
  const listeners = new Set<(state: AppState) => void>();
  const addListeners = new Set<() => void>();
  function push(patch: Partial<AppState>) {
    state = { ...state, ...patch, revision: state.revision + 1 };
    listeners.forEach((listener) => listener(state));
    return state;
  }
  const api: DesktopAPI = {
    getState: vi.fn(async () => state),
    onState: vi.fn((listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }),
    onAddServer: vi.fn((listener) => {
      addListeners.add(listener);
      return () => {
        addListeners.delete(listener);
      };
    }),
    showPage: vi.fn(async (page, section) => {
      push({ page, settingsPage: section ?? state.settingsPage });
    }),
    openServer: vi.fn(async (id) =>
      push({
        page: "library",
        webStatus: "ready",
        browser: {
          url: "https://example.test/web/",
          serverId: id,
          canGoBack: false,
          canGoForward: false,
        },
      }),
    ),
    saveServer: vi.fn(async (input: ServerInput) => {
      const server = {
        id: input.id ?? "70000000-0000-4000-8000-000000000002",
        name: input.name,
        url: input.url,
        providerId: input.providerId,
      };
      return push({
        settings: {
          ...state.settings,
          servers: [...state.settings.servers.filter((entry) => entry.id !== server.id), server],
        },
      });
    }),
    getServerCredentials: vi.fn(async () => null),
    testServerConnection: vi.fn(async () => ({ serverName: "Test", authenticated: false })),
    removeServer: vi.fn(async (id) =>
      push({
        settings: {
          ...state.settings,
          servers: state.settings.servers.filter((server) => server.id !== id),
        },
      }),
    ),
    updateSettings: vi.fn(async (patch) =>
      push({
        settings: { ...state.settings, ...patch },
        locale: patch.language === "en" ? "en" : state.locale,
      }),
    ),
    discoverPlayers: vi.fn(async () =>
      push({ settings: { ...state.settings, playerScanCompleted: true } }),
    ),
    choosePlayer: vi.fn(async () => state),
    resetSession: vi.fn(async () => state),
    surfaceReady: vi.fn(async () => {}),
    showError: vi.fn(async () => {}),
    control: vi.fn(async () => {}),
    navigate: vi.fn(async () => {}),
    togglePlaybackPopup: vi.fn(async () => {}),
    hidePlaybackPopup: vi.fn(async () => {}),
    toggleServerPopup: vi.fn(async () => {}),
    hideServerPopup: vi.fn(async () => {}),
    addServer: vi.fn(async () => {
      push({ page: "settings", settingsPage: "servers" });
      addListeners.forEach((listener) => listener());
    }),
    openPlaybackItem: vi.fn(async () => {}),
    openGuide: vi.fn(async () => {}),
    exportDiagnostics: vi.fn(async () => null),
    getDiagnostics: vi.fn(async () => {
      throw new Error("No diagnostics fixture");
    }),
    copyDiagnostics: vi.fn(async () => {}),
    openLink: vi.fn(async () => {}),
    checkForUpdates: vi.fn(async () => {}),
    installUpdate: vi.fn(async () => {}),
    openReleases: vi.fn(async () => {}),
  };
  return { api, push, state: () => state, listenerCount: () => listeners.size + addListeners.size };
}
