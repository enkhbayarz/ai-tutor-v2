export const locales = ["mn", "en"] as const;
export const defaultLocale = "mn";
export type Locale = (typeof locales)[number];
