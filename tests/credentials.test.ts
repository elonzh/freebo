import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CredentialStore, credentialOriginMatches } from "../electron/core/credentials";
import { SettingsStore } from "../electron/core/settings";
import type { Server } from "../src/shared/types";

const server: Server = {
  id: "2f1f7d4e-7919-4bfa-92b8-609bc957fe69",
  name: "Test Emby",
  providerId: "emby",
  url: "https://example.test/media",
};
const login = { username: "test-account", password: "secret-test-password" };
const directories: string[] = [];
function encryption() {
  const key = randomBytes(32);
  return {
    available: vi.fn(async () => true),
    encrypt: vi.fn(async (value: string) => {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    }),
    decrypt: vi.fn(async (value: Buffer) => {
      const decipher = createDecipheriv("aes-256-gcm", key, value.subarray(0, 12));
      decipher.setAuthTag(value.subarray(12, 28));
      return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString(
        "utf8",
      );
    }),
  };
}
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "freebo-credentials-"));
  directories.push(directory);
  const path = join(directory, "credentials.json");
  const crypto = encryption();
  const store = new CredentialStore(path, crypto);
  await store.load();
  return { path, crypto, store, directory };
}
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("saved server credentials", () => {
  it("encrypts both fields outside settings, restores after restart, and restricts file permissions", async () => {
    const { path, crypto, store, directory } = await setup();
    const settings = new SettingsStore(join(directory, "settings.json"));
    const input = { ...server, credentials: login };
    await settings.upsertServer(input);
    await store.set(server, login);
    for (const filename of [path, join(directory, "settings.json")]) {
      const content = await readFile(filename, "utf8");
      expect(content).not.toContain(login.password);
      expect(content).not.toContain(login.username);
    }
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    const restored = new CredentialStore(path, crypto);
    await restored.load();
    expect(await restored.get(server)).toEqual(login);
    expect(await restored.get({ ...server, id: "another-server" })).toBeNull();
    expect(await restored.get({ ...server, url: "https://other.test/media" })).toBeNull();
    expect(await restored.get({ ...server, url: "https://example.test/other" })).toBeNull();
    expect(await restored.get({ ...server, providerId: "other" })).toBeNull();
  });
  it("serializes concurrent saves and forgetting without resurrecting removed accounts", async () => {
    const { path, crypto, store } = await setup();
    const other = { ...server, id: "other" };
    await Promise.all([
      store.set(server, login),
      store.set(other, { ...login, username: "other" }),
      store.set(server, null),
    ]);
    const restored = new CredentialStore(path, crypto);
    await restored.load();
    expect(await restored.get(server)).toBeNull();
    expect(await restored.get(other)).toEqual({ ...login, username: "other" });
  });
  it("keeps the old account on encryption failure and permits forgetting without a keychain", async () => {
    const { path, crypto, store } = await setup();
    await store.set(server, login);
    const original = await readFile(path, "utf8");
    crypto.encrypt.mockRejectedValueOnce(new Error("test failure"));
    await expect(store.set(server, { ...login, password: "new" })).rejects.toThrow(
      "credentialsUnavailable",
    );
    expect(await readFile(path, "utf8")).toBe(original);
    crypto.available.mockResolvedValue(false);
    await expect(store.get(server)).rejects.toThrow("credentialsUnavailable");
    await expect(store.set(server, login)).rejects.toThrow("credentialsUnavailable");
    await store.set(server, null);
    expect(await store.get(server)).toBeNull();
  });
  it("reports damaged ciphertext without revealing data", async () => {
    const { crypto, store } = await setup();
    await store.set(server, login);
    crypto.decrypt.mockRejectedValueOnce(new Error(login.password));
    await expect(store.get(server)).rejects.toThrow("credentialsUnreadable");
  });
  it("does not overwrite an unreadable vault", async () => {
    const { path, crypto } = await setup();
    await writeFile(path, "invalid vault");
    const store = new CredentialStore(path, crypto);
    await expect(store.load()).rejects.toThrow("credentialsUnreadable");
    await expect(store.set(server, login)).rejects.toThrow("credentialsUnreadable");
    expect(await readFile(path, "utf8")).toBe("invalid vault");
  });
});
describe("credential destination validation", () => {
  it.each([
    ["https://example.test/media/web/index.html#!/login", true],
    ["https://example.test/media", true],
    ["https://example.test/media-other/web/index.html", false],
    ["https://example.test/other/web/index.html", false],
    ["https://sub.example.test/media/web/index.html", false],
    ["https://example.test:444/media/web/index.html", false],
    ["http://example.test/media/web/index.html", false],
    ["https://example.test/media/../other", false],
    ["https://user:password@example.test/media", false],
    ["about:blank", false],
    ["invalid", false],
  ])("checks the exact origin and registered path: %s", (url, allowed) => {
    expect(credentialOriginMatches(server, url)).toBe(allowed);
  });
});
