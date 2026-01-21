# AI Tutor V2 - Code Structure Guide

> Clean, maintainable Next.js 15 code structure following Theo's T3 recommendations and modern best practices.

## Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Naming Conventions](#naming-conventions)
- [Component Patterns](#component-patterns)
- [Import Strategy](#import-strategy)
- [Server Actions](#server-actions)
- [Quick Reference](#quick-reference)

---

## Overview

This codebase follows these principles:

| Principle | Description |
|-----------|-------------|
| **Colocation** | Route-specific code lives with its route (`_components/`, `_actions/`, `_hooks/`) |
| **Strict Conventions** | ESLint enforced naming and import ordering |
| **Mixed Imports** | Barrel exports for UI only, direct imports elsewhere |
| **shadcn + CVA** | Use class-variance-authority for component variants |
| **Convex + Actions** | Convex for DB mutations, Server Actions for form handling |

---

## Project Structure

```
ai-tutor-v2/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/               # Auth route group (no sidebar)
│   │   │   ├── sign-in/
│   │   │   │   ├── page.tsx
│   │   │   │   └── _components/  # Route-specific components
│   │   │   └── sign-up/
│   │   │
│   │   ├── (dashboard)/          # Dashboard route group (with sidebar)
│   │   │   ├── layout.tsx        # Shared sidebar layout
│   │   │   ├── page.tsx          # Dashboard home
│   │   │   ├── _components/      # Shared across dashboard routes
│   │   │   ├── students/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── _components/  # Student-specific components
│   │   │   │   ├── _actions/     # Server actions
│   │   │   │   └── _hooks/       # Route-specific hooks
│   │   │   ├── teachers/
│   │   │   ├── textbooks/
│   │   │   └── settings/
│   │   │
│   │   ├── (chat)/               # Chat route group (different layout)
│   │   │   ├── layout.tsx
│   │   │   ├── chat/
│   │   │   │   ├── page.tsx      # New chat
│   │   │   │   ├── [id]/page.tsx # Existing conversation
│   │   │   │   └── _components/
│   │   │   └── _hooks/
│   │   │
│   │   ├── api/                  # API routes
│   │   │   ├── chat/route.ts
│   │   │   └── webhooks/
│   │   │
│   │   ├── layout.tsx            # Root layout
│   │   ├── loading.tsx           # Global loading
│   │   ├── error.tsx             # Global error boundary
│   │   └── not-found.tsx
│   │
│   ├── components/               # GLOBAL reusable components
│   │   ├── ui/                   # shadcn (barrel export)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   └── index.ts          # Barrel exports
│   │   ├── common/               # Custom shared components
│   │   │   ├── logo.tsx
│   │   │   ├── theme-toggle.tsx
│   │   │   └── empty-state.tsx
│   │   └── forms/                # Reusable form patterns
│   │
│   ├── lib/                      # Utilities & configs
│   │   ├── utils.ts              # cn(), formatters
│   │   ├── constants.ts
│   │   ├── validation.ts         # Zod schemas
│   │   └── error-messages.ts     # Mongolian messages
│   │
│   ├── hooks/                    # GLOBAL hooks
│   │   ├── use-debounce.ts
│   │   └── use-media-query.ts
│   │
│   ├── types/                    # GLOBAL types
│   │   ├── user.ts
│   │   └── chat.ts
│   │
│   ├── providers/                # Context providers
│   │   └── index.tsx
│   │
│   └── i18n/                     # Translations
│       ├── mn.json
│       └── en.json
│
├── convex/                       # Convex backend
│   ├── schema.ts
│   ├── users.ts
│   └── conversations.ts
│
└── public/
```

### Key Conventions

| Folder | Purpose | When to Use |
|--------|---------|-------------|
| `_components/` | Route-specific components | Used by only this route |
| `_actions/` | Server actions | Form submissions, mutations |
| `_hooks/` | Route-specific hooks | Logic for only this route |
| `components/ui/` | shadcn primitives | Reused 3+ places |
| `components/common/` | Custom shared | Reused 3+ places |
| `lib/` | Pure utilities | No React, just functions |
| `hooks/` | Global hooks | Reused across routes |

---

## Naming Conventions

### Files & Folders

```
✅ CORRECT                    ❌ WRONG
student-table.tsx            StudentTable.tsx
use-debounce.ts              useDebounce.ts
create-student.ts            createStudent.ts
_components/                 components/
(dashboard)/                 dashboard/
```

| Type | Convention | Example |
|------|------------|---------|
| Components | `kebab-case.tsx` | `student-table.tsx` |
| Hooks | `use-[name].ts` | `use-debounce.ts` |
| Actions | `[verb]-[noun].ts` | `create-student.ts` |
| Private folders | `_[name]/` | `_components/` |
| Route groups | `([name])/` | `(dashboard)/` |
| Convex | `camelCase.ts` | `conversations.ts` |

### Code

```typescript
// ✅ CORRECT
interface StudentTableProps { ... }     // PascalCase interface
function StudentTable() { ... }         // PascalCase component
const isLoading = true;                 // camelCase boolean with is/has
const MAX_LENGTH = 4000;                // SCREAMING_SNAKE constant
const handleSubmit = () => { ... };     // handle[Event] handler

// ❌ WRONG
interface studentTableProps { ... }     // lowercase interface
function studentTable() { ... }         // lowercase component
const loading = true;                   // missing is/has prefix
const maxLength = 4000;                 // camelCase constant
const submitHandler = () => { ... };    // wrong naming pattern
```

---

## Component Patterns

### Standard Component Template

```tsx
// src/app/(dashboard)/students/_components/student-table.tsx

// 1. IMPORTS (grouped, ordered)
import { useState } from "react";                    // React first
import { useQuery } from "convex/react";             // External packages
import { api } from "@/convex/_generated/api";       // Internal aliases
import { Button, Table } from "@/components/ui";     // UI barrel
import { formatDate } from "@/lib/utils";            // Lib utilities

// 2. TYPES (colocated)
interface StudentTableProps {
  schoolId: string;
  onSelect?: (id: string) => void;
}

// 3. COMPONENT
export function StudentTable({ schoolId, onSelect }: StudentTableProps) {
  // a. Hooks first
  const students = useQuery(api.students.list, { schoolId });
  const [selected, setSelected] = useState<string | null>(null);

  // b. Derived state
  const isEmpty = !students || students.length === 0;

  // c. Handlers
  const handleSelect = (id: string) => {
    setSelected(id);
    onSelect?.(id);
  };

  // d. Early returns for loading/empty
  if (!students) return <TableSkeleton />;
  if (isEmpty) return <EmptyState message="Сурагч олдсонгүй" />;

  // e. Main render
  return (
    <Table>
      {students.map((student) => (
        <TableRow key={student._id} onClick={() => handleSelect(student._id)}>
          {/* ... */}
        </TableRow>
      ))}
    </Table>
  );
}

// 4. SUB-COMPONENTS (small, same file)
function TableSkeleton() {
  return <div className="animate-pulse h-48 bg-muted rounded-lg" />;
}
```

### Component with Variants (CVA Pattern)

```tsx
// src/components/common/stat-card.tsx

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statCardVariants = cva(
  "rounded-lg border p-6 transition-colors",
  {
    variants: {
      variant: {
        default: "bg-card",
        success: "bg-green-50 border-green-200 dark:bg-green-950",
        warning: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950",
        danger: "bg-red-50 border-red-200 dark:bg-red-950",
      },
      size: {
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

interface StatCardProps extends VariantProps<typeof statCardVariants> {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({
  title,
  value,
  icon,
  variant,
  size,
  className
}: StatCardProps) {
  return (
    <div className={cn(statCardVariants({ variant, size }), className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
```

---

## Import Strategy

### Barrel Exports: UI Only

```typescript
// src/components/ui/index.ts
export { Button, buttonVariants } from "./button";
export { Input } from "./input";
export { Card, CardHeader, CardContent } from "./card";
export { Table, TableHeader, TableRow, TableCell } from "./table";
```

```typescript
// Usage - clean, grouped
import { Button, Card, Input, Table } from "@/components/ui";
```

### Direct Imports: Everything Else

```typescript
// Common components
import { Logo } from "@/components/common/logo";
import { ThemeToggle } from "@/components/common/theme-toggle";

// Hooks
import { useDebounce } from "@/hooks/use-debounce";

// Lib
import { formatDate, cn } from "@/lib/utils";
import { MAX_MESSAGE_LENGTH } from "@/lib/constants";

// Route-specific (relative)
import { StudentForm } from "./_components/student-form";
import { createStudent } from "./_actions/create-student";
```

### Import Order (ESLint Enforced)

```typescript
// 1. React/Node builtins
import { useState, useEffect } from "react";

// 2. External packages
import { useQuery } from "convex/react";
import { z } from "zod";

// 3. Internal aliases (@/)
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui";
import { formatDate } from "@/lib/utils";

// 4. Parent imports (../)
import { DashboardLayout } from "../_components/layout";

// 5. Sibling imports (./)
import { StudentForm } from "./_components/student-form";
```

---

## Server Actions

### Standard Pattern

```typescript
// src/app/(dashboard)/students/_actions/create-student.ts
"use server";

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// 1. Validation Schema
const createStudentSchema = z.object({
  name: z.string().min(2, "Нэр хэт богино байна"),
  email: z.string().email("Имэйл буруу байна"),
  grade: z.number().min(1).max(12),
  className: z.string(),
});

// 2. Result Type
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// 3. Server Action
export async function createStudent(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    // Auth check
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Нэвтрэх шаардлагатай" };
    }

    // Validate
    const raw = Object.fromEntries(formData);
    const parsed = createStudentSchema.safeParse({
      ...raw,
      grade: Number(raw.grade),
    });

    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    // Mutate via Convex
    const id = await convex.mutation(api.students.create, parsed.data);

    // Revalidate
    revalidatePath("/students");

    return { success: true, data: { id } };
  } catch (error) {
    console.error("createStudent error:", error);
    return { success: false, error: "Алдаа гарлаа. Дахин оролдоно уу." };
  }
}
```

### Using in Components

```tsx
// src/app/(dashboard)/students/_components/student-form.tsx
"use client";

import { useTransition } from "react";
import { createStudent } from "../_actions/create-student";
import { Button } from "@/components/ui";
import { toast } from "sonner";

export function StudentForm() {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await createStudent(formData);

      if (result.success) {
        toast.success("Сурагч амжилттай нэмэгдлээ");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <form action={handleSubmit}>
      {/* form fields */}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Хадгалж байна..." : "Хадгалах"}
      </Button>
    </form>
  );
}
```

---

## Quick Reference

### Decision Tree: Where Does This Code Go?

```
Is this component used in only ONE route?
├── YES → Put in app/[route]/_components/
└── NO → Is it used 3+ times across different routes?
    ├── YES → Is it a primitive (button, input, card)?
    │   ├── YES → Put in components/ui/
    │   └── NO → Put in components/common/
    └── NO → Keep it in the first route that uses it,
             move to components/ when reuse is needed
```

### Checklist for New Features

- [ ] Route-specific code in `_components/`, `_actions/`, `_hooks/`
- [ ] File names use `kebab-case.tsx`
- [ ] Component names use `PascalCase`
- [ ] Props interface defined explicitly
- [ ] Loading and error states handled
- [ ] Mongolian text for user-facing strings
- [ ] Server actions return `ActionResult<T>` type

### Common Mistakes to Avoid

| Mistake | Fix |
|---------|-----|
| Putting route-specific component in `components/` | Use `_components/` in the route folder |
| Using `useState` for server data | Use Convex `useQuery` instead |
| Barrel exports everywhere | Only for `components/ui/` |
| Missing loading states | Add skeleton/spinner for async data |
| Console.log in production | Use `console.error` or remove |

---

## References

- [T3 Stack](https://create.t3.gg/en/introduction)
- [Next.js Project Structure](https://nextjs.org/docs/app/getting-started/project-structure)
- [Colocation Guide](https://next-colocation-template.vercel.app/)
- [CVA Documentation](https://cva.style/docs)
