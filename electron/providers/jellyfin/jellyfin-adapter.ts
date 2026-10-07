// Installed before Jellyfin's bundles execute. Keep this serialized function self-contained.
export function installJellyfinAdapter(): void {
  const page = window as any;
  if (page.__freeboAdapterInstalled) return;
  page.__freeboAdapterInstalled = true;
  const patched = new WeakSet<object>();
  const wrapped = new WeakSet<Function>();
  let installed = false;
  const loginPage = () => /(?:login|selectserver|welcome|wizard)/i.test(location.hash);
  const status = () =>
    page.freeboPlayback?.ready(loginPage() ? "sign-in" : installed ? "ready" : "waiting");
  window.addEventListener("hashchange", status);
  const attach = (manager: any) => {
    if (
      !manager ||
      typeof manager.play !== "function" ||
      typeof manager.getPlayers !== "function" ||
      patched.has(manager)
    )
      return;
    patched.add(manager);
    const original = manager.play;
    manager.play = async function (options: any = {}, ...rest: any[]) {
      const api = page.ApiClient;
      const items = options.items ?? [];
      const first = items[options.startIndex ?? 0];
      const player = manager._currentPlayer;
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
      let ids =
        options.ids ?? items.map((item: any) => (item.Type === "Chapter" ? item.ItemId : item.Id));
      if (typeof ids === "string") ids = ids.split(",");
      const auth = api && {
        baseUrl: api.serverAddress?.(),
        userId: api.getCurrentUserId?.(),
        token: api.accessToken?.(),
        deviceId: api.deviceId?.(),
        serverId: api.serverId?.(),
        clientName: api.appName?.(),
        clientVersion: api.appVersion?.(),
        deviceName: api.deviceName?.(),
      };
      if (
        !auth ||
        Object.entries(auth).some(
          ([key, value]) => key !== "serverId" && (typeof value !== "string" || !value.trim()),
        ) ||
        !ids.length ||
        (player && !player.isLocalPlayer) ||
        first?.MediaType === "Audio" ||
        options.mediaType === "Audio" ||
        excluded.includes(first?.Type) ||
        (options.serverId && options.serverId !== auth.serverId)
      )
        return original.call(this, options, ...rest);
      if (!first) {
        const item = await api.getItem(auth.userId, ids[options.startIndex ?? 0]);
        if (excluded.includes(item.Type) || item.MediaType === "Audio")
          return original.call(this, options, ...rest);
      }
      const numeric = (value: unknown) =>
        value === undefined || value === null || value === "" ? undefined : Number(value);
      try {
        void Promise.resolve(api.ensureWebSocket?.()).catch(() => {});
      } catch {}
      return page.freeboPlayback.request({
        auth,
        intent: {
          itemIds: ids.map(String),
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
    status();
  };
  const inspect = (exports: any) => {
    try {
      attach(exports);
      // Jellyfin 10.11 exports playbackManager by name; older Web builds use default.
      attach(exports?.playbackManager);
      attach(exports?.default);
      // Production Webpack builds may shorten named exports to single-letter getters.
      if (exports && typeof exports === "object")
        for (const key of Object.keys(exports)) {
          try {
            attach(exports[key]);
          } catch {
            /* Uninitialized circular export. */
          }
        }
    } catch {
      /* Circular module exports may not be initialized yet. */
    }
  };
  const instrument = (modules: Record<string, Function>) => {
    for (const id of Object.keys(modules)) {
      const factory = modules[id];
      if (wrapped.has(factory)) continue;
      const replacement = function (this: unknown, ...args: any[]) {
        const result = factory.apply(this, args);
        inspect(args[0]?.exports);
        inspect(args[1]);
        return result;
      };
      wrapped.add(replacement);
      modules[id] = replacement;
    }
  };
  // Observe initialized exports without executing arbitrary modules or relying on numeric module IDs.
  for (const name of ["webpackChunkjellyfin_web", "webpackChunk"]) {
    const chunks = (page[name] ??= []);
    for (const chunk of chunks) if (chunk[1]) instrument(chunk[1]);
    let push = chunks.push;
    Object.defineProperty(chunks, "push", {
      configurable: true,
      get: () => {
        const currentPush = push;
        return function (...values: any[]) {
          for (const value of values) if (value[1]) instrument(value[1]);
          return currentPush.apply(chunks, values);
        };
      },
      set: (value) => {
        push = value;
      },
    });
    chunks.push([
      ["freebo-adapter"],
      {},
      (require: any) => {
        if (require.m) instrument(require.m);
        for (const module of Object.values(require.c ?? {}) as any[]) inspect(module.exports);
      },
    ]);
  }
  status();
  const timer = setInterval(status, 1000);
  window.addEventListener("pagehide", () => clearInterval(timer), { once: true });
}
