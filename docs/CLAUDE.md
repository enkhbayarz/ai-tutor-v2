# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AI Tutor V2** - A Mongolian language educational AI tutoring platform for AI Academy Asia.

**Language**: Mongolian (Монгол хэл) as default, English fallback.

## Tech Stack

| Category       | Technology               |
| -------------- | ------------------------ |
| Runtime        | Bun                      |
| Framework      | Next.js 15 (App Router)  |
| UI             | shadcn/ui + Tailwind CSS |
| Auth           | Clerk                    |
| Backend        | Convex                   |
| Theme          | next-themes              |
| i18n           | next-intl                |
| LLM            | OpenRouter               |
| Toast          | Sonner                   |
| Error Tracking | Sentry                   |

## Development Commands

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Build for production
bun run build

# Start production server
bun run start

# Lint
bun run lint

# Format with Prettier
bun run format

# Start Convex dev
bunx convex dev
```

## Architecture

### Route Groups (App Router)

```
app/
├── (auth)/          # Public auth pages (Clerk)
│   └── sign-in/, sign-up/
├── (dashboard)/     # Protected admin/teacher pages
│   └── Has sidebar layout
├── (chat)/          # AI chat interface
│   └── Different layout, conversation sidebar
└── api/             # API routes
    ├── chat/        # OpenRouter streaming
    └── webhooks/    # Clerk webhooks
```

### User Roles

- **Admin**: Full access to everything
- **Teacher (Багш)**: Manage students, view analytics
- **Student (Сурагч)**: AI chat access only

### Key Patterns

**Convex Queries/Mutations:**

```typescript
// Use Convex hooks for data
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const users = useQuery(api.users.list);
const createUser = useMutation(api.users.create);
```

**Protected Routes:**

```typescript
// middleware.ts - Clerk protects routes
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);
```

**i18n Usage:**

```typescript
import { useTranslations } from "next-intl";

export function Component() {
  const t = useTranslations("dashboard");
  return <h1>{t("title")}</h1>;
}
```

**Theme Toggle:**

```typescript
import { useTheme } from "next-themes";

const { theme, setTheme } = useTheme();
```

**Sentry Error Tracking:**

```typescript
import * as Sentry from "@sentry/nextjs";

// Manual error capture
try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error);
}

// Add context to errors
Sentry.setUser({ id: userId, email: userEmail });
Sentry.setTag("feature", "chat");
```

## File Naming Conventions

- Components: `kebab-case.tsx` (e.g., `chat-input.tsx`)
- Convex functions: `camelCase.ts` (e.g., `users.ts`)
- Hooks: `use-*.ts` (e.g., `use-chat.ts`)
- Types: Include in component file or `types.ts`

## Styling Guidelines

- Use Tailwind CSS utility classes
- Use `cn()` helper from `@/lib/utils` for conditional classes
- Mobile-first: Start with mobile styles, add `md:`, `lg:` breakpoints
- Use shadcn/ui components where possible
- Dark mode: Use `dark:` prefix for dark mode variants

## Important Notes

- All UI text should be in Mongolian by default
- Use proper Mongolian Cyrillic characters
- Convex handles real-time updates automatically
- OpenRouter allows switching between LLM models (GPT-4o, Claude, Gemini, DeepSeek)
- Clerk webhook syncs users to Convex on sign-up
- Sentry captures errors automatically; use `Sentry.captureException()` for manual error tracking

## Environment Variables

Required in `.env.local`:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CONVEX_DEPLOYMENT`
- `NEXT_PUBLIC_CONVEX_URL`
- `OPENROUTER_API_KEY`
- `SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`
- `NEXT_PUBLIC_SENTRY_DSN`

## Common Tasks

### Add a new shadcn component

```bash
bunx shadcn@latest add [component-name]
```

### Add a new Convex table

1. Update `convex/schema.ts`
2. Create corresponding functions in `convex/[table].ts`
3. Run `bunx convex dev` to sync

### Add a new translation

1. Add key to `src/i18n/mn.json`
2. Add English fallback to `src/i18n/en.json`
3. Use with `useTranslations()` hook
