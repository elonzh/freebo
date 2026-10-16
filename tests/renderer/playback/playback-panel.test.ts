// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { PlaybackPanel } from "../../../src/components/playback/PlaybackPanel";
import { createDesktopFixture } from "../../helpers/desktop-fixture";
import { withTestProviders } from "../../helpers/render-providers";

it("shows the Cine handoff without fake progress, playback controls or a queue", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const state = createDesktopFixture().state();
  state.playback = {
    status: "external",
    playerName: "Cine",
    title: "Test movie",
    queue: [{ id: "movie", title: "Test movie" }],
    index: 0,
    position: 0,
    duration: 0,
  };
  try {
    await act(async () =>
      root.render(
        withTestProviders(createElement(PlaybackPanel, { state, run: vi.fn(), error: "" })),
      ),
    );
    expect(container.textContent).toContain("Cine · 已交给播放器");
    expect(container.textContent).toContain("保持 Freebo 运行");
    expect(container.querySelector('[role="slider"]')).toBeNull();
    expect(container.querySelector('[aria-label="暂停"]')).toBeNull();
    expect(container.querySelector('[aria-label="停止"]')).toBeNull();
    expect(container.querySelector("ol")).toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
  }
});
