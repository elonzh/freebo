import { describe, expect, it } from "vitest";
import { createRendererI18n } from "../../src/i18n";
import { zh } from "../../src/shared/locales/zh";
import { en } from "../../src/shared/locales/en";
import {
  errorToken,
  localizeError,
  messageKeys,
  resolveLocale,
  translate,
  UserFacingError,
  type MessageKey,
} from "../../src/shared/i18n";

describe("shared i18next resources", () => {
  it("has matching keys and interpolation variables in both languages", () => {
    expect(Object.keys(en)).toEqual(Object.keys(zh));
    for (const key of Object.keys(zh) as MessageKey[]) {
      const variables = (text: string) =>
        [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
      expect(variables(en[key]), key).toEqual(variables(zh[key]));
    }
  });
  it("shares interpolation behavior between native menus and renderer instances", () => {
    const renderer = createRendererI18n("zh");
    expect(renderer.t("closeTab", { name: "<Test>" })).toBe(
      translate("zh", "closeTab", { name: "<Test>" }),
    );
    expect(localizeError("en", errorToken("webFailed", { code: 503 }))).toContain("503");
  });
  it("switches existing renderer messages while keeping another window's language independent", async () => {
    const main = createRendererI18n("zh");
    const popup = createRendererI18n("zh");
    await main.changeLanguage("en");
    expect(main.t("connectionVerified")).toBe("Connected");
    expect(popup.t("connectionVerified")).toBe("连接成功");
    expect(translate("zh", "connectionVerified")).toBe("连接成功");
  });
});

describe("localized errors", () => {
  it("translates every message and re-localizes an existing serialized error", () => {
    for (const key of messageKeys) {
      expect(translate("zh", key)).not.toBe("");
      expect(translate("en", key)).not.toBe("");
      if (key !== "brand") expect(translate("en", key)).not.toMatch(/[\u4e00-\u9fff]/);
    }
    expect(resolveLocale("system", "zh-CN")).toBe("zh");
    expect(resolveLocale("system", "de-DE")).toBe("en");
    expect(resolveLocale("en", "zh-TW")).toBe("en");
    const error = new UserFacingError("webFailed", { code: -105 });
    expect(localizeError("en", error)).toContain("Cannot open");
    expect(localizeError("zh", error)).toContain("无法打开（-105）");
    expect(
      localizeError(
        "en",
        `Error invoking remote method 'app:save-server': Error: ${new UserFacingError("serverDuplicate").message}`,
      ),
    ).toBe(
      "This server has already been added. Open it from Home or edit the existing server in Settings.",
    );
  });
});
