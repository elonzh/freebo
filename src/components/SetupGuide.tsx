import { OptionSelect } from "./OptionSelect";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Globe2,
  LoaderCircle,
  MonitorPlay,
  RefreshCw,
} from "lucide-react";
import type { AppState, Server } from "../shared/types";
import type { Translator, RunAction, SettingsPatch } from "../ui";
import { PlayerSetup } from "./PlayerSetup";
import { ServerForm } from "./ServerForm";

export function SetupGuide({
  state,
  t,
  run,
  update,
  pending,
  finish,
}: {
  state: AppState;
  t: Translator;
  run: RunAction;
  update: (patch: SettingsPatch) => void;
  pending: string;
  finish: (serverId?: string) => void;
}) {
  const fieldId = useId();
  const [step, setStep] = useState<"welcome" | "player" | "server" | "done">("welcome");
  const [serverId, setServerId] = useState<string | undefined>(state.settings.servers[0]?.id);
  const [adding, setAdding] = useState(state.settings.servers.length === 0);
  const scanStarted = useRef(false);
  useEffect(() => {
    if (step !== "player" || state.settings.playerScanCompleted || scanStarted.current) return;
    scanStarted.current = true;
    void run("setup-scan", (desktop) => desktop.discoverPlayers());
  }, [step, state.settings.playerScanCompleted, run]);
  const player = state.settings.players.find(
    (player) => player.id === state.settings.defaultPlayerId,
  );
  const server = state.settings.servers.find((server) => server.id === serverId);
  const steps = ["setupPlayer", "setupServer", "setupComplete"] as const;
  const stepIndex = step === "player" ? 0 : step === "server" ? 1 : 2;
  const saveServer = (input: Partial<Server> & { name: string; url: string; providerId: string }) =>
    void run("setup-server", async (desktop) => {
      const updated = await desktop.saveServer(input);
      setServerId(updated.settings.servers.at(-1)?.id);
      setStep("done");
      return updated;
    });
  return (
    <div className="mx-auto flex min-h-full max-w-[760px] flex-col px-9 py-8 max-[650px]:px-5 max-[650px]:py-6">
      {step === "welcome" ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-[18px] py-8 text-center [&>h1]:mt-1 [&>p]:max-w-[48ch]">
          <img src="./icon.svg" alt="" width={56} height={56} />
          <h1>{t("setupWelcome")}</h1>
          <p>{t("setupDescription")}</p>
          <div className="my-2 flex items-center gap-3 text-muted-foreground">
            <Label htmlFor={`${fieldId}-language`}>{t("language")}</Label>
            <OptionSelect
              id={`${fieldId}-language`}
              label={t("language")}
              value={state.settings.language}
              onValueChange={(language) => update({ language })}
              options={[
                { value: "system", label: t("system") },
                { value: "zh", label: "中文" },
                { value: "en", label: "English" },
              ]}
            />
          </div>
          <Button onClick={() => setStep("player")}>
            {t("startSetup")}
            <ArrowRight size={16} />
          </Button>
          <Button variant="link" onClick={() => finish()}>
            {t("setupLater")}
          </Button>
        </section>
      ) : (
        <>
          <ol
            className="mb-8 flex justify-between gap-6 border-b pb-6 text-xs text-muted-foreground max-[650px]:gap-3 [&>li]:flex [&>li]:items-center [&>li]:gap-[9px] [&>li>span]:grid [&>li>span]:size-6 [&>li>span]:place-items-center [&>li>span]:rounded-full [&>li>span]:bg-(--address) [&>li>span]:tabular-nums"
            aria-label={t("setup")}
          >
            {steps.map((label, index) => (
              <li
                key={label}
                aria-current={index === stepIndex ? "step" : undefined}
                className={
                  index === stepIndex ? "font-semibold text-primary [&>span]:bg-accent!" : undefined
                }
              >
                <span>{index < stepIndex ? <Check size={14} /> : index + 1}</span>
                {t(label)}
              </li>
            ))}
          </ol>
          <section className="flex-1 [&_form]:max-w-none">
            {step === "player" && (
              <>
                <div className="flex items-center justify-between gap-5 [&_p]:mt-[7px] [&>span]:text-xs [&>span]:text-muted-foreground">
                  <h1>{t("setupPlayer")}</h1>
                  <Button
                    variant="outline"
                    disabled={Boolean(pending)}
                    onClick={() => void run("setup-scan", (desktop) => desktop.discoverPlayers())}
                  >
                    <RefreshCw
                      size={15}
                      className={pending === "setup-scan" ? "animate-spin" : ""}
                    />
                    {t("scan")}
                  </Button>
                </div>
                <p className="mt-2.5">{t("setupPlayerDescription")}</p>
                {pending === "setup-scan" ? (
                  <div className="flex items-center gap-3 py-9 text-muted-foreground" role="status">
                    <LoaderCircle className="animate-spin" size={20} />
                    {t("scanningPlayers")}
                  </div>
                ) : (
                  <PlayerSetup state={state} t={t} run={run} update={update} />
                )}
                <div className="mt-7 flex flex-wrap items-center justify-end gap-3 [&>:first-child]:mr-auto">
                  <Button variant="outline" onClick={() => setStep("welcome")}>
                    <ArrowLeft size={15} />
                    {t("previousStep")}
                  </Button>
                  <Button disabled={Boolean(pending)} onClick={() => setStep("server")}>
                    {t(player ? "nextStep" : "playerLater")}
                    <ArrowRight size={15} />
                  </Button>
                </div>
              </>
            )}
            {step === "server" && (
              <>
                <h1>{t("setupServer")}</h1>
                {adding ? (
                  <ServerForm
                    t={t}
                    providers={state.providers}
                    server={{}}
                    saving={pending === "setup-server"}
                    onSave={saveServer}
                    submitLabel="nextStep"
                    onCancel={() => {
                      if (state.settings.servers.length) setAdding(false);
                      else setStep("player");
                    }}
                  />
                ) : (
                  <div className="my-7 [&>button]:mt-4">
                    <div className="grid gap-2.5">
                      <Label htmlFor={`${fieldId}-server`}>{t("useExistingServer")}</Label>
                      <OptionSelect
                        id={`${fieldId}-server`}
                        label={t("useExistingServer")}
                        value={serverId ?? ""}
                        onValueChange={setServerId}
                        options={state.settings.servers.map((server) => ({
                          value: server.id,
                          label: server.name,
                        }))}
                        className="w-full"
                      />
                    </div>
                    <Button variant="link" onClick={() => setAdding(true)}>
                      {t("addServer")}
                    </Button>
                  </div>
                )}
                <div className="mt-7 flex flex-wrap items-center justify-end gap-3 [&>:first-child]:mr-auto">
                  <Button variant="outline" onClick={() => setStep("player")}>
                    <ArrowLeft size={15} />
                    {t("previousStep")}
                  </Button>
                  {!adding && (
                    <Button disabled={!serverId} onClick={() => setStep("done")}>
                      {t("nextStep")}
                      <ArrowRight size={15} />
                    </Button>
                  )}
                  {adding && (
                    <Button variant="link" onClick={() => setStep("done")}>
                      {t("setupLater")}
                    </Button>
                  )}
                </div>
              </>
            )}
            {step === "done" && (
              <>
                <h1>{t("setupComplete")}</h1>
                <p className="mt-2.5">{t("setupCompleteDescription")}</p>
                <dl className="my-6 [&>div]:flex [&>div]:justify-between [&>div]:gap-6 [&>div]:border-b [&>div]:py-[18px] [&_dt]:flex [&_dt]:items-center [&_dt]:gap-2.5 [&_dt]:text-muted-foreground [&_dd]:font-medium">
                  <div>
                    <dt>
                      <MonitorPlay size={17} />
                      {t("defaultPlayer")}
                    </dt>
                    <dd>{player?.name ?? t("playerNotConfigured")}</dd>
                  </div>
                  <div>
                    <dt>
                      <Globe2 size={17} />
                      {t("servers")}
                    </dt>
                    <dd>{server?.name ?? t("serverNotConfigured")}</dd>
                  </div>
                </dl>
                <div className="mt-7 flex flex-wrap items-center justify-end gap-3 [&>:first-child]:mr-auto">
                  <Button variant="outline" onClick={() => setStep("server")}>
                    <ArrowLeft size={15} />
                    {t("previousStep")}
                  </Button>
                  {server && (
                    <Button disabled={Boolean(pending)} onClick={() => finish(server.id)}>
                      {t("openServer")}
                      <ArrowRight size={15} />
                    </Button>
                  )}
                  <Button
                    variant={server ? "link" : "default"}
                    disabled={Boolean(pending)}
                    onClick={() => finish()}
                  >
                    {t("finishSetup")}
                  </Button>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
