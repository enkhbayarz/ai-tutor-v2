# AGENTS.md

This file provides guidance for agentic coding assistants working in this repository.

## Development Commands

```bash
# Start development server
bun run dev

# Build for production
bun run build

# Start production server
bun run start

# Run ESLint
bun run lint

# Install dependencies
bun install

# Add shadcn/ui component
bunx shadcn@latest add [component-name]

# Run all tests (add Jest/Vitest when needed)
bun test

# Run a single test file
bun test path/to/test.test.ts
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

### Import Style

```typescript
// External dependencies
import { useState } from "react";
import { redirect } from "next/navigation";

// Third-party components
import { Button } from "@/components/ui/button";
import { Trash2, Pencil } from "lucide-react";

// Local components
import { TeacherTable } from "@/components/teachers/teacher-table";

// Utilities
import { cn } from "@/lib/utils";
```

Always use `@/` path aliases for internal imports.

### TypeScript

- Strict mode enabled in tsconfig.json
- Define interfaces for component props at the top
- Use explicit types for function parameters and returns
- Use `React.ComponentProps` when extending HTML element props

```typescript
interface TeacherTableProps {
  teachers: Teacher[];
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function TeacherTable({ teachers, currentPage, onPageChange }: TeacherTableProps) {
  // ...
}
```

### Component Patterns

**Pages:** Use default export, server components by default (no "use client" directive), add "use client" only when using hooks or browser APIs.

**Reusable Components:** Use named exports, define props interface, support className prop using cn() helper.

```typescript
interface ComponentProps {
  className?: string;
}

export function MyComponent({ className, ...props }: ComponentProps) {
  return <div className={cn("base-classes", className)} {...props} />
}
```

### Styling Guidelines

- Use Tailwind CSS utility classes
- Mobile-first: start with mobile styles, add `md:`, `lg:` breakpoints
- Use `cn()` helper from `@/lib/utils` for conditional classes
- Dark mode: use `dark:` prefix for dark theme variants

```typescript
<div className={cn("base-class", isActive && "active-class")} />
```

### Project Structure

```
app/                    # Next.js App Router pages only
components/
├── ui/                 # shadcn components
├── teachers/           # Feature-specific components
└── common/             # Shared components
actions/                # Server actions
hooks/                  # Custom hooks
lib/                    # Pure utilities (no React)
```

### Error Handling

- Use try-catch for async operations
- Show user-friendly errors with Sonner toasts
- Never expose sensitive data in error messages

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
