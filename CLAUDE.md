# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AI Tutor V2** - A Mongolian language educational AI tutoring platform for AI Academy Asia.

**Language**: Mongolian (Монгол хэл) as default, English fallback.

## Tech Stack

| Category       | Technology                          |
| -------------- | ----------------------------------- |
| Runtime        | Bun                                 |
| Framework      | Next.js 15 (App Router)             |
| UI             | shadcn/ui (new-york) + Tailwind v4  |
| Auth           | Clerk                               |
| Backend        | Convex (planned)                    |
| Theme          | next-themes                         |
| i18n           | next-intl (planned)                 |
| LLM            | OpenRouter                          |
| Toast          | Sonner                              |
| Error Tracking | Sentry (planned)                    |

## Development Commands

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Build for production
bun run build

# Lint
bun run lint

# Add shadcn component
bunx shadcn@latest add [component-name]

# Start Convex dev (when setup)
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

### Project Structure

```
app/                    # Next.js App Router pages only
components/
├── ui/                 # shadcn components
├── chat/               # Chat-related components
├── dashboard/          # Dashboard components
└── common/             # Shared components (logo, theme-toggle, etc.)
actions/                # All server actions
hooks/                  # All custom hooks
lib/                    # Pure utilities (no React)
convex/                 # Convex backend (when setup)
```

### User Roles

- **Admin**: Full access to everything
- **Teacher (Багш)**: Manage students, view analytics
- **Student (Сурагч)**: AI chat access only

## File Naming Conventions

| Type           | Convention         | Example              |
| -------------- | ------------------ | -------------------- |
| Components     | `kebab-case.tsx`   | `student-table.tsx`  |
| Hooks          | `use-[name].ts`    | `use-debounce.ts`    |
| Server Actions | `[verb]-[noun].ts` | `create-student.ts`  |
| Route groups   | `([name])/`        | `(dashboard)/`       |
| Convex         | `camelCase.ts`     | `conversations.ts`   |

## Key Patterns

**Styling with cn():**
```typescript
import { cn } from "@/lib/utils";

<div className={cn("base-class", isActive && "active-class")} />
```

**Convex Queries (when setup):**
```typescript
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

**Theme Toggle:**
```typescript
import { useTheme } from "next-themes";

const { theme, setTheme } = useTheme();
```

## Styling Guidelines

- Use Tailwind CSS utility classes
- Use `cn()` helper from `@/lib/utils` for conditional classes
- Mobile-first: Start with mobile styles, add `md:`, `lg:` breakpoints
- Use shadcn/ui components where possible
- Dark mode: Use `dark:` prefix for dark mode variants

## Important Notes

- All UI text should be in Mongolian by default
- Use proper Mongolian Cyrillic characters
- Translation files are in `messages/mn.json` and `messages/en.json`
- OpenRouter allows switching between LLM models (GPT-4o, Claude, Gemini, DeepSeek)

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

Future (when features are implemented):
- `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`
- `OPENROUTER_API_KEY`
- `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`

## Documentation

Detailed specs are in the `docs/` folder:
- `BUILD.md` - Full build specifications and setup guide
- `CODE-STRUCTURE.md` - Component patterns and import strategy
- `SECURITY-CHAT.md` - Chat security implementation (rate limiting, quotas)
- `axiom.md` - Logging integration plan
