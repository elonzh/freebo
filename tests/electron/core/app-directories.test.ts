import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import {
  applicationDirectories,
  openApplicationDirectory,
} from "../../../electron/core/app-directories";

function fixture(packaged = false) {
  const program = join(tmpdir(), "Freebo program");
  const data = join(tmpdir(), "Freebo custom data");
  const executable = join(program, "bin", "Freebo");
  return {
    isPackaged: packaged,
    getAppPath: () => (packaged ? join(program, "resources", "app.asar") : program),
    getPath: (name: "exe" | "userData") => (name === "exe" ? executable : data),
  };
}

describe("application directories", () => {
  it.each([
    [false, join(tmpdir(), "Freebo program")],
    [true, join(tmpdir(), "Freebo program", "bin")],
  ] as const)(
    "uses a real folder instead of an ASAR archive when packaged=%s",
    (packaged, program) => {
      const app = fixture(packaged);
      expect(applicationDirectories(app)).toEqual({
        program,
        data: join(tmpdir(), "Freebo custom data"),
      });
    },
  );

  it.each(["program", "data"] as const)("opens the trusted %s directory", async (target) => {
    const app = fixture();
    const openPath = vi.fn(async () => "");
    await openApplicationDirectory(app, target, openPath);
    expect(openPath).toHaveBeenCalledExactlyOnceWith(
      join(tmpdir(), target === "program" ? "Freebo program" : "Freebo custom data"),
    );
  });

  it.each([join(tmpdir(), "arbitrary.exe"), "https://example.test", null])(
    "rejects unsupported directory targets before invoking the OS",
    async (input) => {
      const openPath = vi.fn(async () => "");
      await expect(openApplicationDirectory(fixture(), input, openPath)).rejects.toThrow();
      expect(openPath).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    "reports OS failures without exposing paths when rejected=%s",
    async (rejected) => {
      const openPath = vi.fn(async () => {
        if (rejected) throw new Error("cannot open /private/profile");
        return "cannot open /private/profile";
      });
      const error = await openApplicationDirectory(fixture(), "data", openPath).catch(
        (error: Error) => error,
      );
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("directoryOpenFailed");
      expect((error as Error).message).not.toContain("/private/profile");
    },
  );
});
