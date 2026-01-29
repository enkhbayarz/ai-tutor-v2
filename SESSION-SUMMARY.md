# Session Summary - Security & Feature Improvements (Phases 1-4)

## Overview

All 4 phases of the improvement plan are now complete and building successfully.

- **Phase 1**: Critical security fixes (API auth, rate limiting, RBAC, data isolation, SSRF fix)
- **Phase 2**: Usage monitoring + anomaly detection
- **Phase 3**: Student progress tracking
- **Phase 4**: Learning path & personalization

---

## Phase 1: Critical Security Fixes

### API Route Protection (`proxy.ts`)
- Next.js 16 uses `proxy.ts` instead of `middleware.ts` (deleted `middleware.ts` to resolve conflict)
- Added `isProtectedApi` matcher for `/api/chat`, `/api/chimege`, `/api/extract-pdf`
- Calls `auth.protect()` for protected API routes

### SSRF Prevention (`app/api/chat/route.ts`)
- Replaced fetch-based `imageUrlToBase64` with synchronous `parseDataUrl`
- Only accepts `data:image/` URLs, rejecting HTTP URLs entirely

### Data Isolation
- Convex queries use `ctx.auth.getUserIdentity()` to verify ownership
- `conversations.list` no longer accepts `clerkUserId` param — uses auth identity directly
- All user-scoped queries check `clerkUserId === identity.subject`

### RBAC
- `requireRole` helper in Convex checks users table role field
- `RoleGuard` component redirects unauthorized users
- `RoleVisible` component hides content without redirect
- Sidebar filters nav items by user role

---

## Phase 2: Usage Monitoring

### New Table: `usageEvents`
- Fields: `clerkUserId`, `eventType`, `metadata`, `timestamp`
- Indexes: `by_user`, `by_type`, `by_timestamp`

### File: `convex/usageEvents.ts`
- `record` (internalMutation)
- `recordEvent` (mutation with auth)
- `getByUser`, `listRecent`, `getUsageStats`, `checkAnomalies`

### Usage Tracking Locations
- `convex/messages.ts` — tracks `chat_message`, `image_upload`, `file_upload`
- `app/api/chimege/route.ts` — tracks `stt_request`
- `app/api/extract-pdf/route.ts` — tracks `pdf_extraction`

### Dashboard: `/usage`
- Admin-only page showing usage statistics
- Anomaly detection (flags unusual activity patterns)

---

## Phase 3: Student Progress Tracking

### New Tables
- `learningInteractions` — individual student-topic interactions
- `topicMastery` — per-topic mastery scores
- `studentProgress` — aggregate progress per student

### Convex Functions
- `convex/learningInteractions.ts` — `record` (updates mastery + progress), `getByUser`, `getBySubject`, `getByStudent`
- `convex/topicMastery.ts` — `getByUser`, `getWeakTopics`, `getStrongTopics`, `getBySubject`, `getByStudent`
- `convex/studentProgress.ts` — `getProgress`, `getClassProgress`, `getStudentsBehind`, `getStudentProgress`

### Interaction Recording
- `chat-view.tsx` calls `recordInteraction` after AI response when textbook reference is active
- Tracks: textbookId, subjectName, grade, topicTitle, interactionType, conversationId

### Dashboard: `/progress`
- Shows topic mastery visualization
- Accessible by admin, teacher, student roles

---

## Phase 4: Learning Path & Personalization

### New Table: `learningPaths`
- Fields: `clerkUserId`, `subjectName`, `grade`, `currentLevel`, `completedTopics`, `currentTopicId`, `recommendedNextTopics`, `updatedAt`

### Personalized System Prompt (`app/api/chat/route.ts`)
- Queries `topicMastery.getWeakTopics` before building system prompt
- Appends weak topics context in Mongolian
- Wrapped in try/catch (fail-safe — chat works even if personalization fails)

