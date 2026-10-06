import { useEffect } from "react";
import { Outlet, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { AppContext, useDesktopActions, useRuntime } from "./runtime/context";
import { useAppTranslation } from "./i18n";

export function App() {
  const runtime = useRuntime();
  const { data: state } = useQuery(runtime.stateOptions);
  const actions = useDesktopActions(runtime);
  const { t, locale, errorText } = useAppTranslation();
  const surface = new URLSearchParams(location.search).get("surface");
  const popup = surface === "servers" || surface === "playback";
  const theme = state?.settings.theme ?? "system";
  const pathname = useLocation({ select: (location) => location.pathname });
  const { clearError } = actions;
  useEffect(() => clearError(), [pathname, clearError]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () =>
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && systemTheme.matches),
      );
    sync();
    systemTheme.addEventListener("change", sync);
    return () => systemTheme.removeEventListener("change", sync);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.title = t(surface === "servers" ? "chooseServer" : "brand");
  }, [locale, surface, t]);
  const hasError = Boolean(actions.error);
  useEffect(() => {
    if (!popup) void runtime.api.showError(hasError).catch(() => {});
  }, [runtime, popup, hasError]);
  if (!state)
    return (
      <main className="flex min-h-[60vh] items-center justify-center gap-3 text-muted-foreground">
        <LoaderCircle className="animate-spin" />
        {t("loading", { name: t("brand") })}
        {actions.error && <p role="alert">{errorText(actions.error)}</p>}
      </main>
    );
  return (
    <AppContext.Provider value={{ state, runtime, ...actions }}>
      <Outlet />
    </AppContext.Provider>
  );
}
