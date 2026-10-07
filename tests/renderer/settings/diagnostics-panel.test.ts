// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DiagnosticsPanel } from "../../../src/components/settings/DiagnosticsPanel";
import { RuntimeContext } from "../../../src/runtime/context";
import { createDesktopRuntime, type DesktopRuntime } from "../../../src/runtime/desktop";
import { diagnosticSnapshot } from "../../../electron/core/diagnostics";
import { createDesktopFixture } from "../../helpers/desktop-fixture";
import { withTestProviders } from "../../helpers/render-providers";
import type { RunAction } from "../../../src/ui";

let container: HTMLDivElement;
let root: Root;
let runtime: DesktopRuntime;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  runtime?.dispose();
  container.remove();
  delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
});

async function render() {
  const fixture = createDesktopFixture();
  const directories = {
    program: "/Applications/Freebo program",
    data: "/profiles/Freebo custom data",
  };
  fixture.api.getDiagnostics = vi.fn(async () => ({
    ...diagnosticSnapshot(
      fixture.state(),
      {
        arch: "arm64",
        osRelease: "27",
        electron: "44",
        chromium: "152",
        node: "24",
      },
      [],
    ),
    directories,
  }));
  runtime = createDesktopRuntime(fixture.api);
  const run: RunAction = async (_key, action) => {
    await action(fixture.api);
  };
  await act(async () =>
    root.render(
      withTestProviders(
        createElement(
          RuntimeContext.Provider,
          { value: runtime },
          createElement(DiagnosticsPanel, { state: fixture.state(), run }),
        ),
      ),
    ),
  );
  await vi.waitFor(() => expect(container.textContent).toContain(directories.data));
  return { fixture, directories };
}

const button = (label: string) =>
  container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

it("shows full directory paths and opens each through its fixed target", async () => {
  const { fixture, directories } = await render();
  expect(container.textContent).toContain(directories.program);
  await act(async () => button("打开程序目录").click());
  expect(fixture.api.openDirectory).toHaveBeenLastCalledWith("program");
  await act(async () => button("打开数据目录").click());
  expect(fixture.api.openDirectory).toHaveBeenLastCalledWith("data");
});

it("disables directory actions during an OS open request and re-enables them afterwards", async () => {
  const { fixture } = await render();
  let finish!: () => void;
  fixture.api.openDirectory = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => button("打开数据目录").click());
  expect(button("打开程序目录").disabled).toBe(true);
  expect(button("打开数据目录").disabled).toBe(true);
  await act(async () => button("打开程序目录").click());
  expect(fixture.api.openDirectory).toHaveBeenCalledOnce();
  await act(async () => finish());
  expect(button("打开程序目录").disabled).toBe(false);
  expect(button("打开数据目录").disabled).toBe(false);
});
