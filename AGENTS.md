# AGENTS.md

This file provides guidance for agentic coding assistants working in this repository.

## Development Commands

```bash
bun run dev          # Start dev server
bun run build        # Build for production
bun run start        # Start production server
bun run lint         # Run ESLint
bun install          # Install dependencies
bunx shadcn@latest add [component-name]  # Add shadcn/ui component
bun test             # Run all tests (when added)
bun test path/to/test.test.ts  # Run single test file
```

## Tech Stack

- Runtime: Bun
- Framework: Next.js 15 (App Router)
- UI: shadcn/ui (new-york) + Tailwind v4
- Auth: Clerk
- Theme: next-themes
- Toast: Sonner

## Code Style Guidelines

### File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | `kebab-case.tsx` | `teacher-table.tsx` |
| Hooks | `use-[name].ts` | `use-debounce.ts` |
| Server Actions | `[verb]-[noun].ts` | `create-teacher.ts` |
| Route Groups | `([name])/` | `(dashboard)/` |
| Private Folders | `_[name]/` | `_components/` |

### Import Style

```typescript
// 1. React/Node builtins
import { useState, useEffect } from "react";

// 2. External packages
import { z } from "zod";

// 3. Internal aliases (@/)
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

// 4. Parent imports (../)
import { DashboardLayout } from "../_components/layout";

// 5. Sibling imports (./)
import { StudentForm } from "./_components/student-form";
```

Use barrel exports only for `@/components/ui`. Direct imports elsewhere.

### TypeScript

- Strict mode enabled in tsconfig.json
- Define interfaces for component props at the top
- Use explicit types for function parameters and returns
- Use `React.ComponentProps` when extending HTML element props

### Component Patterns

**Pages:** Default export, server components by default (no "use client"), add "use client" only for hooks/browser APIs.

**Reusable Components:** Named exports, define props interface, support className prop with cn(). Route-specific: use `_components/` in route folder. Global shared (3+ uses): use `components/common/`.

### Styling Guidelines

- Use Tailwind CSS utility classes
- Mobile-first: start with mobile styles, add `md:`, `lg:` breakpoints
- Use `cn()` helper from `@/lib/utils` for conditional classes
- Dark mode: use `dark:` prefix for dark theme variants
- Use class-variance-authority (CVA) for component variants

```typescript
<div className={cn("base-class", isActive && "active-class")} />
```

### Project Structure

```
app/                    # Next.js App Router pages only
components/
├── ui/                 # shadcn components (barrel export only)
├── common/             # Shared components (3+ uses)
└── teachers/           # Feature-specific components
actions/                # Server actions
hooks/                  # Custom hooks
lib/                    # Pure utilities (no React)
```

Route-specific: use `_components/`, `_actions/`, `_hooks/` in route folders.

### Server Actions

Use Zod validation and return consistent `ActionResult<T>` type:

```typescript
"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const schema = z.object({ name: z.string().min(2) });
type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export async function createTeacher(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    revalidatePath("/teachers");
    return { success: true, data: { id: "123" } };
  } catch {
    return { success: false, error: "Алдаа гарлаа" };
  }
}
```

### Error Handling

- Use try-catch for async operations
- Show user-friendly errors with Sonner toasts
- Never expose sensitive data in error messages
- Use Mongolian text for user-facing errors

### Authentication

All routes in `(dashboard)/` route group require authentication.
Use Clerk's `<ClerkProvider>` wrapper in root layout.
Use `redirect()` from `next/navigation` for route protection.

### Internationalization

UI text should be in Mongolian by default.
Use proper Mongolian Cyrillic characters.
Translation files: `messages/mn.json`, `messages/en.json`.

## Important Notes

- Never use console.log in production code
- Keep component files focused and reasonably sized
- Extract reusable logic to custom hooks or utilities
- Use existing shadcn/ui components when possible
- All new components should follow the established patterns
