import { describe, it, expect } from "vitest";
import { redact } from "../../../electron/core/redact";

describe("credential redaction", () => {
  it("redacts query credentials and authentication headers from errors", () => {
    const text = redact(
      "https://server.test/video?api_key=secret&X-Emby-Token=token Cookie: cookie\nPassword: pass",
    );
    expect(text).not.toContain("secret");
    expect(text).not.toContain("=token");
    expect(text).not.toContain("cookie\n");
    expect(text).not.toContain(": pass");
  });
});
