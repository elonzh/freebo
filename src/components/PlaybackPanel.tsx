import { Slider } from "./ui/slider";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ExternalLink,
  ListVideo,
  LoaderCircle,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  X,
} from "lucide-react";
import type { AppState } from "../shared/types";
import { localizeError } from "../shared/i18n";
import { formatTime, type Translator, type RunAction } from "../ui";

export function PlaybackPanel({
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
  const [seekPosition, setSeekPosition] = useState<number | null>(null);
  const playback = state.playback;
  const playable = playback.status === "playing" || playback.status === "paused";
  const problem = error || playback.error || playback.syncError;
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") void window.desktop?.hidePlaybackPopup();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-card">
      <header className="flex items-center justify-between gap-3 border-b py-3 pr-4 pl-5 [&>h1]:flex [&>h1]:items-center [&>h1]:gap-2.5 [&>h1]:text-[15px]">
        <h1>
          <ListVideo size={18} />
          {t("playbackInfo")}
        </h1>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("closePlayback")}
          onClick={() => void run("close-popup", (desktop) => desktop.hidePlaybackPopup())}
        >
          <X size={17} />
        </Button>
      </header>
      {problem && (
        <div
          className="flex gap-2.5 border-b px-5 py-3.5 text-destructive [&_p]:text-xs [&_p]:text-inherit [&_p]:wrap-anywhere [&_button]:mt-1 [&_button]:text-xs"
          role="alert"
        >
          <AlertCircle size={17} />
          <div>
            <p>{localizeError(state.locale, problem)}</p>
            <Button
              variant="link"
              onClick={() =>
                void run("settings", (desktop) => desktop.showPage("settings", "players"))
              }
            >
              {t("checkSettings")}
            </Button>
          </div>
        </div>
      )}
      {playback.queue.length || playback.status === "preparing" ? (
        <>
          <section className="p-5 [&>h2]:wrap-anywhere [&>p]:mt-1.5 [&>p]:text-xs">
            <h2>{playback.title ?? t("preparing")}</h2>
            <p role="status">
              {playback.playerName ? `${playback.playerName} · ` : ""}
              {t(
                playback.status === "preparing"
                  ? "preparing"
                  : playback.status === "paused"
                    ? "paused"
                    : playback.status === "idle"
                      ? "ended"
                      : playback.status === "error"
                        ? "playbackError"
                        : "playing",
              )}
            </p>
            <div className="my-4 flex items-center justify-center gap-2.5">
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("previous")}
                disabled={!playable || playback.index === 0}
                onClick={() =>
                  void run("previous", (desktop) => desktop.control({ action: "previous" }))
                }
              >
                <SkipBack size={18} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 rounded-full bg-accent text-primary"
                aria-label={t(playback.status === "paused" ? "resume" : "pause")}
                disabled={!playable}
                onClick={() => void run("pause", (desktop) => desktop.control({ action: "pause" }))}
              >
                {playback.status === "preparing" ? (
                  <LoaderCircle className="animate-spin" size={23} />
                ) : playback.status === "paused" ? (
                  <Play size={23} />
                ) : (
                  <Pause size={23} />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("next")}
                disabled={!playable || playback.index >= playback.queue.length - 1}
                onClick={() => void run("next", (desktop) => desktop.control({ action: "next" }))}
              >
                <SkipForward size={18} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("stop")}
                disabled={playback.status === "idle"}
                onClick={() => void run("stop", (desktop) => desktop.control({ action: "stop" }))}
              >
                <Square size={16} />
              </Button>
            </div>
            <div className="flex flex-1 items-center gap-2.5 [&>span]:text-[11px] [&>span]:text-muted-foreground [&>span]:tabular-nums">
              <span>{formatTime(seekPosition ?? playback.position)}</span>
              <Slider
                aria-label={t("position")}
                min={0}
                max={playback.duration || 1}
                value={[seekPosition ?? Math.min(playback.position, playback.duration || 1)]}
                disabled={!playable || !playback.duration}
                onValueChange={([seconds]) => setSeekPosition(seconds)}
                onValueCommit={([seconds]) => {
                  setSeekPosition(null);
                  void run("seek", (desktop) => desktop.control({ action: "seek", seconds }));
                }}
              />
              <span>{formatTime(playback.duration)}</span>
            </div>
            <Button
              variant="link"
              className="mt-3.5"
              disabled={!state.playbackSource}
              onClick={() => void run("playing-item", (desktop) => desktop.openPlaybackItem())}
            >
              <ExternalLink size={15} />
              {t("openPlayingItem")}
            </Button>
          </section>
          <section className="min-h-0 flex-1 overflow-auto border-t px-3 pt-4 pb-3 [&>div]:px-2 [&>div]:pb-3 [&_h2]:text-sm">
            <div className="flex items-center justify-between gap-5 [&_p]:mt-[7px] [&>span]:text-xs [&>span]:text-muted-foreground">
              <h2>{t("queue")}</h2>
              <span>{t("itemCount", { count: playback.queue.length })}</span>
            </div>
            <ol>
              {playback.queue.map((item, index) => (
                <li key={`${item.id}-${index}`}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "h-auto w-full justify-start gap-3 px-2 py-3 text-left whitespace-normal [&>span]:min-w-5 [&>span]:text-[11px] [&>span]:text-muted-foreground [&>span]:tabular-nums [&>strong]:flex-1 [&>strong]:font-medium [&>strong]:wrap-anywhere",
                      index === playback.index && "bg-accent text-primary",
                    )}
                    aria-current={index === playback.index ? "true" : undefined}
                    disabled={!playable}
                    onClick={() =>
                      void run("jump", (desktop) => desktop.control({ action: "jump", index }))
                    }
                  >
                    <span>{index + 1}</span>
                    <strong>{item.title}</strong>
                    {index === playback.index && <Play size={13} />}
                  </Button>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : (
        <section className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center [&>svg]:text-muted-foreground">
          <MonitorPlaceholder />
          <h2>{t("noPlayback")}</h2>
          <p>{t("noPlaybackDescription")}</p>
        </section>
      )}
    </main>
  );
}
function MonitorPlaceholder() {
  return <ListVideo size={32} />;
}
