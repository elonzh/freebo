import type { AppState, Diagnostics } from "../../src/shared/types";
import { redact } from "./redact";

export function diagnosticSnapshot(
  state: AppState,
  runtime: Pick<Diagnostics, "arch" | "osRelease" | "electron" | "chromium" | "node">,
  logs: Diagnostics["logs"],
): Diagnostics {
  const { status, position, duration, error, syncError, sync } = state.playback;
  const titles = [state.playback.title, ...state.playback.queue.map((item) => item.title)].filter(
    (value): value is string => Boolean(value),
  );
  const sanitize = (value: string) => {
    let text = redact(value).replace(/https?:\/\/[^\s"'<>]+/gi, "[url]");
    for (const title of titles) text = text.split(title).join("[media]");
    return text;
  };
  return {
    ...runtime,
    version: state.version,
    platform: state.platform,
    locale: state.locale,
    theme: state.settings.theme,
    credentialsAvailable: state.credentialsAvailable,
    serverCount: state.settings.servers.length,
    webStatus: state.webStatus,
    adapterStatus: state.adapterStatus,
    playback: {
      status,
      position,
      duration,
      error: error && sanitize(error),
      syncError: syncError && sanitize(syncError),
      sync: sync && { ...sync, error: sync.error && sanitize(sync.error) },
    },
    players: state.settings.players.map((player) => ({
      name: player.name,
      kind: player.kind,
      default: player.id === state.settings.defaultPlayerId,
    })),
    logs: logs.slice(-200).map((entry) => ({ ...entry, message: sanitize(entry.message) })),
  };
}
export function productLink(
  target: "product" | "github" | "issue",
  diagnostic: Pick<
    Diagnostics,
    "version" | "platform" | "arch" | "osRelease" | "electron" | "chromium"
  >,
): string {
  if (target === "product") return "https://elonzh.cn/toys/freebo";
  if (target === "github") return "https://github.com/elonzh/freebo";
  const url = new URL("https://github.com/elonzh/freebo/issues/new");
  url.searchParams.set("title", "[Bug] ");
  url.searchParams.set(
    "body",
    `### 问题描述 / Description\n\n\n### 复现步骤 / Steps to reproduce\n\n1. \n\n### 预期结果 / Expected behavior\n\n\n### 环境 / Environment\n\nFreebo ${diagnostic.version}\n${diagnostic.platform} ${diagnostic.arch} (${diagnostic.osRelease})\nElectron ${diagnostic.electron} / Chromium ${diagnostic.chromium}\n\n### 诊断信息 / Diagnostics\n\n请从设置 → 诊断复制信息，检查后粘贴到此处。\nCopy from Settings → Diagnostics, review it, and paste here.\n`,
  );
  return url.toString();
}
