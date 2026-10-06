// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppRouter, connectNativeNavigation } from "../src/router";
import { createDesktopRuntime } from "../src/runtime/desktop";
import { setupSearchSchema } from "../src/routing";
import { createDesktopFixture, fixtureServerId } from "./desktop-fixture";

const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));
async function setup() {
  const fixture = createDesktopFixture();
  const runtime = createDesktopRuntime(fixture.api);
  const initial = await runtime.queryClient.fetchQuery(runtime.stateOptions);
  const router = createAppRouter(runtime, initial);
  const disconnect = connectNativeNavigation(router, runtime, false);
  cleanups.push(() => {
    disconnect();
    runtime.dispose();
  });
  await router.load();
  return { fixture, runtime, router };
}
describe("native and renderer routing", () => {
  it("routes new/edit and settings leaves without resetting a draft on playback updates", async () => {
    const { fixture, router } = await setup();
    await router.navigate({
      to: "/settings/servers/$serverId/edit",
      params: { serverId: fixtureServerId },
    });
    expect(fixture.state().settingsPage).toBe("servers");
    fixture.push({ playback: { ...fixture.state().playback, position: 50 } });
    expect(router.state.location.pathname).toBe(`/settings/servers/${fixtureServerId}/edit`);
    await router.navigate({ to: "/settings/players" });
    expect(fixture.state()).toMatchObject({ page: "settings", settingsPage: "players" });
    await router.navigate({ to: "/library/$serverId", params: { serverId: fixtureServerId } });
    expect(fixture.api.openServer).toHaveBeenCalledOnce();
    await router.navigate({ to: "/" });
    expect(fixture.state().page).toBe("home");
  });
  it("lets a later Home navigation win while server-open IPC is still in flight", async () => {
    const { fixture, router } = await setup();
    let finish!: () => void;
    fixture.api.openServer = vi.fn(async (id) => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return fixture.push({
        page: "library",
        browser: { ...fixture.state().browser, serverId: id },
      });
    });
    const opening = router.navigate({
      to: "/library/$serverId",
      params: { serverId: fixtureServerId },
    });
    await vi.waitFor(() => expect(fixture.api.openServer).toHaveBeenCalledOnce());
    const home = router.navigate({ to: "/" });
    finish();
    await Promise.all([opening, home]);
    expect(router.state.location.pathname).toBe("/");
    expect(fixture.state().page).toBe("home");
  });
  it("honors a popup add-server request and an external menu navigation", async () => {
    const { fixture, router } = await setup();
    await fixture.api.addServer();
    await router.load();
    expect(router.state.location.pathname).toBe("/settings/servers/new");
    fixture.push({ page: "settings", settingsPage: "appearance" });
    await router.load();
    expect(router.state.location.pathname).toBe("/settings/appearance");
  });
  it("retains the wizard step when settings or playback are pushed", async () => {
    const { fixture, router } = await setup();
    await router.navigate({ to: "/setup", search: { step: "server" } });
    fixture.push({ settings: { ...fixture.state().settings, autoNext: false } });
    expect(router.state.location.search).toEqual({ step: "server" });
    expect(setupSearchSchema.parse({ step: "unknown", serverId: "invalid" })).toEqual({
      step: "welcome",
    });
  });
  it("keeps popup routes isolated from main-window navigation", async () => {
    const fixture = createDesktopFixture();
    const runtime = createDesktopRuntime(fixture.api);
    const initial = await runtime.queryClient.fetchQuery(runtime.stateOptions);
    const router = createAppRouter(runtime, initial, "servers");
    const disconnect = connectNativeNavigation(router, runtime, true);
    cleanups.push(() => {
      disconnect();
      runtime.dispose();
    });
    await router.load();
    fixture.push({
      page: "library",
      browser: { ...fixture.state().browser, serverId: fixtureServerId },
    });
    expect(router.state.location.pathname).toBe("/popups/servers");
    expect(fixture.api.showPage).not.toHaveBeenCalled();
  });
});
