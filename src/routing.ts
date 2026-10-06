import type { AppPage, AppState, SettingsPage } from "./shared/types";
import { z } from "zod";

export const settingsPaths = {
  servers: "/settings/servers",
  players: "/settings/players",
  appearance: "/settings/appearance",
  diagnostics: "/settings/diagnostics",
  about: "/settings/about",
} as const satisfies Record<SettingsPage, string>;
export const setupSearchSchema = z.object({
  step: z.enum(["welcome", "player", "server", "done"]).catch("welcome"),
  serverId: z.string().uuid().optional().catch(undefined),
});
export type SetupStep = z.infer<typeof setupSearchSchema>["step"];
export function pageFromPath(path: string): AppPage {
  if (path.startsWith("/settings")) return "settings";
  if (path.startsWith("/library/")) return "library";
  return path === "/setup" ? "setup" : "home";
}
export function snapshotPath(state: AppState): string {
  if (state.page === "settings") return settingsPaths[state.settingsPage];
  if (state.page === "setup") return "/setup";
  if (state.page === "library" && state.browser.serverId)
    return `/library/${encodeURIComponent(state.browser.serverId)}`;
  return "/";
}
export function preservesRoute(path: string, state: AppState): boolean {
  if (state.page === "settings")
    return (
      path === settingsPaths[state.settingsPage] ||
      path.startsWith(`${settingsPaths[state.settingsPage]}/`)
    );
  return path === snapshotPath(state);
}
