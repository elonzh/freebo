import { useId, useState } from "react";
import { cn } from "../lib/utils";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./ui/collapsible";
import { Button } from "./ui/button";
import { MonitorPlay, ChevronDown, ExternalLink, FolderOpen } from "lucide-react";
import type { AppState, PlayerKind } from "../shared/types";
import type { MessageKey } from "../shared/i18n";
import type { Translator, RunAction, SettingsPatch } from "../ui";

const guides: { kind: PlayerKind; name: string; platforms: string[]; description: MessageKey }[] = [
  { kind: "iina", name: "IINA", platforms: ["darwin"], description: "iinaGuide" },
  { kind: "mpvnet", name: "mpv.net", platforms: ["win32"], description: "mpvnetGuide" },
  { kind: "mpv", name: "mpv", platforms: ["darwin", "win32", "linux"], description: "mpvGuide" },
  { kind: "vlc", name: "VLC", platforms: ["darwin", "win32", "linux"], description: "vlcGuide" },
];

export function PlayerSetup({
  state,
  t,
  run,
  update,
}: {
  state: AppState;
  t: Translator;
  run: RunAction;
  update: (patch: SettingsPatch) => void;
}) {
  const fieldId = useId();
  const [guideOpen, setGuideOpen] = useState<boolean>();
  const currentPlayer = state.settings.players.find(
    (player) => player.id === state.settings.defaultPlayerId,
  );
  return (
    <>
      <p className="mt-2.5">{t("playersDescription")}</p>
      {state.settings.players.length ? (
        <RadioGroup
          className="mt-5 mb-4 gap-[5px]"
          aria-label={t("defaultPlayer")}
          value={currentPlayer?.id ?? ""}
          onValueChange={(defaultPlayerId) => update({ defaultPlayerId })}
        >
          {state.settings.players.map((player) => (
            <Label
              htmlFor={`${fieldId}-${player.id}`}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3.5",
                currentPlayer?.id === player.id && "bg-accent",
              )}
              key={player.id}
            >
              <RadioGroupItem id={`${fieldId}-${player.id}`} value={player.id} />
              <span className="min-w-0 flex-1 [&_strong]:block [&_strong]:text-sm [&_small]:mt-1.5 [&_small]:block [&_small]:text-[11px] [&_small]:font-normal [&_small]:text-muted-foreground [&_small]:wrap-anywhere">
                <strong>{player.name}</strong>
                <small>{player.executable}</small>
              </span>
              {currentPlayer?.id === player.id && (
                <span className="flex-none! text-[11px] font-normal text-primary">
                  {t("default")}
                </span>
              )}
            </Label>
          ))}
        </RadioGroup>
      ) : (
        <div className="flex items-center gap-[17px] py-[18px] [&_svg]:text-muted-foreground [&_strong]:text-sm [&_p]:mt-[5px]">
          <MonitorPlay size={27} />
          <div>
            <strong>{t("noPlayers")}</strong>
            <p>{t("noPlayersDescription")}</p>
          </div>
        </div>
      )}
      <Collapsible
        className="mt-[18px] border-y py-4"
        open={guideOpen ?? !state.settings.players.length}
        onOpenChange={setGuideOpen}
      >
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="group w-full justify-between px-0">
            {t("installGuide")}
            <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {guides
            .filter((guide) => guide.platforms.includes(state.platform))
            .map((guide) => (
              <article
                className="flex items-center gap-2.5 border-b py-[18px] max-[650px]:flex-wrap [&>div]:flex-1 max-[650px]:[&>div]:basis-full [&_p]:mt-[5px] [&_p]:text-xs"
                key={guide.kind}
              >
                <div>
                  <h3>{guide.name}</h3>
                  <p>{t(guide.description)}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => void run("guide", (desktop) => desktop.openGuide(guide.kind))}
                >
                  {t("download")}
                  <ExternalLink size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("manualPlayer", { name: guide.name })}
                  title={t("manualHint")}
                  onClick={() => void run("choose", (desktop) => desktop.choosePlayer(guide.kind))}
                >
                  <FolderOpen size={17} />
                </Button>
              </article>
            ))}
          <p className="mt-[18px] max-w-[70ch] text-xs">{t("guideNote")}</p>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
