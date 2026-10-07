import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { migrateLegacyProfile } from "../../../electron/core/profile-migration";

describe("profile migration", () => {
  it("copies settings and browser sessions without overwriting an existing profile", async () => {
    const directory = await mkdtemp(join(tmpdir(), "freebo-profile-"));
    const legacy = join(directory, "legacy");
    const current = join(directory, "Freebo");
    await mkdir(join(legacy, "Partitions", "emby-test"), { recursive: true });
    await writeFile(join(legacy, "settings.json"), "old settings");
    await writeFile(join(legacy, "Partitions", "emby-test", "Cookies"), "fake session");
    expect(await migrateLegacyProfile(current, [legacy])).toBe(true);
    expect(await readFile(join(current, "Partitions", "emby-test", "Cookies"), "utf8")).toBe(
      "fake session",
    );
    await writeFile(join(current, "settings.json"), "new settings");
    expect(await migrateLegacyProfile(current, [legacy])).toBe(false);
    expect(await readFile(join(current, "settings.json"), "utf8")).toBe("new settings");
    expect(await readFile(join(legacy, "settings.json"), "utf8")).toBe("old settings");
  });
});
