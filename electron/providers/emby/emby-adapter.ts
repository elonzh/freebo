// Serialized into the page's main world. This function must remain self-contained.
export function installEmbyAdapter(): void {
  const page = window as any;
  if (page.__freeboAdapterInstalled) return;
  page.__freeboAdapterInstalled = true;
  let installed = false;
  let started = Date.now();
  let stopped = false;
  const status = (value: string) => page.freeboPlayback?.ready(value);
  const loginPage = () => /(?:login|selectserver|welcome|connectlogin)/i.test(location.hash);
  const reportRoute = () => {
    if (loginPage()) status("sign-in");
    else status(installed ? "ready" : "waiting");
  };
  window.addEventListener("hashchange", () => {
    if (loginPage()) started = Date.now();
    reportRoute();
    if (stopped && !installed && !loginPage()) {
      stopped = false;
      started = Date.now();
      void attach();
    }
  });
  const retry = () => {
    if (Date.now() - started > 20_000) {
      stopped = true;
      status("stalled");
    } else setTimeout(() => void attach(), 500);
  };
  const importModule = async (path: string) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        page.Emby.importModule(path),
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error("Module initialization timed out")), 5_000);
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  };
  const attach = async () => {
    if (installed || stopped) return;
    if (loginPage()) {
      started = Date.now();
      status("sign-in");
      setTimeout(() => void attach(), 500);
      return;
    }
    if (!page.Emby?.importModule || !page.freeboPlayback) {
      retry();
      return;
    }
    try {
      // Let Emby establish its own connection before loading playback modules.
      const connectionModule = await importModule("./modules/emby-apiclient/connectionmanager.js");
      const connection = connectionModule.default ?? connectionModule;
      const client = connection.currentApiClient?.() ?? connection.getApiClient?.();
      if (!client?.getCurrentUserId?.()) {
        retry();
        return;
      }
      const managerModule = await importModule("./modules/common/playback/playbackmanager.js");
      const manager = managerModule.default ?? managerModule;
      const original = manager.play.bind(manager);
      const numeric = (value: unknown) =>
        value === undefined || value === null || value === "" ? undefined : Number(value);
      const excluded = [
        "Audio",
        "MusicAlbum",
        "MusicArtist",
        "MusicGenre",
        "TvChannel",
        "Program",
        "Recording",
        "Photo",
        "PhotoAlbum",
        "Book",
      ];
      manager.play = async (options: any, ...rest: any[]) => {
        const items = options.items ?? [];
        const first = items[options.startIndex ?? 0];
        if (
          excluded.includes(first?.Type) ||
          first?.MediaType === "Audio" ||
          options.mediaType === "Audio" ||
          (manager._currentPlayer && !manager._currentPlayer.isLocalPlayer)
        )
          return original(options, ...rest);
        const api =
          connection.getApiClient(options.serverId ?? first?.ServerId) ??
          connection.currentApiClient();
        if (!api) return original(options, ...rest);
        const clientIdentity = {
          clientName: api.appName?.(),
          clientVersion: api.appVersion?.(),
          deviceName: api.deviceName?.(),
        };
        // Keep the web player's own behavior if it cannot supply its real identity.
        if (
          Object.values(clientIdentity).some((value) => typeof value !== "string" || !value.trim())
        )
          return original(options, ...rest);
        let ids =
          options.ids ??
          items.map((item: any) => (item.Type === "Chapter" ? item.ItemId : item.Id));
        if (!ids.length) return original(options, ...rest);
        if (!first) {
          const check = await api.getItem(api.getCurrentUserId(), ids[options.startIndex ?? 0]);
          if (excluded.includes(check.Type) || check.MediaType === "Audio")
            return original(options, ...rest);
        }
        ids = ids.map(String);
        // Emby's own start reporter opens this channel so cached Home/detail views
        // receive UserDataChanged notifications after the external player reports.
        try {
          void Promise.resolve(api.ensureWebSocket?.()).catch(() => {});
        } catch {
          // Playback reporting works without a websocket; navigation can refresh the view.
        }
        return page.freeboPlayback.request({
          auth: {
            baseUrl: api.getUrl
              ? api.getUrl("Videos").replace(/\/Videos(?:\?.*)?$/, "")
              : `${api.serverAddress().replace(/\/$/, "")}/emby`,
            userId: String(api.getCurrentUserId()),
            token: api.accessToken(),
            deviceId: api.deviceId(),
            serverId: api.serverId?.() ?? options.serverId ?? first?.ServerId,
            ...clientIdentity,
          },
          intent: {
            itemIds: ids,
            startIndex: numeric(options.startIndex),
            startTicks:
              numeric(options.startPositionTicks) ??
              (first?.Type === "Chapter" ? first.StartPositionTicks : undefined),
            mediaSourceId: options.mediaSourceId || first?.MediaSourceId || undefined,
            audioIndex: numeric(options.audioStreamIndex),
            subtitleIndex: numeric(options.subtitleStreamIndex),
            shuffle: options.shuffle,
            expand: true,
          },
        });
      };
      installed = true;
      reportRoute();
    } catch {
      retry();
    }
  };
  reportRoute();
  setTimeout(() => void attach(), 500);
}
