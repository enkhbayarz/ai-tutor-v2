/**
 * Converts mangled character-encoded Mongolian text into clean Cyrillic.
 * PDF extraction sometimes encodes Mongolian Cyrillic as Latin-1 characters.
 */

const MONGOLIAN_CHAR_MAP: Record<string, string> = {
  // Lowercase
  "à": "а",
  "á": "б",
  "â": "в",
  "ã": "г",
  "ä": "д",
  "å": "е",
  "æ": "ж",
  "ç": "з",
  "è": "и",
  "é": "й",
  "ê": "к",
  "ë": "л",
  "ì": "м",
  "í": "н",
  "î": "о",
  "ï": "п",
  "ð": "р",
  "ñ": "с",
  "ò": "т",
  "ó": "у",
  "ô": "ф",
  "õ": "х",
  "ö": "ө",
  "ø": "ш",
  "ù": "щ",
  "ú": "ъ",
  "û": "ы",
  "ü": "ү",
  "ý": "э",
  "þ": "ю",
  "ÿ": "я",
  // Uppercase
  "À": "А",
  "Á": "Б",
  "Â": "В",
  "Ã": "Г",
  "Ä": "Д",
  "Å": "Е",
  "Æ": "Ж",
  "Ç": "З",
  "È": "И",
  "É": "Й",
  "Ê": "К",
  "Ë": "Л",
  "Ì": "М",
  "Í": "Н",
  "Î": "О",
  "Ï": "П",
  "Ð": "Р",
  "Ñ": "С",
  "Ò": "Т",
  "Ó": "У",
  "Ô": "Ф",
  "Õ": "Х",
  "Ö": "Ц",
  "Ø": "Ш",
  "Ù": "Щ",
  "Ú": "Ъ",
  "Û": "Ы",
  "Ü": "Ү",
  "Ý": "Э",
  "Þ": "Ю",
  "ß": "Я",
};

export function cleanMongolianText(text: string): string {
  let result = text;
  for (const [mangled, correct] of Object.entries(MONGOLIAN_CHAR_MAP)) {
    result = result.replaceAll(mangled, correct);
  }
  return result;
}
