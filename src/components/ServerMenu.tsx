import { Plus, X } from "lucide-react";
import type { AppState } from "../shared/types";
import type { RunAction, Translator } from "../ui";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { ServerIcon } from "./IntegrationIcon";

export function ServerMenu({
  state,
  t,
  run,
  error,
}: {
  state: AppState;
  t: Translator;
  run: RunAction;
  error: string;
}) {
  return (
    <main className="flex h-screen flex-col bg-popover text-popover-foreground">
      <header className="flex items-center justify-between px-4 py-2">
        <h2 className="text-sm">{t("chooseServer")}</h2>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("closeServerMenu")}
          onClick={() => void run("close", (desktop) => desktop.hideServerPopup())}
        >
          <X className="size-4" />
        </Button>
      </header>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" aria-label={t("servers")}>
        {state.settings.servers.map((server, index) => (
          <Button
            variant="ghost"
            autoFocus={index === 0}
            key={server.id}
            className={cn(
              "h-auto w-full justify-start gap-3 px-3 py-3 text-left",
              state.browser.serverId === server.id && "bg-accent",
            )}
            onClick={() => void run("open", (desktop) => desktop.openServer(server.id))}
          >
            <ServerIcon providerId={server.providerId} className="size-6" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{server.name}</span>
              <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">
                {server.url}
              </span>
            </span>
          </Button>
        ))}
        {!state.settings.servers.length && <p className="px-3 py-4 text-xs">{t("noServers")}</p>}
      </nav>
      {error && (
        <p role="alert" className="px-4 pb-3 text-xs text-destructive">
          {error}
        </p>
      )}
      <footer className="border-t p-2">
        <Button
          variant="ghost"
          autoFocus={!state.settings.servers.length}
          className="w-full justify-start gap-3"
          onClick={() => void run("add", (desktop) => desktop.addServer())}
        >
          <Plus className="size-4" />
          {t("addServer")}
        </Button>
      </footer>
    </main>
  );
}
