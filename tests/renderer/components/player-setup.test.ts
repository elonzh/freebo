import { withTestProviders } from "../../helpers/render-providers";
// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PlayerSetup } from "../../../src/components/PlayerSetup";
import { defaultSettings } from "../../../electron/core/settings";
import type { AppState, DesktopAPI, Platform, Player } from "../../../src/shared/types";
import type { RunAction } from "../../../src/ui";

let container: HTMLDivElement;
let root: Root;
const update = vi.fn();
const openGuide = vi.fn();
const choosePlayer = vi.fn();
const run: RunAction = async (_key, action) => {
  await action({ openGuide, choosePlayer } as unknown as DesktopAPI);
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  update.mockReset();
  openGuide.mockReset();
  choosePlayer.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
});
async function render(
  players: Player[],
  platform: Platform = "darwin",
  defaultPlayerId = players[0]?.id,
) {
  await act(async () =>
    root.render(
      withTestProviders(
        createElement(PlayerSetup, {
          state: {
            platform,
            settings: { ...defaultSettings, players, defaultPlayerId },
          } as AppState,

          run,
          update,
        }),
      ),
    ),
  );
}
const player = (id: string, executable: string): Player => ({
  id,
  kind: "mpv",
  name: "mpv",
  executable,
  prefixArgs: [],
});
it("keeps multiple installed paths selectable from their labels and provider icons", async () => {
  await render([player("mpv-a", "/first/mpv"), player("mpv-b", "/second/mpv")]);
  const choices = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
  expect(choices).toHaveLength(2);
  expect(choices[0].getAttribute("aria-checked")).toBe("true");
  const label = container.querySelector<HTMLLabelElement>(`label[for="${choices[1].id}"]`)!;
  expect(label.textContent).toContain("/second/mpv");
  await act(async () => label.querySelector("img")!.click());
  expect(update).toHaveBeenCalledExactlyOnceWith({ defaultPlayerId: "mpv-b" });
  expect(openGuide).not.toHaveBeenCalled();
});
it("shows introductions for missing paths and keeps download and manual actions separate from selection", async () => {
  await render([player("blank", "  ")]);
  expect(container.querySelector('[role="radio"]')).toBeNull();
  expect(container.textContent).toContain("适合 macOS");
  const download = container.querySelector<HTMLButtonElement>(
    'button[aria-label="官网下载安装 · mpv"]',
  )!;
  expect(download.textContent).toBe("");
  expect(download.querySelector("svg")).not.toBeNull();
  await act(async () => download.click());
  expect(openGuide).toHaveBeenCalledExactlyOnceWith("mpv");
  await act(async () =>
    container.querySelector<HTMLButtonElement>('button[aria-label="手动选择 mpv"]')!.click(),
  );
  expect(choosePlayer).toHaveBeenCalledExactlyOnceWith("mpv");
  expect(update).not.toHaveBeenCalled();
});
it.each([
  ["darwin", ["IINA", "mpv", "VLC"]],
  ["win32", ["mpv.net", "PotPlayer", "MPC-HC", "MPC-BE", "mpv", "VLC"]],
  ["linux", ["mpv", "VLC"]],
] as const)("lists supported players before installation on %s", async (platform, names) => {
  await render([], platform);
  const downloads = [
    ...container.querySelectorAll<HTMLButtonElement>('button[aria-label^="官网下载安装"]'),
  ];
  expect(downloads.map((button) => button.getAttribute("aria-label"))).toEqual(
    names.map((name) => `官网下载安装 · ${name}`),
  );
  expect(container.querySelector('[role="radio"]')).toBeNull();
  expect(container.textContent).not.toContain("安装与配置指引");
});
