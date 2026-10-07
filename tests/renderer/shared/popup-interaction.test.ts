import { withTestProviders } from "../../helpers/render-providers";
// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PlaybackPanel } from "../../../src/components/playback/PlaybackPanel";
import { ServerMenu } from "../../../src/components/servers/ServerMenu";
import type { AppState } from "../../../src/shared/types";
import type { RunAction } from "../../../src/ui";

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
  "closes %s popup through its close button",
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
    await render(true);
    expect(close).not.toHaveBeenCalled();
    await act(async () => closeButton.click());
    expect(close).toHaveBeenCalledOnce();
  },
);
