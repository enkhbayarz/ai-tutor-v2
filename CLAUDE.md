# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AI Tutor V2** - A Mongolian language educational AI tutoring platform for AI Academy Asia. Students can chat with an AI tutor that supports text, voice, and image inputs. Teachers/admins manage textbooks, students, and educational content.

**Language**: Mongolian (Монгол хэл) as default, English fallback.

## Tech Stack

| Category       | Technology                          |
| -------------- | ----------------------------------- |
| Runtime        | Bun                                 |
| Framework      | Next.js 15 (App Router)             |
| UI             | shadcn/ui (new-york) + Tailwind v4  |
| Auth           | Clerk                               |
| Backend/DB     | Convex (real-time, file storage)    |
| i18n           | next-intl                           |
| LLM (Text)    | OpenAI GPT-4o-mini / Google Gemini 2.0 Flash |
| LLM (Vision)  | OpenAI GPT-4o / Google Gemini 2.0 Flash |
| Audio STT      | Chimege API (Mongolian)             |
| Theme          | next-themes                         |
| Toast          | Sonner                              |
| Error Tracking | Sentry                              |
| Analytics      | PostHog                             |

## Development Commands

```bash
bun install          # Install dependencies
bun run dev          # Start dev server
bun run build        # Build for production (TypeScript check)
bun run lint         # Lint
bunx convex dev      # Start Convex dev (syncs schema)
bunx shadcn@latest add [component-name]  # Add shadcn component
```

## Architecture

### Route Groups (App Router)

```
app/[locale]/
├── (auth)/              # Public auth pages (Clerk)
│   ├── sign-in/
│   └── sign-up/
├── (dashboard)/         # Protected admin/teacher pages (sidebar layout)
│   ├── student-info/    # Student management
│   ├── teacher-info/    # Teacher management
│   └── textbook/        # Textbook CRUD (list, new, [id], [id]/edit)
├── chat/                # AI chat interface (own layout)
│   └── c/[id]/          # Specific conversation
└── api/
    ├── chat/            # Streaming LLM endpoint (OpenAI + Gemini)
    ├── chimege/         # Mongolian STT
    └── extract-pdf/     # PDF text extraction
```

### Project Structure

```
app/                    # Next.js App Router pages
components/
├── ui/                 # shadcn components (button, dialog, input, etc.)
├── chat/               # Chat UI (input, messages, sidebar, panels, voice)
├── textbook/           # Textbook management (upload, TOC editor, filters)
├── shared/             # Reusable (data-table, delete-dialog, empty-state)
├── common/             # Layout (sidebar, mobile-header, help-dialog)
└── providers/          # Context providers (Convex, PostHog, Sentry)
hooks/                  # Custom hooks (use-chat-stream, use-voice-input, use-form-draft)
lib/                    # Utilities (cn, export-excel, toc-parser, validations/)
convex/                 # Backend (schema, mutations, queries)
messages/               # i18n (mn.json, en.json)
i18n/                   # next-intl config
```

### User Roles

- **Admin**: Full access to everything
- **Teacher (Багш)**: Manage students, textbooks, view analytics
- **Student (Сурагч)**: AI chat access only

## Convex Schema

```typescript
users        // clerkId, email, displayName, role (admin|teacher|student)
teachers     // lastName, firstName, grade, group, phone1, phone2, status
students     // lastName, firstName, grade, group, phone1, phone2, status
textbooks    // subjectName, grade, year, type, pdfFileId, thumbnailId,
             // extractedText, textExtractionStatus, tableOfContents, tocExtractionStatus
conversations // clerkUserId, title, model, createdAt, updatedAt
messages     // conversationId, role, content, model, imageId, createdAt
loginHistory // clerkUserId, sessionId, event, device/browser/location info
recentTextbooks // clerkUserId, textbookId, viewedAt (FIFO max 3)
```

## Key Patterns

**Convex Data Access:**
```typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const data = useQuery(api.textbooks.list, { grade: 10 });
const create = useMutation(api.textbooks.create);
```

**File Upload to Convex Storage:**
```typescript
const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
const uploadUrl = await generateUploadUrl();
const result = await fetch(uploadUrl, {
  method: "POST",
  headers: { "Content-Type": file.type },
  body: file,
});
const { storageId } = await result.json();
```

**Streaming Chat (hook → API → LLM):**
```typescript
const { sendMessage, isStreaming, streamingContent } = useChatStream();
const response = await sendMessage(messages, model, textbookContext, imageUrl);
```

**i18n Usage:**
```typescript
import { useTranslations } from "next-intl";
const t = useTranslations("chat");
return <p>{t("greeting")}</p>;
```

**Protected Routes (middleware.ts):**
```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
```

## File Naming Conventions

| Type           | Convention         | Example              |
| -------------- | ------------------ | -------------------- |
| Components     | `kebab-case.tsx`   | `chat-input.tsx`     |
| Hooks          | `use-[name].ts`    | `use-chat-stream.ts` |
| Convex modules | `camelCase.ts`     | `conversations.ts`   |
| Route groups   | `([name])/`        | `(dashboard)/`       |
| i18n messages  | `[locale].json`    | `mn.json`, `en.json` |

## Styling Guidelines

- Tailwind CSS utility classes
- `cn()` helper from `@/lib/utils` for conditional classes
- Mobile-first: Start mobile, add `md:`, `lg:` breakpoints
- Use shadcn/ui components where possible
- Dark mode via `dark:` prefix

## Important Notes

- All UI text in Mongolian by default (proper Cyrillic characters)
- Translation files: `messages/mn.json` and `messages/en.json`
- Dual LLM support: OpenAI (GPT) and Google Gemini, switchable in UI
- Chat supports: text input, voice input (STT), image upload (vision)
- Images uploaded via Convex storage, persist in chat history
- Vision: GPT-4o for OpenAI, Gemini 2.0 Flash for Google (multimodal)
- Textbook reference: Users can pin a chapter as context for the LLM
- Streaming responses: Both OpenAI and Gemini use ReadableStream
- Build must pass (`bun run build`) before considering any task done
- Convex handles real-time updates automatically

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
```

## Documentation

- `docs/BUILD.md` - Build specifications
- `docs/CODE-STRUCTURE.md` - Component patterns
- `docs/SECURITY-CHAT.md` - Chat security (rate limiting, quotas)
- `SESSION-CONTEXT.md` - Full implementation history and roadmap
