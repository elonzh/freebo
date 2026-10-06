import { useAppTranslation } from "../i18n";
import { useId, type ReactNode } from "react";
import { cn } from "../lib/utils";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Button } from "./ui/button";
import { Globe2, FolderOpen } from "lucide-react";
import type { AppState, PlayerKind, Platform } from "../shared/types";
import type { MessageKey } from "../shared/i18n";
import type { RunAction, SettingsPatch } from "../ui";
import { PlayerIcon } from "./IntegrationIcon";

const playerOptions: {
  kind: PlayerKind;
  name: string;
  platforms: Platform[];
  description: MessageKey;
}[] = [
  { kind: "iina", name: "IINA", platforms: ["darwin"], description: "iinaGuide" },
  { kind: "mpvnet", name: "mpv.net", platforms: ["win32"], description: "mpvnetGuide" },
  { kind: "potplayer", name: "PotPlayer", platforms: ["win32"], description: "potplayerGuide" },
  { kind: "mpc-hc", name: "MPC-HC", platforms: ["win32"], description: "mpcGuide" },
  { kind: "mpc-be", name: "MPC-BE", platforms: ["win32"], description: "mpcGuide" },
  { kind: "mpv", name: "mpv", platforms: ["darwin", "win32", "linux"], description: "mpvGuide" },
  { kind: "vlc", name: "VLC", platforms: ["darwin", "win32", "linux"], description: "vlcGuide" },
];

export function PlayerSetup({
  state,
  run,
  update,
  children,
}: {
  state: AppState;
  run: RunAction;
  update: (patch: SettingsPatch) => void;
  children?: ReactNode;
}) {
  const { t } = useAppTranslation();
  const fieldId = useId();
  return (
    <>
      <RadioGroup
        className="mt-5 mb-4 gap-0"
        aria-label={t("defaultPlayer")}
        value={state.settings.defaultPlayerId ?? ""}
        onValueChange={(defaultPlayerId) => update({ defaultPlayerId })}
      >
        {playerOptions
          .filter((option) => option.platforms.includes(state.platform))
          .flatMap((option) => {
            const installed = state.settings.players.filter(
              (player) => player.kind === option.kind && player.executable.trim(),
            );
            const choices = installed.length ? installed : [undefined];
            return choices.map((player, index) => {
              const rowId = `${fieldId}-${option.kind}-${index}`;
              const selected = Boolean(player && player.id === state.settings.defaultPlayerId);
              const details = (
                <>
                  {player ? (
                    <RadioGroupItem id={rowId} value={player.id} />
                  ) : (
                    <span aria-hidden="true" className="size-4 shrink-0" />
                  )}
                  <PlayerIcon kind={option.kind} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{player?.name ?? option.name}</span>
                    <span className="mt-1.5 block text-xs font-normal text-muted-foreground wrap-anywhere">
                      {player?.executable ?? t(option.description)}
                    </span>
                  </span>
                  {selected && (
                    <span className="shrink-0 text-[11px] font-normal text-primary">
                      {t("default")}
                    </span>
                  )}
                </>
              );
              return (
                <div
                  className="flex items-center gap-2 border-b py-1"
                  key={player?.id ?? option.kind}
                >
                  {player ? (
                    <Label
                      htmlFor={rowId}
                      className={cn(
                        "min-w-0 flex-1 cursor-pointer gap-3 rounded-lg px-3 py-3.5",
                        selected && "bg-accent",
                      )}
                    >
                      {details}
                    </Label>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3.5">
                      {details}
                    </div>
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    {!player && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${t("download")} · ${option.name}`}
                        title={t("download")}
                        onClick={() =>
                          void run("guide", (desktop) => desktop.openGuide(option.kind))
                        }
                      >
                        <Globe2 size={17} />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("manualPlayer", { name: option.name })}
                      title={t("manualHint")}
                      onClick={() =>
                        void run("choose", (desktop) => desktop.choosePlayer(option.kind))
                      }
                    >
                      <FolderOpen size={17} />
                    </Button>
                  </div>
                </div>
              );
            });
          })}
      </RadioGroup>
      {children}
    </>
  );
}
