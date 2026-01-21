# AI Tutor V2 - Build Guide

> Complete build specifications for AI Academy Asia's AI Tutor platform

## Quick Start Prompt

Copy this entire prompt to start a fresh Claude Code conversation:

---

```
Build an AI Tutor web platform for AI Academy Asia - a Mongolian educational platform.

## Tech Stack (MUST USE)
- Runtime: Bun (NOT npm/yarn)
- Framework: Next.js latest with App Router
- UI: shadcn/ui + Tailwind CSS
- Auth: Clerk (email + password only)   - NEXT AUTH V4
- Backend: Convex
- Theme: next-themes (light default, dark support)
- i18n: next-intl (Mongolian default, English fallback)
- LLM: OpenRouter API for flexible model selection
- Toast: Sonner
- Error Tracking: Sentry (error monitoring, performance tracking)
- Formatting: Prettier + prettier-plugin-tailwindcss

## User Roles
- Admin: Full access (manage teachers, students, textbooks)
- Teacher (Багш): Manage students, view analytics
- Student (Сурагч): AI chat access, view assignments

## Pages Required

### Auth (Clerk)
- /sign-in - Login page
- /sign-up - Registration page

### Dashboard (/dashboard)
- / - Overview with stats
- /students - Student list with CRUD, search, pagination
- /teachers - Teacher list with CRUD
- /textbooks - Textbook management (title, grade, subject, file upload)
- /settings - Profile, theme toggle, language switch

### AI Chat (/chat)
- / - New conversation
- /[id] - Existing conversation
- Features: Streaming responses, conversation history sidebar, model selector

## Design Requirements
- Mobile-first responsive design
- Clean, modern UI (reference: t3.chat, ChatGPT, Claude)
- All UI text in Mongolian by default
- Support dark/light theme with system preference detection

## Convex Schema
- users (synced from Clerk: clerkId, email, name, role, avatarUrl)
- conversations (userId, title, model, timestamps)
- messages (conversationId, role, content, attachments)
- teachers (userId, phone, classes, subjects)
- students (userId, teacherId, className, grade)
- textbooks (title, subject, grade, fileUrl, status, createdBy)

## File Structure
Use Next.js App Router with route groups:
- (auth) - Public auth pages
- (dashboard) - Protected admin/teacher pages with sidebar layout
- (chat) - AI chat interface with different layout

## Important Notes
- Initialize with: bunx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir
- Use shadcn sidebar component for navigation
- Clerk webhook to sync users to Convex
- OpenRouter for LLM API (supports GPT-4o, Claude, Gemini, DeepSeek)
- All Mongolian text should use proper Cyrillic characters
- Setup Sentry for error tracking and performance monitoring
- Add placeholder for analytics (Google, Vercel, PostHog) - setup later

Start by setting up the project structure and core dependencies, then build phase by phase.
```

---

## Detailed Specifications

### Tech Stack

| Category         | Technology              | Notes                                         |
| ---------------- | ----------------------- | --------------------------------------------- |
| Runtime          | **Bun**                 | Fast package manager, NOT npm/yarn            |
| Framework        | **Next.js latest**      | App Router, React Server Components           |
| UI Components    | **shadcn/ui**           | Tailwind-based, customizable                  |
| Styling          | **Tailwind CSS**        | Mobile-first approach                         |
| Authentication   | **Clerk**               | Email + Password only for now                 |
| Backend/Database | **Convex**              | Real-time, serverless                         |
| Theme            | **next-themes**         | Light default, dark support                   |
| i18n             | **next-intl**           | Mongolian (mn) default, English (en) fallback |
| LLM Integration  | **OpenRouter**          | Flexible model selection                      |
| Toast            | **Sonner**              | Modern toast notifications                    |
| Error Tracking   | **Sentry**              | Error monitoring, performance, session replay |
| Formatting       | **Prettier**            | With tailwindcss plugin                       |
| Analytics        | Google, Vercel, PostHog | Setup later                                   |

### User Roles (Scalable for IAM-style)

```
Admin (Админ)
├── Full platform access
├── Manage all teachers and students
├── Manage textbooks/content
├── View all analytics
└── System settings

Teacher (Багш)
├── View assigned students
├── Class management
├── Content assignment
├── View class analytics
└── AI chat access

Student (Сурагч)
├── AI tutor chat
├── View assignments
├── Profile settings
└── Chat history
```

