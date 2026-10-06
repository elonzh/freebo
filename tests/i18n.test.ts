import { describe, expect, it } from "vitest";
import { createRendererI18n } from "../src/i18n";
import { zh } from "../src/shared/locales/zh";
import { en } from "../src/shared/locales/en";
import { errorToken, localizeError, translate, type MessageKey } from "../src/shared/i18n";

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
