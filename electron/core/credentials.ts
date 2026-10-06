import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import type { Server, ServerCredentials } from "../../src/shared/types";
import { UserFacingError } from "../../src/shared/i18n";

export const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(200),
  password: z.string().max(4096),
});
const vaultSchema = z.object({
  version: z.literal(1),
  entries: z.record(
    z.string(),
    z.object({ url: z.string(), providerId: z.string(), encrypted: z.string().min(1) }),
  ),
});
type Vault = z.infer<typeof vaultSchema>;
export interface CredentialEncryption {
  available(): Promise<boolean>;
  encrypt(value: string): Promise<Buffer>;
  decrypt(value: Buffer): Promise<string>;
}

// Bind credentials to the intended server origin and reverse-proxy path.
export function credentialOriginMatches(server: Server, frameUrl: string): boolean {
  try {
    const registered = new URL(server.url);
    const frame = new URL(frameUrl);
    const prefix = registered.pathname.replace(/\/+$/, "");
    return (
      ["https:", "http:"].includes(frame.protocol) &&
      !frame.username &&
      !frame.password &&
      registered.origin === frame.origin &&
      (frame.pathname === prefix || frame.pathname.startsWith(`${prefix}/`))
    );
  } catch {
    return false;
  }
}

export class CredentialStore {
  private value: Vault = { version: 1, entries: {} };
  private loaded = false;
  private writing: Promise<void> = Promise.resolve();
  constructor(
    private readonly path: string,
    private readonly encryption: CredentialEncryption,
  ) {}
  async load(): Promise<void> {
    try {
      this.value = vaultSchema.parse(JSON.parse(await readFile(this.path, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        throw new UserFacingError("credentialsUnreadable");
    }
    this.loaded = true;
  }
  async available(): Promise<boolean> {
    return this.loaded && this.encryption.available();
  }
  async get(server: Server): Promise<ServerCredentials | null> {
    await this.writing.catch(() => {});
    if (!this.loaded) throw new UserFacingError("credentialsUnreadable");
    const entry = this.value.entries[server.id];
    if (!entry || entry.url !== server.url || entry.providerId !== server.providerId) return null;
    if (!(await this.available())) throw new UserFacingError("credentialsUnavailable");
    try {
      return credentialsSchema.parse(
        JSON.parse(await this.encryption.decrypt(Buffer.from(entry.encrypted, "base64"))),
      );
    } catch {
      throw new UserFacingError("credentialsUnreadable");
    }
  }
  async set(server: Server, credentials: ServerCredentials | null): Promise<void> {
    const parsed = credentials === null ? null : credentialsSchema.parse(credentials);
    const operation = this.writing
      .catch(() => {})
      .then(async () => {
        if (!this.loaded) throw new UserFacingError("credentialsUnreadable");
        const next = structuredClone(this.value);
        if (parsed) {
          if (!(await this.available())) throw new UserFacingError("credentialsUnavailable");
          let encrypted: Buffer;
          try {
            encrypted = await this.encryption.encrypt(JSON.stringify(parsed));
          } catch {
            throw new UserFacingError("credentialsUnavailable");
          }
          next.entries[server.id] = {
            url: server.url,
            providerId: server.providerId,
            encrypted: encrypted.toString("base64"),
          };
        } else delete next.entries[server.id];
        await mkdir(dirname(this.path), { recursive: true });
        const temporary = `${this.path}.tmp`;
        await writeFile(temporary, JSON.stringify(next, null, 2), { mode: 0o600 });
        await rename(temporary, this.path);
        this.value = next;
      });
    this.writing = operation;
    await operation;
  }
}
