import { UserFacingError } from "../../src/shared/i18n";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import type { Settings, Server } from "../../src/shared/types";

export function normalizeServerUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`,
    );
  } catch {
    throw new UserFacingError("invalidUrl");
  }
  if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password)
    throw new UserFacingError("invalidUrl");
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

export const defaultSettings: Settings = {
  servers: [],
  players: [],
  autoNext: true,
  fullscreen: false,
  theme: "system",
  language: "system",
  setupCompleted: false,
  playerScanCompleted: false,
  runInBackground: true,
  remindOnClose: true,
};

const serverSchema = z.object({
  id: z.uuid(),
  providerId: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/)
    .default("emby"),
  name: z.string().trim().max(100).default(""),
  url: z.string().transform(normalizeServerUrl),
});
const playerSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["iina", "mpv", "mpvnet", "vlc", "potplayer", "mpc-hc", "mpc-be"]),
  executable: z.string().min(1),
  prefixArgs: z.array(z.string()).default(() => []),
  manual: z.boolean().optional(),
});
export const settingsSchema = z.object({
  servers: z.array(serverSchema).default(() => structuredClone(defaultSettings.servers)),
  activeServerId: z.string().optional(),
  players: z.array(playerSchema).default(() => structuredClone(defaultSettings.players)),
  defaultPlayerId: z.string().optional(),
  autoNext: z.boolean().default(defaultSettings.autoNext),
  fullscreen: z.boolean().default(defaultSettings.fullscreen),
  theme: z.enum(["system", "dark", "light"]).default(defaultSettings.theme),
  language: z.enum(["system", "zh", "en"]).default(defaultSettings.language),
  setupCompleted: z.boolean().default(defaultSettings.setupCompleted),
  playerScanCompleted: z.boolean().default(defaultSettings.playerScanCompleted),
  runInBackground: z.boolean().default(defaultSettings.runInBackground),
  remindOnClose: z.boolean().default(defaultSettings.remindOnClose),
});

export type SettingsDiagnostic =
  | { type: "read-failed" | "reset-failed"; reason: string }
  | { type: "reset" };

function settingsFailureReason(error: unknown): string {
  if (error instanceof z.ZodError)
    return error.issues
      .slice(0, 8)
      .map((issue) => `${issue.path.join(".") || "settings"}: ${issue.code}`)
      .join("; ");
  if (error instanceof SyntaxError) {
    // JSON parser messages can include fragments of the original file.
    const location = error.message.match(/(?:position \d+|line \d+ column \d+)/)?.[0];
    return location ? `Invalid JSON (${location})` : "Invalid JSON";
  }
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  if (typeof code === "string" && /^[A-Z][A-Z0-9_]+$/.test(code)) return code;
  if (error instanceof UserFacingError) return "Invalid server URL";
  return "Unexpected settings error";
}

export class SettingsStore {
  value: Settings = structuredClone(defaultSettings);
  private writing: Promise<void> = Promise.resolve();
  constructor(
    private readonly path: string,
    private readonly report: (event: SettingsDiagnostic) => void = () => {},
  ) {}
  async load(): Promise<Settings> {
    try {
      this.value = settingsSchema.parse(JSON.parse(await readFile(this.path, "utf8")));
    } catch (error) {
      this.value = structuredClone(defaultSettings);
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return this.value;
      this.report({ type: "read-failed", reason: settingsFailureReason(error) });
      try {
        await this.save(this.value);
        this.report({ type: "reset" });
      } catch (resetError) {
        this.report({ type: "reset-failed", reason: settingsFailureReason(resetError) });
      }
    }
    return this.value;
  }
  async save(value: Settings): Promise<void> {
    this.value = settingsSchema.parse(value);
    const data = JSON.stringify(this.value, null, 2);
    this.writing = this.writing
      .catch(() => {})
      .then(async () => {
        await mkdir(dirname(this.path), { recursive: true });
        const temporary = `${this.path}.tmp`;
        await writeFile(temporary, data, { mode: 0o600 });
        await rename(temporary, this.path);
      });
    await this.writing;
  }
  async upsertServer(
    input: {
      id?: string;
      name: string;
      url: string;
      providerId: string;
    },
    beforeSave?: (server: Server) => Promise<void>,
  ): Promise<Server> {
    const server = serverSchema.parse({ ...input, id: input.id ?? randomUUID() });
    if (
      this.value.servers.some(
        (s) => s.id !== server.id && s.url === server.url && s.providerId === server.providerId,
      )
    )
      throw new UserFacingError("serverDuplicate");
    await beforeSave?.(server);
    const servers = this.value.servers.filter((s) => s.id !== server.id).concat(server);
    await this.save({ ...this.value, servers });
    return server;
  }
}
