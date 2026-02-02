import { transliterateMongolian } from "../bulk-import/transliterate";

/**
 * Generate unique username for a student
 * Format: {firstName}{lastNameInitial} (transliterated to Latin, lowercase)
 * Example: firstName="Баатар", lastName="Эрдэнэ" → "baatare"
 *
 * Duplicate handling:
 * - baatare (first)
 * - baatare2 (second)
 * - baatare3 (third)
 *
 * Clerk requirements:
 * - Minimum 4 characters
 * - Only alphanumeric characters
 */
export function generateStudentUsername(
  firstName: string,
  lastName: string,
  existingUsernames: Set<string>
): string {
  // Transliterate Mongolian to Latin
  const firstNameLatin = transliterateMongolian(firstName.trim());
  const lastNameLatin = transliterateMongolian(lastName.trim());

  // Get first letter of lastName
  const lastNameInitial = lastNameLatin.charAt(0);

  // Create base username: {firstName}{lastNameInitial} (lowercase)
  let base = `${firstNameLatin}${lastNameInitial}`.replace(/[^a-z0-9]/g, "");

  // Ensure minimum 4 characters (Clerk requirement)
  if (base.length < 4) {
    base = base.padEnd(4, "0");
  }

  // Ensure uniqueness
  let username = base;
  let counter = 2;

  while (existingUsernames.has(username)) {
    username = `${base}${counter}`;
    counter++;
  }

  // Add to set for subsequent calls
  existingUsernames.add(username);

  return username;
}

/**
 * Map Mongolian Cyrillic first letter to uppercase Latin initial
 * Used for password generation
 */
const CYRILLIC_TO_LATIN_INITIAL: Record<string, string> = {
  А: "A",
  а: "A",
  Б: "B",
  б: "B",
  В: "V",
  в: "V",
  Г: "G",
  г: "G",
  Д: "D",
  д: "D",
  Е: "E",
  е: "E",
  Ё: "E",
  ё: "E",
  Ж: "J",
  ж: "J",
  З: "Z",
  з: "Z",
  И: "I",
  и: "I",
  Й: "I",
  й: "I",
  К: "K",
  к: "K",
  Л: "L",
  л: "L",
  М: "M",
  м: "M",
  Н: "N",
  н: "N",
  О: "O",
  о: "O",
  Ө: "O",
  ө: "O",
  П: "P",
  п: "P",
  Р: "R",
  р: "R",
  С: "S",
  с: "S",
  Т: "T",
  т: "T",
  У: "U",
  у: "U",
  Ү: "U",
  ү: "U",
  Ф: "F",
  ф: "F",
  Х: "H",
  х: "H",
  Ц: "C",
  ц: "C",
  Ч: "C",
  ч: "C",
  Ш: "S",
  ш: "S",
  Щ: "S",
  щ: "S",
  Ъ: "",
  ъ: "",
  Ы: "Y",
  ы: "Y",
  Ь: "",
  ь: "",
  Э: "E",
  э: "E",
  Ю: "Y",
  ю: "Y",
  Я: "Y",
  я: "Y",
};

/**
 * Get uppercase Latin initial from first Cyrillic character
 */
function getLatinInitial(name: string): string {
  const firstChar = name.trim().charAt(0);
  return CYRILLIC_TO_LATIN_INITIAL[firstChar] || firstChar.toUpperCase();
}

/**
 * Generate password for a student
 * Format: {phone1}{firstNameInitial}{lastNameInitial}{specialChar}
 * Example: phone="99123456", firstName="Баатар", lastName="Эрдэнэ" → "99123456BE$"
 *
 * - Initials are UPPERCASE Latin transliteration of first Cyrillic letter
 * - Special char is randomly picked from: $%^&*!@#
 */
export function generateStudentPassword(
  phone1: string,
  firstName: string,
  lastName: string
): string {
  const specialChars = "$%^&*!@#";
  const randomSpecialChar = specialChars.charAt(
    Math.floor(Math.random() * specialChars.length)
  );

  const firstNameInitial = getLatinInitial(firstName);
  const lastNameInitial = getLatinInitial(lastName);

  return `${phone1}${firstNameInitial}${lastNameInitial}${randomSpecialChar}`;
}
