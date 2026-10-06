import "i18next";
import type { zh } from "./locales/zh";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    returnNull: false;
    resources: { translation: { [Key in keyof typeof zh]: string } };
  }
}
