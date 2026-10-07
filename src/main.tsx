import React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { createRendererI18n } from "./i18n";
import { resolveLocale, localizeError, translate } from "./shared/i18n";
import { createDesktopRuntime } from "./runtime/desktop";
import { RuntimeContext } from "./runtime/context";
import { createAppRouter, connectNativeNavigation } from "./router";
import { BrandLogo } from "./components/shared/Brand";
import { Button } from "./components/ui/button";
import "./style.css";

const root = createRoot(document.getElementById("root")!);
const api = window.desktop;
const systemLocale = resolveLocale("system", navigator.language);
let cleanup: (() => void) | undefined;
let stopped = false;
async function start() {
  if (!api) {
    root.render(
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <BrandLogo />
        <p>{translate(systemLocale, "preview")}</p>
      </main>,
    );
    return;
  }
  cleanup?.();
  const runtime = createDesktopRuntime(api);
  cleanup = () => runtime.dispose();
  try {
    const initial = await runtime.queryClient.fetchQuery(runtime.stateOptions);
    if (stopped) return;
    const i18n = createRendererI18n(initial.locale);
    const unsubscribeLanguage = runtime.subscribe((state) => {
      if (i18n.language !== state.locale) void i18n.changeLanguage(state.locale);
    });
    const surface = new URLSearchParams(location.search).get("surface");
    const router = createAppRouter(runtime, initial, surface);
    const unsubscribeNavigation = connectNativeNavigation(
      router,
      runtime,
      surface === "servers" || surface === "playback",
    );
    cleanup = () => {
      unsubscribeLanguage();
      unsubscribeNavigation();
      runtime.dispose();
    };
    root.render(
      <React.StrictMode>
        <QueryClientProvider client={runtime.queryClient}>
          <I18nextProvider i18n={i18n}>
            <RuntimeContext.Provider value={runtime}>
              <RouterProvider router={router} />
            </RuntimeContext.Provider>
          </I18nextProvider>
        </QueryClientProvider>
      </React.StrictMode>,
    );
  } catch (error) {
    runtime.dispose();
    if (!stopped)
      root.render(
        <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
          <BrandLogo />
          <p role="alert">{localizeError(systemLocale, error)}</p>
          <Button onClick={() => void start()}>{translate(systemLocale, "reload")}</Button>
        </main>,
      );
  }
}
window.addEventListener("beforeunload", () => {
  stopped = true;
  cleanup?.();
});
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    stopped = true;
    cleanup?.();
    root.unmount();
  });
void start();
