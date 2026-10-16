import { useId, useState, type FormEvent } from "react";
import { FolderOpen, LoaderCircle } from "lucide-react";
import { useAppTranslation } from "../../i18n";
import type { CustomPlayerInput, DesktopAPI, Player } from "../../shared/types";
import type { MessageKey } from "../../shared/i18n";
import { customPlayerArgumentsError } from "../../shared/players";
import { Switch } from "../ui/switch";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

export function CustomPlayerForm({
  player,
  saving,
  chooseExecutable,
  onSave,
  onCancel,
}: {
  player?: Player;
  saving: boolean;
  chooseExecutable: DesktopAPI["choosePlayerExecutable"];
  onSave: (input: CustomPlayerInput) => void;
  onCancel: () => void;
}) {
  const { t } = useAppTranslation();
  const fieldId = useId();
  const [name, setName] = useState(player?.name ?? "");
  const [executable, setExecutable] = useState(player?.executable ?? "");
  const [argumentsText, setArgumentsText] = useState((player?.arguments ?? ["{url}"]).join("\n"));
  const [mpvIpc, setMpvIpc] = useState(player?.mpvIpc ?? false);
  const [choosing, setChoosing] = useState(false);
  const [argumentsError, setArgumentsError] = useState<MessageKey>();
  const title = t(player ? "editCustomPlayer" : "addCustomPlayer");
  const choose = async () => {
    setChoosing(true);
    try {
      const selected = await chooseExecutable();
      if (selected) {
        setExecutable(selected);
        if (!name.trim())
          setName(
            selected
              .replace(/\\/g, "/")
              .split("/")
              .at(-1)
              ?.replace(/\.exe$/i, "") ?? "",
          );
      }
    } finally {
      setChoosing(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const args = argumentsText.split(/\r?\n/).filter((argument) => argument.trim());
    const error = customPlayerArgumentsError(args, mpvIpc);
    setArgumentsError(error);
    if (error) return;
    onSave({
      id: player?.id,
      name: name.trim(),
      executable: executable.trim(),
      arguments: args,
      mpvIpc,
    });
  };
  return (
    <form
      aria-label={title}
      className="my-4 w-full max-w-[560px] rounded-xl border bg-card p-5"
      onSubmit={submit}
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${fieldId}-name`}>{t("name")}</Label>
          <Input
            id={`${fieldId}-name`}
            autoFocus
            required
            maxLength={100}
            value={name}
            disabled={saving}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${fieldId}-executable`}>{t("playerExecutable")}</Label>
          <div className="flex items-start gap-2">
            <Input
              id={`${fieldId}-executable`}
              required
              value={executable}
              disabled={saving || choosing}
              autoComplete="off"
              onChange={(event) => setExecutable(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={saving || choosing}
              aria-label={t("choosePlayerExecutable")}
              title={t("choosePlayerExecutable")}
              onClick={() => void choose()}
            >
              {choosing ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <FolderOpen size={17} />
              )}
            </Button>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${fieldId}-arguments`}>{t("playerArguments")}</Label>
          <Textarea
            id={`${fieldId}-arguments`}
            required
            rows={4}
            value={argumentsText}
            disabled={saving}
            aria-invalid={Boolean(argumentsError)}
            aria-describedby={`${fieldId}-arguments-help`}
            onChange={(event) => {
              setArgumentsText(event.target.value);
              setArgumentsError(undefined);
            }}
          />
          <p id={`${fieldId}-arguments-help`} className="text-xs text-muted-foreground">
            {t("playerArgumentsHint")}
          </p>
          {argumentsError && (
            <p role="alert" className="text-xs text-destructive">
              {t(argumentsError)}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-5">
          <Label htmlFor={`${fieldId}-mpv-ipc`}>{t("playerMpvIpc")}</Label>
          <Switch
            id={`${fieldId}-mpv-ipc`}
            checked={mpvIpc}
            disabled={saving}
            aria-describedby={`${fieldId}-control-help`}
            onCheckedChange={(checked) => {
              setMpvIpc(checked);
              setArgumentsError(undefined);
            }}
          />
        </div>
        <p id={`${fieldId}-control-help`} className="text-xs text-muted-foreground">
          {t(mpvIpc ? "customPlayerMpvGuide" : "customPlayerGuide")}
        </p>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={saving || choosing} onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={saving || choosing}>
          {saving && <LoaderCircle size={15} className="animate-spin" />}
          {t(saving ? "saving" : "save")}
        </Button>
      </div>
    </form>
  );
}
