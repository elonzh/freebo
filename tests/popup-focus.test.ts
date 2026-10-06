import { withTestProviders } from "./render-providers";
// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PlaybackPanel } from "../src/components/PlaybackPanel";
import { ServerMenu } from "../src/components/ServerMenu";
import type { AppState } from "../src/shared/types";
import type { RunAction } from "../src/ui";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
});

it.each(["servers", "playback"] as const)(
  "resets %s popup focus on every opening without stealing focus during updates",
  async (surface) => {
    const Component = surface === "servers" ? ServerMenu : PlaybackPanel;
    const close = vi.fn(async () => {});
    const desktop = { hideServerPopup: close, hidePlaybackPopup: close };
    const run: RunAction = async (_key, action) => {
      await action(desktop as any);
    };
    const state = {
      settings: { servers: [] },
      browser: {},
      playback: { status: "idle", queue: [], index: 0, duration: 0, position: 0 },
      serverPopupOpen: false,
      playbackPopupOpen: false,
    } as unknown as AppState;
    const render = async (open: boolean) => {
      await act(async () =>
        root.render(
          withTestProviders(
            createElement(Component, {
              state: { ...state, serverPopupOpen: open, playbackPopupOpen: open },

              run,
              error: "",
            }),
          ),
        ),
      );
    };
    await render(false);
    const closeButton = container.querySelector<HTMLButtonElement>('button[aria-label^="关闭"]')!;
    await act(async () => closeButton.focus());
    await render(true);
    expect(document.activeElement).toBe(container.querySelector("main"));
    expect(closeButton.tabIndex).toBe(0);
    await act(async () => closeButton.focus());
    await render(true);
    expect(document.activeElement).toBe(closeButton);
    await render(false);
    await render(true);
    expect(document.activeElement).toBe(container.querySelector("main"));
    await act(async () =>
      container
        .querySelector("main")!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
    );
    expect(close).toHaveBeenCalledOnce();
  },
);
