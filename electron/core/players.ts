import { access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { join, posix, win32, basename } from "node:path";
import { homedir } from "node:os";
import type { Platform, Player, PlayerKind } from "../../src/shared/types";

export const playerGuides: Record<
  PlayerKind,
  { name: string; url: string; platforms: Platform[] }
> = {
  iina: { name: "IINA", url: "https://iina.io/download/", platforms: ["darwin"] },
  mpv: {
    name: "mpv",
    url: "https://mpv.io/installation/",
    platforms: ["darwin", "win32", "linux"],
  },
  mpvnet: {
    name: "mpv.net",
    url: "https://github.com/mpvnet-player/mpv.net/releases",
    platforms: ["win32"],
  },
  vlc: {
    name: "VLC",
    url: "https://www.videolan.org/vlc/",
    platforms: ["darwin", "win32", "linux"],
  },
};

export function candidatePlayers(
  platform: Platform,
  env: NodeJS.ProcessEnv = process.env,
  home = homedir(),
): Player[] {
  const paths = platform === "win32" ? win32 : posix;
  const candidates: { kind: PlayerKind; path: string; prefix?: string[] }[] = [];
  const add = (kind: PlayerKind, path: string, prefix?: string[]) =>
    candidates.push({ kind, path, prefix });
  if (platform === "darwin") {
    for (const root of ["/Applications", paths.join(home, "Applications")]) {
      add("iina", paths.join(root, "IINA.app/Contents/MacOS/iina-cli"));
      add("vlc", paths.join(root, "VLC.app/Contents/MacOS/VLC"));
      add("mpv", paths.join(root, "mpv.app/Contents/MacOS/mpv"));
    }
    for (const root of ["/opt/homebrew/bin", "/usr/local/bin"]) add("mpv", paths.join(root, "mpv"));
  } else if (platform === "win32") {
    for (const root of [
      env.ProgramFiles,
      env["ProgramFiles(x86)"],
      env.LOCALAPPDATA && paths.join(env.LOCALAPPDATA, "Programs"),
      env.LOCALAPPDATA && paths.join(env.LOCALAPPDATA, "Microsoft/WinGet/Links"),
      env.SCOOP && paths.join(env.SCOOP, "apps"),
      paths.join(home, "scoop/apps"),
    ].filter(Boolean) as string[]) {
      add("mpvnet", paths.join(root, "mpv.net/mpvnet.exe"));
      add("mpv", paths.join(root, "mpv/mpv.exe"));
      add("mpv", paths.join(root, "mpv/current/mpv.exe"));
      add("mpvnet", paths.join(root, "mpvnet/current/mpvnet.exe"));
      add("vlc", paths.join(root, "VideoLAN/VLC/vlc.exe"));
      add("mpv", paths.join(root, "mpv.exe"));
    }
  } else {
    for (const root of ["/usr/bin", "/usr/local/bin", paths.join(home, ".local/bin")]) {
      add("mpv", paths.join(root, "mpv"));
      add("vlc", paths.join(root, "vlc"));
    }
  }
  for (const root of (env.PATH ?? "").split(paths.delimiter).filter(Boolean)) {
    for (const kind of ["mpv", "mpvnet", "vlc"] as PlayerKind[])
      add(kind, paths.join(root, `${kind}${platform === "win32" ? ".exe" : ""}`));
  }
  return candidates.map(({ kind, path, prefix }) => ({
    id: `${kind}:${path}`,
    name: playerGuides[kind].name,
    kind,
    executable: path,
    prefixArgs: prefix ?? [],
  }));
}

export async function discoverPlayers(
  platform: Platform,
  manual: Player[] = [],
): Promise<Player[]> {
  const candidates = [...manual.filter((p) => p.manual), ...candidatePlayers(platform)];
  if (platform === "win32" && process.env.LOCALAPPDATA) {
    const packages = join(process.env.LOCALAPPDATA, "Microsoft/WinGet/Packages");
    try {
      for (const name of await readdir(packages)) {
        if (/mpv/i.test(name))
          for (const executable of ["mpv.exe", "mpvnet.exe"])
            candidates.push({
              id: `${name}:${executable}`,
              name: executable === "mpv.exe" ? "mpv" : "mpv.net",
              kind: executable === "mpv.exe" ? "mpv" : "mpvnet",
              executable: join(packages, name, executable),
              prefixArgs: [],
            });
      }
    } catch {
      /* WinGet is optional. */
    }
  }
  const found = await Promise.all(
    candidates.map(async (player) => {
      try {
        await access(player.executable, platform === "win32" ? constants.F_OK : constants.X_OK);
        return player;
      } catch {
        return null;
      }
    }),
  );
  return found
    .filter((p): p is Player => p !== null)
    .filter(
      (p, index, list) =>
        list.findIndex((v) => v.executable === p.executable && v.kind === p.kind) === index,
    );
}

export function manualPlayer(kind: PlayerKind, path: string): Player {
  if (/\.app$/i.test(path))
    path = posix.join(
      path,
      "Contents/MacOS",
      kind === "iina" ? "iina-cli" : kind === "vlc" ? "VLC" : "mpv",
    );
  return {
    id: `${kind}:${path}`,
    name: `${playerGuides[kind].name} (${basename(path)})`,
    kind,
    executable: path,
    prefixArgs: [],
    manual: true,
  };
}