### Database Schema (Convex)

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users - synced from Clerk
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("teacher"),
      v.literal("student")
    ),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_clerkId", ["clerkId"]),

  // Conversations
  conversations: defineTable({
    userId: v.id("users"),
    title: v.string(),
    model: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  // Messages
  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system")
    ),
    content: v.string(),
    attachments: v.optional(v.array(v.string())),
    createdAt: v.number(),
  }).index("by_conversationId", ["conversationId"]),

  // Teachers (extended profile)
  teachers: defineTable({
    userId: v.id("users"),
    phone: v.string(),
    classes: v.array(v.string()),
    subjects: v.array(v.string()),
  }).index("by_userId", ["userId"]),

  // Students (extended profile)
  students: defineTable({
    userId: v.id("users"),
    teacherId: v.optional(v.id("users")),
    className: v.string(),
    grade: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_teacherId", ["teacherId"]),

  // Textbooks (for RAG later)
  textbooks: defineTable({
    title: v.string(),
    subject: v.string(),
    grade: v.number(),
    fileUrl: v.string(),
    status: v.union(v.literal("draft"), v.literal("published")),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_grade", ["grade"])
    .index("by_subject", ["subject"]),
});
```

### Project Structure

```
ai-tutor-v2/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   │   ├── sign-up/[[...sign-up]]/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx           # Sidebar + Header
│   │   │   ├── page.tsx             # Dashboard home
│   │   │   ├── students/
│   │   │   │   └── page.tsx
│   │   │   ├── teachers/
│   │   │   │   └── page.tsx
│   │   │   ├── textbooks/
│   │   │   │   └── page.tsx
│   │   │   └── settings/
│   │   │       └── page.tsx
│   │   ├── (chat)/
│   │   │   ├── layout.tsx           # Chat layout
│   │   │   └── chat/
│   │   │       ├── page.tsx         # New chat
│   │   │       └── [id]/page.tsx    # Conversation
│   │   ├── api/
│   │   │   ├── chat/route.ts        # OpenRouter streaming
│   │   │   └── webhooks/
│   │   │       └── clerk/route.ts   # Clerk webhook
│   │   ├── globals.css
│   │   ├── layout.tsx               # Root layout
│   │   └── page.tsx                 # Landing/redirect
│   ├── components/
│   │   ├── ui/                      # shadcn components
│   │   ├── chat/
│   │   │   ├── chat-input.tsx
│   │   │   ├── chat-messages.tsx
│   │   │   ├── chat-sidebar.tsx
│   │   │   └── model-selector.tsx
│   │   ├── dashboard/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   ├── stats-card.tsx
│   │   │   └── data-table.tsx
│   │   └── shared/
│   │       ├── theme-toggle.tsx
│   │       ├── language-switch.tsx
│   │       └── user-button.tsx
│   ├── lib/
│   │   ├── utils.ts                 # cn() helper
│   │   └── openrouter.ts            # LLM client
│   ├── hooks/
│   │   ├── use-chat.ts
│   │   └── use-user.ts
│   └── i18n/
│       ├── config.ts
│       ├── mn.json
│       └── en.json
├── convex/
│   ├── _generated/
│   ├── schema.ts
│   ├── users.ts
│   ├── conversations.ts
│   ├── messages.ts
│   ├── teachers.ts
│   ├── students.ts
│   └── textbooks.ts
├── public/
│   └── images/
├── uiux/                            # Figma exports
├── .env.local
├── .prettierrc
├── components.json                  # shadcn config
├── convex.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### Implementation Phases

#### Phase 1: Project Setup

```bash
# In the ai-tutor-v2 folder
bunx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Core dependencies
bun add @clerk/nextjs convex next-themes next-intl sonner @sentry/nextjs

# shadcn setup
bunx shadcn@latest init
bunx shadcn@latest add button input card table dialog dropdown-menu avatar badge sheet sidebar separator scroll-area tooltip

# Dev dependencies
bun add -D prettier prettier-plugin-tailwindcss

# Initialize Convex
bunx convex dev

# Initialize Sentry (interactive wizard)
bunx @sentry/wizard@latest -i nextjs
```

#### Phase 2: Authentication & Layout

- Configure Clerk provider
- Setup middleware for protected routes
- Build responsive sidebar with shadcn
- Create header with user menu
- Implement theme toggle
- Setup i18n with next-intl

#### Phase 3: Dashboard Features

- Dashboard overview with stats
- Student management (CRUD, search, pagination)
- Teacher management
- Textbook management
- Data tables with sorting/filtering

#### Phase 4: AI Chat

- Chat interface layout
- Conversation sidebar
- Message components
- OpenRouter API integration
- Streaming responses
- Model selection
- File/image upload

#### Phase 5: Polish

- Settings page
- Profile management
- Loading states
- Error handling
- Toast notifications
- Mobile testing

### Environment Variables

```env
# .env.local

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Convex
CONVEX_DEPLOYMENT=dev:...
NEXT_PUBLIC_CONVEX_URL=https://....convex.cloud

# OpenRouter
OPENROUTER_API_KEY=sk-or-...

# Sentry
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=sntrys_xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Analytics (setup later)
NEXT_PUBLIC_GA_ID=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
```

### i18n Translations

```json
// src/i18n/mn.json
{
  "common": {
    "save": "Хадгалах",
    "cancel": "Болих",
    "delete": "Устгах",
    "edit": "Засах",
    "add": "Нэмэх",
    "search": "Хайх",
    "loading": "Уншиж байна...",
    "noData": "Мэдээлэл байхгүй"
  },
  "auth": {
    "signIn": "Нэвтрэх",
    "signUp": "Бүртгүүлэх",
    "signOut": "Гарах",
    "email": "Имэйл",
    "password": "Нууц үг"
  },
  "dashboard": {
    "title": "Хяналтын самбар",
    "students": "Сурагчид",
    "teachers": "Багш нар",
    "textbooks": "Сурах бичиг",
    "settings": "Тохиргоо"
  },
  "chat": {
    "newChat": "Шинэ чат",
    "placeholder": "Энд бичнэ үү...",
    "send": "Илгээх"
  }
}
```

### Verification Checklist

- [ ] `bun run dev` runs without errors
- [ ] Sign up / Sign in with Clerk works
- [ ] Users sync to Convex via webhook
- [ ] Theme toggle persists (localStorage)
- [ ] Language switch works (mn/en)
- [ ] Dashboard sidebar navigation works
- [ ] Student/Teacher CRUD operations work
- [ ] Chat sends messages
- [ ] Chat receives streaming responses
- [ ] Mobile responsive on all pages
- [ ] Mongolian text displays correctly
