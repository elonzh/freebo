// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { UpdateSettings } from "../src/components/UpdateSettings";
import { createDesktopFixture } from "./desktop-fixture";
import { withTestProviders } from "./render-providers";
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
const button = (label: string, scope: ParentNode = container) =>
  [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent === label,
  )!;

it("keeps an update pending during playback until restart is explicitly confirmed", async () => {
  const fixture = createDesktopFixture();
  fixture.push({
    updates: { status: "downloaded", version: "1.1.0" },
    playback: { ...fixture.state().playback, status: "playing" },
  });
  const run: RunAction = async (_key, action) => {
    await action(fixture.api);
  };
  await act(async () =>
    root.render(withTestProviders(createElement(UpdateSettings, { state: fixture.state(), run }))),
  );
  await act(async () => button("重启并更新").click());
  expect(fixture.api.installUpdate).not.toHaveBeenCalled();
  expect(document.body.querySelector('[role="alertdialog"]')).not.toBeNull();
  expect(document.activeElement?.textContent).toBe("取消");
  await act(async () => button("取消", document.body).click());
  expect(fixture.api.installUpdate).not.toHaveBeenCalled();
  await act(async () => button("重启并更新").click());
  await act(async () =>
    button("重启并更新", document.body.querySelector('[role="alertdialog"]')!).click(),
  );
  expect(fixture.api.installUpdate).toHaveBeenCalledOnce();
});

it("disables actions during downloads, exposes retry on failure and manual download for unsupported builds", async () => {
  const fixture = createDesktopFixture();
  const run: RunAction = async (_key, action) => {
    await action(fixture.api);
  };
  fixture.push({ updates: { status: "downloading", version: "1.1.0", percent: 62 } });
  const render = () =>
    act(async () =>
      root.render(
        withTestProviders(createElement(UpdateSettings, { state: fixture.state(), run })),
      ),
    );
  await render();
  expect(container.textContent).toContain("62%");
  expect(button("检查更新").disabled).toBe(true);
  fixture.push({ updates: { status: "error" } });
  await render();
  await act(async () => button("检查更新").click());
  expect(fixture.api.checkForUpdates).toHaveBeenCalledOnce();
  fixture.push({ updates: { status: "disabled", reason: "unsigned-mac" } });
  await render();
  await act(async () => button("下载最新版本").click());
  expect(fixture.api.openReleases).toHaveBeenCalledOnce();
});
