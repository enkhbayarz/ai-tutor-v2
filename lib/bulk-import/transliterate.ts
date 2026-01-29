/**
 * Mongolian Cyrillic to Latin transliteration for username generation
 */

const MONGOLIAN_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "ye",
  ё: "yo",
  ж: "j",
  з: "z",
  и: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  ө: "u",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ү: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sh",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
  // Uppercase versions
  А: "a",
  Б: "b",
  В: "v",
  Г: "g",
  Д: "d",
  Е: "ye",
  Ё: "yo",
  Ж: "j",
  З: "z",
  И: "i",
  Й: "i",
  К: "k",
  Л: "l",
  М: "m",
  Н: "n",
  О: "o",
  Ө: "u",
  П: "p",
  Р: "r",
  С: "s",
  Т: "t",
  У: "u",
  Ү: "u",
  Ф: "f",
  Х: "kh",
  Ц: "ts",
  Ч: "ch",
  Ш: "sh",
  Щ: "sh",
  Ъ: "",
  Ы: "y",
  Ь: "",
  Э: "e",
  Ю: "yu",
  Я: "ya",
};

/**
 * Transliterate Mongolian Cyrillic text to Latin characters
 * @param text - Mongolian text to transliterate
 * @returns Latin transliteration
 */
export function transliterateMongolian(text: string): string {
  return text
    .split("")
    .map((char) => MONGOLIAN_TO_LATIN[char] ?? char)
    .join("")
    .toLowerCase();
}
