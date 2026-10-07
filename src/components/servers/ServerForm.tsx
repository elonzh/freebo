import { useMutation, useQuery } from "@tanstack/react-query";
import { useAppTranslation } from "../../i18n";
import { OptionSelect } from "../shared/OptionSelect";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { ServerIcon } from "../shared/IntegrationIcon";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import type {
  Server,
  AppState,
  ServerInput,
  DesktopAPI,
  ServerConnectionResult,
} from "../../shared/types";
import { localizeError, type MessageKey } from "../../shared/i18n";

export function ServerForm({
  server,
  saving,
  onSave,
  onCancel,
  providers,
  credentialsAvailable,
  loadCredentials,
  testConnection,
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
  submitLabel?: MessageKey;
}) {
  const { t, locale } = useAppTranslation();
  const fieldId = useId();
  const [name, setName] = useState(server.name ?? "");
  const [url, setUrl] = useState(server.url ?? "");
  const [providerId, setProviderId] = useState(server.providerId ?? providers[0]?.id ?? "emby");
  const supportsCredentials =
    providers.find((provider) => provider.id === providerId)?.supportsCredentials !== false;
  const [usernameDraft, setUsername] = useState<string>();
  const [passwordDraft, setPassword] = useState<string>();
  const [showPassword, setShowPassword] = useState(false);
  const [credentialsDismissed, setCredentialsDismissed] = useState(false);
  const [feedback, setFeedback] = useState<
    { result: ServerConnectionResult } | { error: unknown } | null
  >(null);
  const inputVersion = useRef(0);
  const testRun = useRef(0);
  const [editedUrl, setEditedUrl] = useState(false);
  const credentialQuery = useQuery({
    queryKey: ["credentials", server.id, server.url],
    queryFn: () => loadCredentials!(server.id!),
    enabled: Boolean(
      server.id && loadCredentials && credentialsAvailable && supportsCredentials && !editedUrl,
    ),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    networkMode: "always",
  });
  const loadingCredentials = credentialQuery.isFetching;
  const credentialsError = credentialsDismissed ? null : credentialQuery.error;
  const username = usernameDraft ?? (!editedUrl ? credentialQuery.data?.username : undefined) ?? "";
  const password = passwordDraft ?? (!editedUrl ? credentialQuery.data?.password : undefined) ?? "";
  useEffect(
    () => () => {
      testRun.current++;
    },
    [],
  );
  const connectionTest = useMutation({
    mutationKey: ["connection-test"],
    mutationFn: () =>
      testConnection({
        id: server.id,
        url: url.trim(),
        providerId,
        credentials:
          supportsCredentials && username.trim()
            ? { username: username.trim(), password }
            : undefined,
      }),
    retry: false,
    gcTime: 0,
    networkMode: "always",
  });
  const testing = connectionTest.isPending;
  const connectionError = Boolean(feedback && "error" in feedback);
  const connectionMessage = !feedback
    ? ""
    : "error" in feedback
      ? localizeError(locale, feedback.error)
      : t(feedback.result.authenticated ? "connectionVerified" : "serverReachable");
  const connectionNotice =
    feedback && "result" in feedback && feedback.result.logoutFailed
      ? t("connectionVerifiedLogoutFailed")
      : "";
  const invalidateTest = () => {
    inputVersion.current++;
    setFeedback(null);
  };
  const resetAccountFields = () => {
    setUsername("");
    setPassword("");
    setShowPassword(false);
    setCredentialsDismissed(true);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave({
      id: server.id,
      name: name.trim(),
      url: url.trim(),
      providerId,
      credentials:
        supportsCredentials && username.trim()
          ? { username: username.trim(), password }
          : undefined,
    });
  };
  const checkConnection = async () => {
    const run = ++testRun.current;
    const version = inputVersion.current;
    setFeedback(null);
    try {
      const result = await connectionTest.mutateAsync();
      if (testRun.current === run && inputVersion.current === version) setFeedback({ result });
    } catch (error) {
      if (testRun.current === run && inputVersion.current === version) setFeedback({ error });
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
              resetAccountFields();
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
          placeholder={
            providerId === "plex"
              ? "http://192.168.1.10:32400"
              : `https://${providerId}.example.com`
          }
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            invalidateTest();
            if (server.id) {
              setEditedUrl(true);
              resetAccountFields();
            }
          }}
          autoComplete="off"
        />
      </div>
      {supportsCredentials ? (
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
                  setCredentialsDismissed(true);
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
                    setCredentialsDismissed(true);
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
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">{t("plexWebSignIn")}</p>
      )}
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
