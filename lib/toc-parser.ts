/**
 * Table of Contents Parser for Mongolian Textbooks
 *
 * Parses extracted PDF text to identify chapters and topics
 * with page numbers from Mongolian educational textbooks.
 */

export interface ParsedTopic {
  title: string;
  page: number;
}

export interface ParsedChapter {
  number: string; // Raw chapter number from text (e.g., "I", "1")
  description: string; // Chapter content name
  topics: ParsedTopic[];
}

export interface TOCChapter {
  id: string;
  order: number;
  title: string; // "Бүлэг 1", "Бүлэг 2", etc.
  description: string; // Chapter content name
  topics: TOCTopic[];
}

export interface TOCTopic {
  id: string;
  order: number;
  title: string;
  page: number;
}

export interface TOCParseResult {
  chapters: ParsedChapter[];
  warnings: string[];
}

// Chapter header patterns for Mongolian textbooks
const CHAPTER_PATTERNS = [
  // "I БҮЛЭГ. TITLE" or "I БҮЛЭГ TITLE"
  /^([IVXLCDM]+)\s*БҮЛЭГ[.\s]+(.+)$/i,
  // "БҮЛЭГ I. TITLE"
  /^БҮЛЭГ\s*([IVXLCDM]+)[.\s]+(.+)$/i,
  // "1-Р БҮЛЭГ. TITLE" or "1 БҮЛЭГ. TITLE"
  /^(\d+)[-\s]*[РрRr]?\s*БҮЛЭГ[.\s]+(.+)$/i,
  // "БҮЛЭГ 1. TITLE"
  /^БҮЛЭГ\s*(\d+)[.\s]+(.+)$/i,
];

// Topic line pattern: "Title ....... page_number"
// Handles various dot patterns, spaces, and ellipsis characters
const TOPIC_PATTERN = /^(.+?)\s*[.\s·…•]+\s*(\d+)\s*$/;

// Alternative pattern for topics without dots but ending with page number
const TOPIC_PATTERN_ALT = /^(.{3,}?)\s{2,}(\d+)\s*$/;

// Special sections to skip (headers, footers, etc.)
const SKIP_PATTERNS = [
  /^ГАРЧИГ$/i, // "Table of Contents" header
  /^ХАРИУ$/i, // "Answers" section
  /^\d+$/, // Just a page number
  /^[IVXLCDM]+$/, // Just a Roman numeral
];

/**
 * Clean topic title by removing trailing dots, normalizing whitespace
 */
function cleanTopicTitle(title: string): string {
  return title
    .replace(/[.\s·…•]+$/, "") // Remove trailing dots/spaces
    .replace(/^\d+[.\s)]+/, "") // Remove leading numbers like "1. " or "1) "
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Check if a line should be skipped
 */
function shouldSkipLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 2) return true;
  return SKIP_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Try to match a chapter header from a line
 */
function matchChapterHeader(
  line: string
): { number: string; description: string } | null {
  for (const pattern of CHAPTER_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      return {
        number: match[1],
        description: match[2].trim(),
      };
    }
  }
  return null;
}

/**
 * Try to extract topic info from a line
 */
function matchTopic(line: string): { title: string; page: number } | null {
  // Try main pattern first
  let match = line.match(TOPIC_PATTERN);
  if (match) {
    const title = cleanTopicTitle(match[1]);
    const page = parseInt(match[2], 10);
    if (title.length >= 2 && !isNaN(page) && page > 0 && page < 10000) {
      return { title, page };
    }
  }

  // Try alternative pattern
  match = line.match(TOPIC_PATTERN_ALT);
  if (match) {
    const title = cleanTopicTitle(match[1]);
    const page = parseInt(match[2], 10);
    if (title.length >= 2 && !isNaN(page) && page > 0 && page < 10000) {
      return { title, page };
    }
  }

  return null;
}

/**
 * Parse TOC from extracted PDF text
 *
 * @param text - Raw extracted text from PDF
 * @returns Parsed chapters with topics
 */
export function parseTOC(text: string): TOCParseResult {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const chapters: ParsedChapter[] = [];
  const warnings: string[] = [];

  let currentChapter: ParsedChapter | null = null;
  let tocStarted = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip certain lines
    if (shouldSkipLine(line)) continue;

    // Check if we've hit the ГАРЧИГ (Table of Contents) header
    if (/ГАРЧИГ/i.test(line)) {
      tocStarted = true;
      continue;
    }

    // Try to match chapter header
    const chapterMatch = matchChapterHeader(line);
    if (chapterMatch) {
      tocStarted = true;

      // Save previous chapter if exists
      if (currentChapter && currentChapter.topics.length > 0) {
        chapters.push(currentChapter);
      }

      currentChapter = {
        number: chapterMatch.number,
        description: chapterMatch.description,
        topics: [],
      };
      continue;
    }

    // Only try to match topics if we've started parsing TOC
    if (!tocStarted) continue;

    // Try to match topic line
    const topicMatch = matchTopic(line);
    if (topicMatch) {
      // If no chapter yet, create an implicit first chapter
      if (!currentChapter) {
        currentChapter = {
          number: "1",
          description: "Агуулга",
          topics: [],
        };
      }

      currentChapter.topics.push({
        title: topicMatch.title,
        page: topicMatch.page,
      });
    }
  }

  // Don't forget the last chapter
  if (currentChapter && currentChapter.topics.length > 0) {
    chapters.push(currentChapter);
  }

  // Add warnings if no content found
  if (chapters.length === 0) {
    warnings.push("No table of contents found in the extracted text");
  } else if (chapters.every((ch) => ch.topics.length === 0)) {
    warnings.push("Chapters found but no topics were extracted");
  }

  return { chapters, warnings };
}

/**
 * Generate a random UUID
 */
function generateUUID(): string {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Convert parsed chapters to Convex-compatible format with IDs
 *
 * @param parsed - Parsed chapters from parseTOC
 * @returns Chapters with UUIDs and order fields
 */
export function convertToTOCSchema(parsed: ParsedChapter[]): TOCChapter[] {
  return parsed.map((chapter, chapterIndex) => ({
    id: generateUUID(),
    order: chapterIndex,
    title: `Бүлэг ${chapterIndex + 1}`, // Generate "Бүлэг 1", "Бүлэг 2", etc.
    description: chapter.description,
    topics: chapter.topics.map((topic, topicIndex) => ({
      id: generateUUID(),
      order: topicIndex,
      title: topic.title,
      page: topic.page,
    })),
  }));
}

/**
 * Main function to extract TOC from text and return Convex-ready format
 *
 * @param text - Raw extracted text from PDF
 * @returns TOC chapters ready for Convex storage
 */
export function extractTableOfContents(text: string): TOCChapter[] {
  const result = parseTOC(text);
  return convertToTOCSchema(result.chapters);
}
