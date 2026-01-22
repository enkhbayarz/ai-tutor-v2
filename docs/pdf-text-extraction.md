# PDF Text Extraction for RAG System

## Goal

Extract raw text from uploaded PDF textbooks on upload, storing for future RAG/vector database integration to power an AI tutoring chatbot.

---

## Architecture Overview

```
Upload Flow:
1. User uploads PDF → Convex storage (existing)
2. User submits form → textbook created in Convex
3. Frontend calls /api/extract-pdf with textbookId
4. API route downloads PDF, extracts text via pdfjs-dist
5. Extracted text saved to textbooks table via Convex mutation
6. [Future] Text chunked and sent to vector database

Why Next.js API Route (not Convex Action)?
- Convex actions have limited runtime environment
- pdfjs-dist requires Node.js features not available in Convex
- API routes have full Node.js support
```

---

## Implementation

### Dependencies

```bash
bun add pdfjs-dist
```

### Schema Changes

**File**: `convex/schema.ts`

Added fields to textbooks table:
```typescript
extractedText: v.optional(v.string()),
textExtractionStatus: v.optional(
  v.union(v.literal("pending"), v.literal("completed"), v.literal("failed"))
),
textExtractionError: v.optional(v.string()),
```

### API Route

**File**: `app/api/extract-pdf/route.ts`

- Uses `pdfjs-dist/legacy/build/pdf.mjs` (no workers needed)
- Fetches PDF from Convex storage URL
- Extracts text page by page
- Saves to Convex via ConvexHttpClient

### Convex Mutations

**File**: `convex/textbooks.ts`

- `getByIdInternal` - Returns textbook with pdfUrl for extraction
- `updateExtractedText` - Updates extracted text and status

### Frontend Integration

**Files**:
- `app/[locale]/(dashboard)/textbook/new/page.tsx`
- `app/[locale]/(dashboard)/textbook/[id]/edit/page.tsx`

Calls API route after textbook create/update:
```typescript
fetch("/api/extract-pdf", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ textbookId }),
}).catch(console.error);
```

---

## Data Flow

```
1. User uploads PDF
   └─→ File stored in Convex _storage
   └─→ storageId returned

2. User submits form
   └─→ textbooks.create() saves record
   └─→ Returns textbookId

3. Frontend calls /api/extract-pdf
   └─→ Sets status to "pending"
   └─→ Gets textbook with pdfUrl from Convex
   └─→ Fetches PDF via URL
   └─→ pdfjs-dist extracts text page by page
   └─→ Saves text to Convex
   └─→ Sets status to "completed"

4. [Future] RAG Integration
   └─→ Chunk extractedText (1000 chars, 100 overlap)
   └─→ Generate embeddings via OpenAI
   └─→ Store in vector database
   └─→ Query for chatbot responses
```

---

## Files Modified

| File | Change |
|------|--------|
| `package.json` | Added `pdfjs-dist` |
| `convex/schema.ts` | Added extraction fields |
| `convex/textbooks.ts` | Added helper mutations |
| `app/api/extract-pdf/route.ts` | NEW - Extraction endpoint |
| `app/[locale]/(dashboard)/textbook/new/page.tsx` | Calls API after create |
| `app/[locale]/(dashboard)/textbook/[id]/edit/page.tsx` | Calls API if PDF changed |

---

## Verification

1. `bunx convex dev` - Deploy schema changes
2. Upload a PDF textbook via the app
3. Check Convex dashboard:
   - `textExtractionStatus` should be "completed"
   - `extractedText` should contain PDF content
4. Check for errors in browser console or server logs

---

## Future: RAG Integration Notes

When implementing the chatbot, the extracted text will be:
1. Chunked into smaller segments (1000 chars, 100 overlap)
2. Embedded using OpenAI `text-embedding-3-small`
3. Stored in vector database (Pinecone, pgvector, etc.)
4. Retrieved based on similarity to user questions
5. Fed to GPT as context for answers

The `extractedText` field provides the raw material for this pipeline.
