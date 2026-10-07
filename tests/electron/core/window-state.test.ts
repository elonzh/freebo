import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fitWindowBounds, WindowStateStore } from "../../../electron/core/window-state";

const workArea = { x: 0, y: 25, width: 1440, height: 875 };
describe("window geometry", () => {
  it("restores size, position and maximized state after reopening the store", async () => {
    const file = join(await mkdtemp(join(tmpdir(), "freebo-window-")), "window-state.json");
    const state = { bounds: { x: 100, y: 80, width: 900, height: 650 }, maximized: true };
    new WindowStateStore(file).save(state);
    expect(new WindowStateStore(file).load()).toEqual(state);
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual(state);
  });
  it("uses default geometry for missing or corrupted state without blocking startup", async () => {
    const file = join(await mkdtemp(join(tmpdir(), "freebo-window-")), "window-state.json");
    const store = new WindowStateStore(file);
    expect(store.load()).toBeUndefined();
    for (const data of [
      "invalid JSON",
      JSON.stringify({ bounds: { x: 1, y: 1, width: -1, height: 600 } }),
    ]) {
      await writeFile(file, data);
      expect(store.load()).toBeUndefined();
    }
  });
  it("preserves visible bounds, including displays with negative coordinates", () => {
    const bounds = { x: 100, y: 80, width: 900, height: 650 };
    expect(fitWindowBounds(bounds, workArea)).toEqual(bounds);
    const leftDisplay = { x: -1920, y: 25, width: 1920, height: 1055 };
    const leftBounds = { ...bounds, x: -1700 };
    expect(fitWindowBounds(leftBounds, leftDisplay)).toEqual(leftBounds);
  });
  it("brings windows from disconnected displays into view and respects current screen size", () => {
    const disconnected = { x: 2000, y: -100, width: 2000, height: 1200 };
    expect(fitWindowBounds(disconnected, workArea)).toEqual(workArea);
    expect(fitWindowBounds({ x: -2000, y: 1500, width: 400, height: 300 }, workArea)).toEqual({
      x: 0,
      y: 300,
      width: 820,
      height: 600,
    });
  });
});
