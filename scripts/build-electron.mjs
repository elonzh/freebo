import { build } from "esbuild";
import { rm } from "node:fs/promises";

await rm("dist-electron", { recursive: true, force: true });
await build({
  entryPoints: {
    main: "electron/main.ts",
    preload: "electron/preload.ts",
    "emby-preload": "electron/providers/emby/emby-preload.ts",
    "jellyfin-preload": "electron/providers/jellyfin/jellyfin-preload.ts",
    "plex-preload": "electron/providers/plex/plex-preload.ts",
  },
  outdir: "dist-electron",
  bundle: true,
  platform: "node",
  format: "cjs",
  outExtension: { ".js": ".cjs" },
  external: ["electron", "electron-updater"],
  target: "node22",
  sourcemap: true,
});
