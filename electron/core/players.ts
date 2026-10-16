import { access, readdir, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { constants } from "node:fs";
import { join, posix, win32, basename } from "node:path";
import { homedir } from "node:os";
import type { Platform, Player, PlayerKind } from "../../src/shared/types";
import { UserFacingError } from "../../src/shared/i18n";

export const playerGuides: Record<
  Exclude<PlayerKind, "custom">,
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
  potplayer: { name: "PotPlayer", url: "https://potplayer.tv/", platforms: ["win32"] },
  "mpc-hc": {
    name: "MPC-HC",
    url: "https://github.com/clsid2/mpc-hc/releases",
    platforms: ["win32"],
  },
  "mpc-be": {
    name: "MPC-BE",
    url: "https://github.com/Aleksoid1978/MPC-BE/releases",
    platforms: ["win32"],
  },
  cine: {
    name: "Cine",
    url: "https://github.com/diegopvlk/Cine",
    platforms: ["linux"],
  },
};

export function candidatePlayers(
  platform: Platform,
  env: NodeJS.ProcessEnv = process.env,
  home = homedir(),
): Player[] {
  const paths = platform === "win32" ? win32 : posix;
  const candidates: { kind: keyof typeof playerGuides; path: string; prefix?: string[] }[] = [];
  const add = (kind: keyof typeof playerGuides, path: string, prefix?: string[]) =>
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
      for (const binary of ["PotPlayerMini64.exe", "PotPlayerMini.exe"])
        for (const folder of [
          "DAUM/PotPlayer",
          "PotPlayer",
          "PotPlayer/current",
          "potplayer/current",
        ])
          add("potplayer", paths.join(root, folder, binary));
      for (const [kind, folder, binaries] of [
        ["mpc-hc", "MPC-HC", ["mpc-hc64.exe", "mpc-hc.exe"]],
        ["mpc-be", "MPC-BE", ["mpc-be64.exe", "mpc-be.exe"]],
      ] as const)
        for (const binary of binaries)
          for (const path of [
            folder,
            `${folder} x64`,
            `${kind}/current`,
            ...(kind === "mpc-hc" ? ["K-Lite Codec Pack/MPC-HC"] : []),
          ])
            add(kind, paths.join(root, path, binary));
    }
  } else {
    for (const root of ["/usr/bin", "/usr/local/bin", paths.join(home, ".local/bin")]) {
      add("mpv", paths.join(root, "mpv"));
      add("vlc", paths.join(root, "vlc"));
      add("cine", paths.join(root, "cine"));
    }
  }
  for (const root of (env.PATH ?? "").split(paths.delimiter).filter(Boolean)) {
    if (platform === "linux") add("cine", paths.join(root, "cine"));
    for (const kind of ["mpv", "mpvnet", "vlc"] as const)
      add(kind, paths.join(root, `${kind}${platform === "win32" ? ".exe" : ""}`));
    if (platform === "win32")
      for (const [kind, binaries] of [
        ["potplayer", ["PotPlayerMini64.exe", "PotPlayerMini.exe"]],
        ["mpc-hc", ["mpc-hc64.exe", "mpc-hc.exe"]],
        ["mpc-be", ["mpc-be64.exe", "mpc-be.exe"]],
      ] as const)
        for (const binary of binaries) add(kind, paths.join(root, binary));
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
        list.findIndex((v) =>
          p.kind === "custom" ? v.id === p.id : v.executable === p.executable && v.kind === p.kind,
        ) === index,
    );
}

export function manualPlayer(kind: Exclude<PlayerKind, "custom">, path: string): Player {
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

export async function customPlayerExecutable(input: string): Promise<string> {
  let path = input;
  try {
    if (process.platform === "darwin" && /\.app$/i.test(path)) {
      const { stdout } = await promisify(execFile)(
        "/usr/bin/plutil",
        [
          "-extract",
          "CFBundleExecutable",
          "raw",
          "-expect",
          "string",
          "-o",
          "-",
          posix.join(path, "Contents/Info.plist"),
        ],
        { timeout: 3000, maxBuffer: 8192 },
      );
      const binary = stdout.trim();
      if (!binary || posix.basename(binary) !== binary)
        throw new Error("Invalid bundle executable");
      path = posix.join(path, "Contents/MacOS", binary);
    }
    if (!(await stat(path)).isFile()) throw new Error("Not a file");
    await access(path, process.platform === "win32" ? constants.F_OK : constants.X_OK);
    return path;
  } catch {
    throw new UserFacingError("playerExecutableInvalid");
  }
}
