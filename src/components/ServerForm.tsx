import { OptionSelect } from "./OptionSelect";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { ServerIcon } from "./IntegrationIcon";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loadingCredentials, setLoadingCredentials] = useState(
    Boolean(server.id && loadCredentials),
  );
  const [credentialsError, setCredentialsError] = useState("");
  const [testing, setTesting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [connectionNotice, setConnectionNotice] = useState("");
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
    setConnectionNotice("");
  };
  useEffect(() => {
    if (!server.id || !loadCredentials) return;
    let current = true;
    void loadCredentials(server.id)
      .then((saved) => {
        if (!current || editedUrl.current) return;
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
  const resetAccountFields = () => {
    setUsername("");
    setPassword("");
    setShowPassword(false);
    setCredentialsError("");
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave({
      id: server.id,
      name: name.trim(),
      url: url.trim(),
      providerId,
      credentials: username.trim() ? { username: username.trim(), password } : undefined,
    });
  };
  const checkConnection = async () => {
    const run = ++testRun.current;
    const version = inputVersion.current;
    setTesting(true);
    setConnectionMessage("");
    setConnectionNotice("");
    try {
      const result = await testConnection({
        id: server.id,
        url: url.trim(),
        providerId,
        credentials: username.trim() ? { username: username.trim(), password } : undefined,
      });
      if (testRun.current !== run || inputVersion.current !== version) return;
      setConnectionError(false);
      setConnectionMessage(t(result.authenticated ? "connectionVerified" : "serverReachable"));
      setConnectionNotice(result.logoutFailed ? t("connectionVerifiedLogoutFailed") : "");
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
      aria-label={t(server.id ? "editServer" : "addServer")}
      className="@container my-4 w-full max-w-[560px] rounded-xl border bg-card p-5"
      onSubmit={submit}
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
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
            options={providers.map((provider) => ({
              value: provider.id,
              label: provider.name,
              icon: <ServerIcon providerId={provider.id} className="size-5" />,
            }))}
            className="w-full"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${fieldId}-name`}>
            {t("name")}
            <span className="text-[11px] font-normal text-muted-foreground">{t("optional")}</span>
          </Label>
          <Input
            id={`${fieldId}-name`}
            type="text"
            placeholder={t("serverNamePlaceholder")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
          />
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        <Label htmlFor={`${fieldId}-url`}>{t("serverAddress")}</Label>
        <Input
          id={`${fieldId}-url`}
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
              resetAccountFields();
            }
          }}
          autoComplete="off"
        />
      </div>
      <div className="mt-4">
        {loadingCredentials && <LoaderCircle className="mt-3 animate-spin" size={15} />}
        {credentialsError && (
          <p role="alert" className="mt-3 text-xs text-destructive">
            {localizeError(locale, credentialsError)}
          </p>
        )}
        <div className="grid gap-4 @min-[24rem]:grid-cols-2">
          <div className="grid gap-2">
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
                setCredentialsError("");
                invalidateTest();
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${fieldId}-password`}>{t("password")}</Label>
            <div className="relative">
              <Input
                id={`${fieldId}-password`}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                maxLength={4096}
                value={password}
                className="pr-10"
                disabled={saving || loadingCredentials || !credentialsAvailable}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setCredentialsError("");
                  invalidateTest();
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-0.5 right-0.5 text-muted-foreground"
                aria-label={t(showPassword ? "hidePassword" : "showPassword")}
                aria-controls={`${fieldId}-password`}
                disabled={saving || loadingCredentials || !credentialsAvailable}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs">
          {t(credentialsAvailable ? "credentialsHint" : "credentialsUnavailable")}
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-3 @min-[24rem]:flex-row @min-[24rem]:items-center">
        <div className="flex h-12 min-w-0 flex-1 items-center gap-3" aria-busy={testing}>
          <Button
            variant="outline"
            type="button"
            name="test-connection"
            className="shrink-0"
            onClick={(event) => {
              if (event.currentTarget.form?.reportValidity()) void checkConnection();
            }}
            disabled={saving || loadingCredentials || testing || !url.trim()}
          >
            {testing && <LoaderCircle size={15} className="animate-spin" />}
            {t(testing ? "testingConnection" : "testConnection")}
          </Button>
          <div className="max-h-full min-w-0 flex-1 overflow-y-auto">
            {connectionMessage && (
              <p
                role={connectionError ? "alert" : "status"}
                className={`text-xs wrap-anywhere ${connectionError ? "text-destructive" : "text-primary"}`}
              >
                {connectionMessage}
              </p>
            )}
            {connectionNotice && (
              <p className="mt-1 text-xs text-muted-foreground">{connectionNotice}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2">
          <Button variant="outline" type="button" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={saving || loadingCredentials || testing}>
            {saving && <LoaderCircle size={15} className="animate-spin" />}
            {t(saving ? "saving" : submitLabel)}
          </Button>
        </div>
      </div>
    </form>
  );
}
