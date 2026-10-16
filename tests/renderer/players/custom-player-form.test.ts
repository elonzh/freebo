// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CustomPlayerForm } from "../../../src/components/players/CustomPlayerForm";
import { withTestProviders } from "../../helpers/render-providers";
import type { Player } from "../../../src/shared/types";

let container: HTMLDivElement;
let root: Root;
const onSave = vi.fn();
const onCancel = vi.fn();
const chooseExecutable = vi.fn(async () => "/Player Folder/Custom Player");
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
  vi.unstubAllGlobals();
});
const render = (player?: Player) =>
  act(async () =>
    root.render(
      withTestProviders(
        createElement(CustomPlayerForm, {
          player,
          saving: false,
          chooseExecutable,
          onSave,
          onCancel,
        }),
      ),
    ),
  );
async function fill(value: string) {
  const field = container.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
      field,
      value,
    );
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const submit = () =>
  act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
it("uses the executable picker without submitting and saves separate literal arguments", async () => {
  await render();
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label="选择播放器可执行文件"]')!.click(),
  );
  expect(onSave).not.toHaveBeenCalled();
  expect(container.querySelector("input")!.value).toBe("Custom Player");
  await fill("--title={title}\n{url}\n--start={start}");
  await submit();
  expect(onSave).toHaveBeenCalledExactlyOnceWith({
    id: undefined,
    name: "Custom Player",
    executable: "/Player Folder/Custom Player",
    arguments: ["--title={title}", "{url}", "--start={start}"],
    mpvIpc: false,
  });
});
it("validates URL and managed mpv options, then saves IPC mode without overriding its session", async () => {
  await render({
    id: "custom",
    kind: "custom",
    name: "mpv custom",
    executable: "/mpv",
    prefixArgs: [],
    arguments: ["--start={start}", "{url}"],
  });
  await fill("--window");
  await submit();
  expect(container.querySelector('[role="alert"]')!.textContent).toContain("必须包含 {url}");
  await fill("--start={start}\n{url}");
  await act(async () => container.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
  await submit();
  expect(container.querySelector('[role="alert"]')!.textContent).toContain("由 Freebo 管理");
  expect(onSave).not.toHaveBeenCalled();
  await fill("--profile=high-quality\n{url}");
  await submit();
  expect(onSave).toHaveBeenCalledExactlyOnceWith({
    id: "custom",
    name: "mpv custom",
    executable: "/mpv",
    arguments: ["--profile=high-quality", "{url}"],
    mpvIpc: true,
  });
});
it("cancels without saving the draft", async () => {
  await render();
  await act(async () =>
    [...container.querySelectorAll("button")]
      .find((button) => button.textContent === "取消")!
      .click(),
  );
  expect(onCancel).toHaveBeenCalledOnce();
  expect(onSave).not.toHaveBeenCalled();
});
