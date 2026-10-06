import { OptionSelect } from "./OptionSelect";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import type { Server, AppState, ServerInput, DesktopAPI } from "../shared/types";
import { localizeError, type MessageKey } from "../shared/i18n";
import type { Translator } from "../ui";

export function ServerForm({
  server,
  saving,
  onSave,
  onCancel,
  providers,
  credentialsAvailable,
  loadCredentials,
  testConnection,
  locale,
  t,
  submitLabel = "save",
}: {
  server: Partial<Server>;
  saving: boolean;
  onSave: (input: ServerInput) => void;
  onCancel: () => void;
  providers: AppState["providers"];
  credentialsAvailable: boolean;
  loadCredentials?: DesktopAPI["getServerCredentials"];
  testConnection: DesktopAPI["testServerConnection"];
  locale: AppState["locale"];
  t: Translator;
  submitLabel?: MessageKey;
}) {
  const fieldId = useId();
  const [name, setName] = useState(server.name ?? "");
  const [url, setUrl] = useState(server.url ?? "");
  const [providerId, setProviderId] = useState(server.providerId ?? providers[0]?.id ?? "emby");
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [credentialsChanged, setCredentialsChanged] = useState(false);
  const [loadingCredentials, setLoadingCredentials] = useState(
    Boolean(server.id && loadCredentials),
  );
  const [credentialsError, setCredentialsError] = useState("");
  const [testing, setTesting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [connectionError, setConnectionError] = useState(false);
  const inputVersion = useRef(0);
  const testRun = useRef(0);
  const editedUrl = useRef(false);
  useEffect(
    () => () => {
      testRun.current++;
    },
    [],
  );
  const invalidateTest = () => {
    inputVersion.current++;
    setConnectionMessage("");
  };
  useEffect(() => {
    if (!server.id || !loadCredentials) return;
    let current = true;
    void loadCredentials(server.id)
      .then((saved) => {
        if (!current || editedUrl.current) return;
        setHasSavedCredentials(Boolean(saved));
        setUsername(saved?.username ?? "");
        setPassword(saved?.password ?? "");
      })
      .catch((error) => {
        if (current) setCredentialsError(String(error));
      })
      .finally(() => {
        if (current) setLoadingCredentials(false);
      });
    return () => {
      current = false;
    };
  }, [server.id, loadCredentials]);
  const forget = () => {
    invalidateTest();
    setHasSavedCredentials(false);
    setUsername("");
    setPassword("");
    setCredentialsChanged(true);
    setCredentialsError("");
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave({
      id: server.id,
      name: name.trim() || t("myServer"),
      url: url.trim(),
      providerId,
      credentials: username.trim()
        ? { username: username.trim(), password }
        : credentialsChanged
          ? null
          : undefined,
    });
  };
  const checkConnection = async () => {
    const run = ++testRun.current;
    const version = inputVersion.current;
    setTesting(true);
    setConnectionMessage("");
    try {
      const result = await testConnection({
        id: server.id,
        url: url.trim(),
        providerId,
        credentials: username.trim() ? { username: username.trim(), password } : undefined,
      });
      if (testRun.current !== run || inputVersion.current !== version) return;
      setConnectionError(false);
      setConnectionMessage(
        t(result.authenticated ? "connectionVerified" : "serverReachable", {
          name: result.serverName,
        }),
      );
    } catch (error) {
      if (testRun.current !== run || inputVersion.current !== version) return;
      setConnectionError(true);
      setConnectionMessage(localizeError(locale, String(error)));
    } finally {
      if (testRun.current === run) setTesting(false);
    }
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
          onValueChange={(value) => {
            setProviderId(value);
            invalidateTest();
          }}
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
          onChange={(event) => {
            setUrl(event.target.value);
            invalidateTest();
            if (server.id) {
              editedUrl.current = true;
              forget();
            }
          }}
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
      <div className="mt-6 border-t pt-5">
        {loadingCredentials && <LoaderCircle className="mt-3 animate-spin" size={15} />}
        {credentialsError && (
          <p role="alert" className="mt-3 text-xs text-destructive">
            {localizeError(locale, credentialsError)}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2.5">
            <Label htmlFor={`${fieldId}-username`}>{t("username")}</Label>
            <Input
              id={`${fieldId}-username`}
              autoComplete="username"
              required={Boolean(password)}
              maxLength={200}
              value={username}
              disabled={saving || loadingCredentials || !credentialsAvailable}
              onChange={(event) => {
                setUsername(event.target.value);
                setCredentialsChanged(true);
                invalidateTest();
              }}
            />
          </div>
          <div className="grid gap-2.5">
            <Label htmlFor={`${fieldId}-password`}>{t("password")}</Label>
            <Input
              id={`${fieldId}-password`}
              type="password"
              autoComplete="current-password"
              maxLength={4096}
              value={password}
              disabled={saving || loadingCredentials || !credentialsAvailable}
              onChange={(event) => {
                setPassword(event.target.value);
                setCredentialsChanged(true);
                invalidateTest();
              }}
            />
          </div>
        </div>
        <p className="mt-3 text-xs">
          {t(credentialsAvailable ? "credentialsHint" : "credentialsUnavailable")}
        </p>
        {server.id && (hasSavedCredentials || credentialsError) && (
          <Button
            variant="link"
            className="mt-3 h-auto p-0 text-xs"
            disabled={saving || loadingCredentials}
            onClick={forget}
          >
            {t("forgetCredentials")}
          </Button>
        )}
      </div>
      <div className="mt-5">
        <Button
          variant="outline"
          type="button"
          name="test-connection"
          onClick={(event) => {
            if (event.currentTarget.form?.reportValidity()) void checkConnection();
          }}
          disabled={saving || loadingCredentials || testing || !url.trim()}
        >
          {testing && <LoaderCircle size={15} className="animate-spin" />}
          {t(testing ? "testingConnection" : "testConnection")}
        </Button>
        {connectionMessage && (
          <p
            role={connectionError ? "alert" : "status"}
            className={`mt-3 text-xs ${connectionError ? "text-destructive" : "text-primary"}`}
          >
            {connectionMessage}
          </p>
        )}
      </div>
      <p className="mt-[22px] text-xs">{t("signInNote")}</p>
      <div className="mt-[26px] flex justify-end gap-2.5">
        <Button variant="outline" type="button" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={saving || loadingCredentials || testing}>
          {saving && <LoaderCircle size={15} className="animate-spin" />}
          {t(saving ? "saving" : submitLabel)}
          <ArrowRight size={16} />
        </Button>
      </div>
    </form>
  );
}
