# TOC Refactor Summary

## What Changed

Refactored the Table of Contents (TOC) data structure and UI to a simpler format matching the new mockup design.

## Data Structure

### Before
```typescript
{
  id: string;
  number: string;      // "I", "1", etc.
  title: string;
  order: number;
  topics: {
    id: string;
    title: string;
    startPage: number;
    endPage?: number;
    order: number;
  }[]
}
```

### After
```typescript
{
  id: string;
  order: number;
  title: string;       // "Бүлэг 1", "Бүлэг 2", etc.
  description: string; // Chapter content name (e.g., "МЕХАНИК")
  topics: {
    id: string;
    order: number;
    title: string;
    page: number;      // Single page number
  }[]
}
```

## UI Design

- Chapter row: "Бүлэг X" small label + bold description + expand chevron
- Right side: "Засах" button + trash icon (per chapter)
- Expanded: numbered topic list (1. Topic, 2. Topic...)
- Topics show title only (page stored but not displayed in list)

## Files Modified

| File | Changes |
|------|---------|
| `convex/schema.ts` | Updated TOC schema fields |
| `convex/textbooks.ts` | Updated validators and mutations |
| `lib/toc-parser.ts` | Updated parser output structure |
| `components/textbook/table-of-contents.tsx` | Updated interfaces + UI redesign |
| `components/textbook/chapter-dialog.tsx` | New form fields (title + description) |
| `components/textbook/topic-dialog.tsx` | Simplified to single page field |
| `messages/mn.json` | Added description translations |
| `messages/en.json` | Added description translations |
| `app/[locale]/(dashboard)/textbook/[id]/edit/page.tsx` | Added TOC section |

## Notes

- Existing TOC data using old format (`number`, `startPage`, `endPage`) will need re-extraction from PDFs
- Chapter titles auto-generate as "Бүлэг X" based on order
- Build verified - no TypeScript errors
