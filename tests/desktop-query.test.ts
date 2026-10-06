// @vitest-environment jsdom
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { useDesktopActions } from "../src/runtime/context";
import { describe, expect, it, vi } from "vitest";
import { createDesktopRuntime, desktopStateKey } from "../src/runtime/desktop";
import type { AppState } from "../src/shared/types";
import { createDesktopFixture } from "./desktop-fixture";

describe("IPC Query ownership", () => {
  it("keeps a pushed state when the startup read returns an older snapshot", async () => {
    const fixture = createDesktopFixture();
    const initial = fixture.state();
    let complete!: (state: AppState) => void;
    fixture.api.getState = vi.fn(
      () =>
        new Promise<AppState>((resolve) => {
          complete = resolve;
        }),
    );
    const runtime = createDesktopRuntime(fixture.api);
    const request = runtime.queryClient.fetchQuery(runtime.stateOptions);
    const pushed = fixture.push({ page: "settings", settingsPage: "players" });
    complete(initial);
    expect(await request).toEqual(pushed);
    expect(runtime.queryClient.getQueryData(desktopStateKey)).toEqual(pushed);
    runtime.dispose();
    expect(fixture.listenerCount()).toBe(0);
  });
  it("applies mutation snapshots and rejects a delayed stale mutation response", async () => {
    const fixture = createDesktopFixture();
    const runtime = createDesktopRuntime(fixture.api);
    await runtime.queryClient.fetchQuery(runtime.stateOptions);
    const stale = fixture.state();
    const mutation = runtime.queryClient.getMutationCache().build(runtime.queryClient, {
      mutationFn: () => fixture.api.updateSettings({ autoNext: false }),
    });
    await mutation.execute(undefined);
    expect(runtime.queryClient.getQueryData<AppState>(desktopStateKey)?.settings.autoNext).toBe(
      false,
    );
    const latest = fixture.push({
      playback: { ...fixture.state().playback, status: "playing", position: 60 },
    });
    runtime.applyState(stale);
    expect(runtime.queryClient.getQueryData(desktopStateKey)).toEqual(latest);
    runtime.dispose();
  });
  it("does not retry IPC queries or mutations after an access failure", async () => {
    const fixture = createDesktopFixture();
    fixture.api.getState = vi.fn(async () => {
      throw new Error("403");
    });
    const runtime = createDesktopRuntime(fixture.api);
    await expect(runtime.queryClient.fetchQuery(runtime.stateOptions)).rejects.toThrow("403");
    expect(fixture.api.getState).toHaveBeenCalledOnce();
    const fn = vi.fn(async () => {
      throw new Error("429");
    });
    const mutation = runtime.queryClient
      .getMutationCache()
      .build(runtime.queryClient, { mutationFn: fn });
    await expect(mutation.execute(undefined)).rejects.toThrow("429");
    expect(fn).toHaveBeenCalledOnce();
    runtime.dispose();
  });
});

it("keeps credential input out of shared mutation variables and snapshots", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const fixture = createDesktopFixture();
  const runtime = createDesktopRuntime(fixture.api);
  const container = document.createElement("div");
  const root = createRoot(container);
  let actions: ReturnType<typeof useDesktopActions> | undefined;
  function Harness() {
    const value = useDesktopActions(runtime);
    useEffect(() => {
      actions = value;
    }, [value]);
    return null;
  }
  try {
    await act(async () =>
      root.render(
        createElement(QueryClientProvider, { client: runtime.queryClient }, createElement(Harness)),
      ),
    );
    await act(async () =>
      actions!.run("save", (api) =>
        api.saveServer({
          name: "New",
          url: "https://new.example.test",
          providerId: "emby",
          credentials: { username: "fixture-account", password: "fixture-sensitive-value" },
        }),
      ),
    );
    const mutations = runtime.queryClient.getMutationCache().getAll();
    expect(mutations.length).toBeGreaterThan(0);
    for (const mutation of mutations) {
      expect(
        Object.values(mutation.state.variables as object).every(
          (value) => typeof value === "string" || typeof value === "number",
        ),
      ).toBe(true);
    }
    expect(JSON.stringify(runtime.queryClient.getQueryData(desktopStateKey))).not.toContain(
      "fixture-sensitive-value",
    );
    expect(fixture.api.saveServer).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    runtime.dispose();
    delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
  }
});
