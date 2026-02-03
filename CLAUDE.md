# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AI Tutor V2** - Mongolian language educational AI tutoring platform for AI Academy Asia. Students chat with an AI tutor supporting text, voice (Chimege STT), and image inputs (vision). Teachers/admins manage textbooks, students, and educational content.

**Language**: Mongolian (Монгол хэл) default, English fallback.

## Tech Stack

| Category       | Technology                              |
| -------------- | --------------------------------------- |
| Runtime        | Bun                                     |
| Framework      | Next.js 15 (App Router)                 |
| UI             | shadcn/ui (new-york style) + Tailwind 4 |
| Auth           | Clerk                                   |
| Backend/DB     | Convex (real-time, file storage)        |
| i18n           | next-intl                               |
| LLM            | OpenAI (GPT-4o-mini/4o) + Google Gemini |
| Audio STT      | Chimege API (Mongolian)                 |
| Analytics      | PostHog + Axiom                         |
| Error Tracking | Sentry                                  |

## Development Commands

```bash
bun install              # Install dependencies
bun run dev              # Start dev server (localhost:3000)
bun run build            # Production build (must pass before merging)
bun run lint             # ESLint check
bunx convex dev          # Start Convex dev (syncs schema)
bunx shadcn@latest add [component]  # Add shadcn component
```

## Architecture

### Route Structure (App Router with Locale)

```
app/[locale]/
├── (auth)/              # Public auth pages (Clerk)
│   ├── sign-in/
│   └── sign-up/
├── (dashboard)/         # Protected admin/teacher pages (sidebar layout)
│   ├── student-info/    # Student CRUD
│   ├── teacher-info/    # Teacher CRUD
│   └── textbook/        # Textbook management (list, new, [id], [id]/edit)
├── chat/                # AI chat interface (own layout)
│   └── c/[id]/          # Specific conversation
└── api/
    ├── chat/            # Streaming LLM endpoint (POST)
    ├── chat-v2/         # External AI backend integration
    ├── chimege/         # Mongolian STT
    └── extract-pdf/     # PDF text extraction
```

### Component Organization

```
components/
├── ui/                  # shadcn primitives (barrel export via index.ts)
├── chat/                # Chat UI (input, messages, sidebar, voice)
├── textbook/            # Textbook management (upload, TOC editor)
├── shared/              # Reusable (data-table, delete-dialog, empty-state)
└── common/              # Layout (sidebar, mobile-header)

hooks/                   # Global hooks (use-chat-stream, use-voice-input)
lib/                     # Utilities (cn, export-excel, validations/)
convex/                  # Backend (schema, mutations, queries)
messages/                # i18n (mn.json, en.json)
```

### Key Patterns

**Convex Data Access:**
```typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const data = useQuery(api.textbooks.list, { grade: 10 });
const create = useMutation(api.textbooks.create);
```

**File Upload to Convex:**
```typescript
const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
const uploadUrl = await generateUploadUrl();
await fetch(uploadUrl, { method: "POST", body: file });
```

**Chat Streaming (hook → API → LLM):**
```typescript
const { sendMessage, isStreaming, streamingContent, cancel } = useChatStream();
```

**i18n Usage:**
```typescript
import { useTranslations } from "next-intl";
const t = useTranslations("chat");
```

## Convex Schema (Key Tables)

```typescript
users         // clerkId, email, displayName, role, externalUserId
teachers      // lastName, firstName, phone1, phone2, status, clerkId
students      // lastName, firstName, grade, group, phone1, phone2, status
textbooks     // subjectName, grade, year, type, pdfFileId, thumbnailId,
              // extractedText, tableOfContents, tocExtractionStatus
conversations // clerkUserId, title, model, sessionId
messages      // conversationId, role, content, model, imageId
recentTextbooks    // clerkUserId, textbookId, viewedAt (FIFO max 3)
topicMastery       // clerkUserId, subjectName, masteryLevel, correctAnswers
usageEvents        // clerkUserId, eventType, model, timestamp
```

## User Roles

- **Admin**: Full access
- **Teacher (Багш)**: Manage students, textbooks, view analytics
- **Student (Сурагч)**: AI chat access only

## Naming Conventions

| Type           | Convention         | Example              |
| -------------- | ------------------ | -------------------- |
| Components     | `kebab-case.tsx`   | `chat-input.tsx`     |
| Hooks          | `use-[name].ts`    | `use-chat-stream.ts` |
| Convex modules | `camelCase.ts`     | `conversations.ts`   |
| Route groups   | `([name])/`        | `(dashboard)/`       |
| Private folders| `_[name]/`         | `_components/`       |

## Styling

- Tailwind CSS with `cn()` helper from `@/lib/utils`
- Mobile-first: Start mobile, add `md:`, `lg:` breakpoints
- Dark mode via `dark:` prefix
- shadcn/ui components with CVA for variants

## Important Notes

- All UI text in Mongolian by default (proper Cyrillic characters)
- Translation files: `messages/mn.json` and `messages/en.json`
- Dual LLM: OpenAI (gpt-4o-mini for text, gpt-4o for vision) and Gemini (gemini-2.5-flash-lite)
- Images: Only data URLs accepted (SSRF prevention), stored in Convex
- Textbook context: Users can pin a chapter as context for the LLM
- **Build must pass** (`bun run build`) before considering any task done

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CONVEX_DEPLOYMENT
NEXT_PUBLIC_CONVEX_URL
OPENAI_API_KEY
GOOGLE_AI_API_KEY
NEXT_PUBLIC_SENTRY_DSN
SENTRY_AUTH_TOKEN
NEXT_PUBLIC_POSTHOG_KEY
NEXT_PUBLIC_POSTHOG_HOST
NEXT_PUBLIC_AXIOM_TOKEN
NEXT_PUBLIC_AXIOM_DATASET
```

## Chat API Security

The chat API (`app/api/chat/route.ts`) includes:
- Auth check via Clerk
- SSRF prevention (only data URLs for images)
- Input validation (max 50 messages, 4000 chars per message)
- System prompt injection prevention (client system messages stripped)
- Personalization via student weak topics query

## Documentation

- `docs/BUILD.md` - Build specifications
- `docs/CODE-STRUCTURE.md` - Component patterns and colocation
- `docs/SECURITY-CHAT.md` - Chat security (rate limiting, quotas)
