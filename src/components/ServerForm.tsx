import { OptionSelect } from "./OptionSelect";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { useId, useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import type { Server, AppState } from "../shared/types";
import type { MessageKey } from "../shared/i18n";
import type { Translator } from "../ui";

export function ServerForm({
  server,
  saving,
  onSave,
  onCancel,
  providers,
  t,
  submitLabel = "save",
}: {
  server: Partial<Server>;
  saving: boolean;
  onSave: (input: { id?: string; name: string; url: string; providerId: string }) => void;
  onCancel: () => void;
  providers: AppState["providers"];
  t: Translator;
  submitLabel?: MessageKey;
}) {
  const fieldId = useId();
  const [name, setName] = useState(server.name ?? "");
  const [url, setUrl] = useState(server.url ?? "");
  const [providerId, setProviderId] = useState(server.providerId ?? providers[0]?.id ?? "emby");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave({ id: server.id, name: name.trim() || t("myServer"), url: url.trim(), providerId });
  };
  return (
    <form
      className="my-6 w-full max-w-[510px] rounded-xl border bg-card p-6 [&>h2]:mb-[26px]"
      onSubmit={submit}
    >
      <h2>{t(server.id ? "editServer" : "addServer")}</h2>
      <div className="mt-[22px] grid gap-2.5">
        <Label htmlFor={`${fieldId}-provider`}>{t("serverType")}</Label>
        <OptionSelect
          id={`${fieldId}-provider`}
          label={t("serverType")}
          name="providerId"
          disabled={Boolean(server.id) || providers.length === 1}
          value={providerId}
          onValueChange={setProviderId}
          options={providers.map((provider) => ({ value: provider.id, label: provider.name }))}
          className="w-full"
        />
      </div>
      <div className="mt-[22px] grid gap-2.5">
        <Label htmlFor={`${fieldId}-url`}>{t("serverAddress")}</Label>
        <Input
          id={`${fieldId}-url`}
          aria-describedby={`${fieldId}-help`}
          autoFocus
          required
          type="text"
          inputMode="url"
          placeholder="https://emby.example.com"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          autoComplete="off"
        />
      </div>
      <p id={`${fieldId}-help`} className="mt-2 text-xs">
        {t("addressHelp")}
      </p>
      <div className="mt-[22px] grid gap-2.5">
        <Label htmlFor={`${fieldId}-name`}>
          {t("name")}
          <span className="text-[11px] font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Input
          id={`${fieldId}-name`}
          type="text"
          placeholder={t("myServer")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
        />
      </div>
      <p className="mt-[22px] text-xs">{t("signInNote")}</p>
      <div className="mt-[26px] flex justify-end gap-2.5">
        <Button variant="outline" type="button" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <LoaderCircle size={15} className="animate-spin" />}
          {t(saving ? "saving" : submitLabel)}
          <ArrowRight size={16} />
        </Button>
      </div>
    </form>
  );
}
