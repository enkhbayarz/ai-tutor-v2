import { transliterateMongolian } from "./transliterate";

/**
 * Generate unique username from Mongolian name
 * Format: {lastName initial}{firstName} (transliterated)
 * Example: "Батболд Эрдэнэ" -> "berdene"
 *
 * Duplicate handling:
 * - berdene (first)
 * - berdene2 (second)
 * - berdene3 (third)
 *
 * Clerk requirements:
 * - Minimum 4 characters
 * - Only basic alphanumeric characters (no extended)
 */
export function generateUsername(
  firstName: string,
  lastName: string,
  existingUsernames: Set<string>
): string {
  // Transliterate and clean up
  const firstNameLatin = transliterateMongolian(firstName.trim());
  const lastNameLatin = transliterateMongolian(lastName.trim());

  // Get first letter of lastName + full firstName
  const lastNameInitial = lastNameLatin.charAt(0);

  // Create base username: {lastNameInitial}{firstName}
  let base = `${lastNameInitial}${firstNameLatin}`
    .replace(/[^a-z0-9]/g, ""); // Remove special characters, keep only alphanumeric

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

  // Add to set for subsequent calls in the same batch
  existingUsernames.add(username);

  return username;
}

/**
 * Generate temporary password
 * Format: 8 characters with prefix "Temp" + 4 random alphanumeric
 * Example: "Temp1234", "TempAb3K"
 */
export function generateTempPassword(): string {
  // Characters that are easy to read (excluding confusing ones like 0/O, 1/l/I)
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let suffix = "";

  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `Temp${suffix}`;
}
