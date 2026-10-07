// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GeneralPage } from "../../../src/pages/SettingsPages";
import { AppContext, type AppContextValue } from "../../../src/runtime/context";
import { createDesktopFixture } from "../../helpers/desktop-fixture";
import { withTestProviders } from "../../helpers/render-providers";
import type { SettingsPatch } from "../../../src/ui";

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
const toggle = (label: string) =>
  container.querySelector<HTMLButtonElement>(`[role="switch"][aria-label="${label}"]`)!;

it("updates background preferences and disables the reminder control when background running is off", async () => {
  const fixture = createDesktopFixture();
  const update = vi.fn((patch: SettingsPatch) => fixture.api.updateSettings(patch));
  const render = () =>
    act(async () =>
      root.render(
        withTestProviders(
          createElement(
            AppContext.Provider,
            {
              value: {
                state: fixture.state(),
                update,
                isPending: () => false,
              } as unknown as AppContextValue,
            },
            createElement(GeneralPage),
          ),
        ),
      ),
    );
  await render();
  expect(toggle("关闭窗口后在后台运行").getAttribute("aria-checked")).toBe("true");
  await act(async () => toggle("关闭窗口时提醒").click());
  expect(update).toHaveBeenLastCalledWith({ remindOnClose: false });
  await render();
  expect(toggle("关闭窗口时提醒").getAttribute("aria-checked")).toBe("false");
  await act(async () => toggle("关闭窗口后在后台运行").click());
  expect(update).toHaveBeenLastCalledWith({ runInBackground: false });
  await render();
  expect(toggle("关闭窗口时提醒").disabled).toBe(true);
  await act(async () => toggle("关闭窗口后在后台运行").click());
  await render();
  expect(toggle("关闭窗口时提醒").disabled).toBe(false);
  expect(toggle("关闭窗口时提醒").getAttribute("aria-checked")).toBe("false");
});

it("prevents repeated changes while a setting is being saved", async () => {
  const fixture = createDesktopFixture();
  const update = vi.fn();
  await act(async () =>
    root.render(
      withTestProviders(
        createElement(
          AppContext.Provider,
          {
            value: {
              state: fixture.state(),
              update,
              isPending: () => true,
            } as unknown as AppContextValue,
          },
          createElement(GeneralPage),
        ),
      ),
    ),
  );
  expect(toggle("关闭窗口后在后台运行").disabled).toBe(true);
  expect(toggle("关闭窗口时提醒").disabled).toBe(true);
  await act(async () => toggle("关闭窗口后在后台运行").click());
  expect(update).not.toHaveBeenCalled();
});