### Teacher Analytics: `/analytics`
- Class overview cards (total students, avg accuracy, topics covered)
- Students at risk table (low accuracy or inactive)
- Full class progress table
- Accessible by admin and teacher roles

### Role Guard System
- `components/common/role-guard.tsx` — `RoleGuard` and `RoleVisible` components
- Dashboard layout wraps content with `RoleGuard allowedRoles={["admin", "teacher", "student"]}`
- Sidebar nav items have `roles` property for filtering

---

## Modified Files Summary

| File | Changes |
|------|---------|
| `proxy.ts` | Added API route protection |
| `app/api/chat/route.ts` | SSRF fix, auth, personalization, ConvexHttpClient |
| `app/api/chimege/route.ts` | Auth token, usage tracking |
| `app/api/extract-pdf/route.ts` | Auth token, usage tracking |
| `convex/schema.ts` | 5 new tables (usageEvents, learningInteractions, topicMastery, studentProgress, learningPaths) |
| `convex/usageEvents.ts` | Created — usage tracking functions |
| `convex/messages.ts` | Added usage event recording |
| `convex/learningInteractions.ts` | Existed — confirmed complete |
| `convex/topicMastery.ts` | Existed — confirmed complete |
| `convex/studentProgress.ts` | Created — progress queries |
| `convex/users.ts` | Added `setRole` mutation with admin bootstrap |
| `components/common/role-guard.tsx` | Created — RBAC components |
| `components/common/sidebar.tsx` | Role-based nav filtering |
| `components/chat/chat-view.tsx` | Learning interaction recording |
| `components/chat/history-panel.tsx` | Removed clerkUserId from query |
| `app/[locale]/(dashboard)/layout.tsx` | RoleGuard wrapper |
| `app/[locale]/(dashboard)/usage/page.tsx` | Created — admin usage dashboard |
| `app/[locale]/(dashboard)/progress/page.tsx` | Created — progress dashboard |
| `app/[locale]/(dashboard)/analytics/page.tsx` | Created — teacher analytics |
| `messages/mn.json` | Added translation keys |
| `messages/en.json` | Added translation keys |

---

## Sidebar Navigation (Role-Based)

```typescript
navItems = [
  { href: "/teacher-info", roles: ["admin"] },
  { href: "/student-info", roles: ["admin"] },
  { href: "/textbook", roles: ["admin", "teacher"] },
  { href: "/progress", roles: ["admin", "teacher", "student"] },
  { href: "/analytics", roles: ["admin", "teacher"] },
  { href: "/usage", roles: ["admin"] },
];
```

---

## Errors Encountered & Fixed

1. **middleware.ts vs proxy.ts conflict** — Next.js 16 error; deleted `middleware.ts`, updated `proxy.ts`
2. **"Insufficient permissions" on /usage** — User had no role set; added `setRole` mutation with admin bootstrap

---

## Post-Implementation Steps

1. Set your role to "admin" in Convex Dashboard (run `setRole` mutation with `role: "admin"`)
2. Run `bunx convex dev` to sync the new schema tables
3. Test each feature following the testing plan

---

## Testing Plan

1. **Build**: `bun run build` should pass
2. **API Auth**: Unauthenticated requests to `/api/chat`, `/api/chimege`, `/api/extract-pdf` should return 401
3. **Input Validation**: Chat API rejects empty messages, oversized payloads
4. **SSRF**: Image URLs starting with `http://` or `https://` are rejected; only `data:image/` accepted
5. **Data Isolation**: Users can only see their own conversations
6. **RBAC**: Students cannot access `/teacher-info`, `/student-info`, `/usage`, `/analytics`
7. **Usage Dashboard**: Admin can see usage stats at `/usage`
8. **Progress Dashboard**: Users can see their mastery at `/progress`
9. **Analytics**: Teachers can see class progress at `/analytics`
10. **Navigation**: Sidebar shows only role-appropriate items
11. **Schema Sync**: All new tables appear in Convex Dashboard
