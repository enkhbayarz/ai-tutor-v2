# Security Hardening + Learning Path System

## Overview
Two parallel tracks:
- **Track A**: Fix critical security vulnerabilities (API auth, rate limiting, RBAC, data isolation)
- **Track B**: Build student progress tracking and personalized learning paths

---

## Phase 1: Critical Security Fixes

### Step 1.1: Create middleware.ts (API route protection)

**Create**: `middleware.ts` (project root - DOES NOT EXIST currently)

Combine Clerk auth + next-intl locale routing. Protect all API routes except webhooks.

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);
const isProtectedApi = createRouteMatcher(["/api/chat(.*)", "/api/chimege(.*)", "/api/extract-pdf(.*)"]);
const isPublicRoute = createRouteMatcher(["/(.*)/sign-in(.*)", "/(.*)/sign-up(.*)", "/api/webhooks(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedApi(req)) {
    await auth.protect();
  }
  if (!isProtectedApi(req) && !isPublicRoute(req)) {
    return intlMiddleware(req);
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/api/(.*)"],
};
```

### Step 1.2: Add auth checks to API route handlers

**Modify**: `app/api/chat/route.ts`, `app/api/chimege/route.ts`, `app/api/extract-pdf/route.ts`

Add at top of each POST handler:
```typescript
import { auth } from "@clerk/nextjs/server";

const { userId } = await auth();
if (!userId) return new Response("Unauthorized", { status: 401 });
```

### Step 1.3: Fix SSRF in imageUrl parameter

**Modify**: `app/api/chat/route.ts`

Only accept data URLs (base64) for imageUrl - reject arbitrary HTTP URLs:
```typescript
if (imageUrl && !imageUrl.startsWith("data:image/")) {
  return new Response("Invalid image URL format", { status: 400 });
}
```

### Step 1.4: Input validation on chat API

**Modify**: `app/api/chat/route.ts`

- Max 50 messages per request
- Max 4000 chars per message content
- Max 10000 chars for textbookContext
- Strip any `system` role from client-provided messages
- Validate model is exactly "openai" or "gemini"

### Step 1.5: Install and configure @convex-dev/rate-limiter

**Install**: `bun add @convex-dev/rate-limiter`

**Create**: `convex/convex.config.ts`
```typescript
import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";

const app = defineApp();
app.use(rateLimiter);
export default app;
```

**Create**: `convex/rateLimits.ts`
```typescript
import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  sendMessage: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 10 },
  fileUpload: { kind: "token bucket", rate: 5, period: MINUTE, capacity: 5 },
  pdfExtraction: { kind: "fixed window", rate: 2, period: HOUR },
  sttRequest: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 10 },
});
```

### Step 1.6: Create auth helper for Convex

**Create**: `convex/lib/auth.ts`
```typescript
import { QueryCtx, MutationCtx } from "../_generated/server";

export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity;
}

export async function requireRole(ctx: QueryCtx | MutationCtx, roles: string[]) {
  const identity = await requireAuth(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (!user?.role || !roles.includes(user.role)) {
    throw new Error("Insufficient permissions");
  }
  return { identity, user };
}
```

### Step 1.7: Add auth + rate limiting to Convex mutations

**Modify**: `convex/conversations.ts`
- Remove `clerkUserId` from create args (derive from identity)
- Add ownership checks to get, list, remove, touch, updateTitle
- Add rate limit check on create

**Modify**: `convex/messages.ts`
- Add auth check + verify conversation ownership before send
- Add rate limit on send and generateUploadUrl
- Add auth check to list (verify user owns conversation)

**Modify**: `convex/textbooks.ts`
- Add `requireRole(ctx, ["admin", "teacher"])` to create, update, softDelete
- Read queries (list, getById) remain accessible to all authenticated users

**Modify**: `convex/teachers.ts`, `convex/students.ts`
- Add `requireRole(ctx, ["admin"])` to all write operations

### Step 1.8: Update frontend to remove clerkUserId from mutations

**Modify**: `components/chat/chat-view.tsx`
- Remove `clerkUserId: user.id` from createConversation call
- Conversation create now only takes `{ title, model }`

**Modify**: `components/chat/chat-sidebar.tsx`
- Update conversations.list call (server derives user from auth)

---

## Phase 2: Usage Monitoring + Anomaly Detection

### Step 2.1: Usage events schema

**Modify**: `convex/schema.ts` - Add:
```typescript
usageEvents: defineTable({
  clerkUserId: v.string(),
  eventType: v.union(
    v.literal("chat_message"),
    v.literal("stt_request"),
    v.literal("pdf_extraction"),
    v.literal("file_upload"),
    v.literal("image_analysis")
  ),
  model: v.optional(v.string()),
  timestamp: v.number(),
})
  .index("by_user", ["clerkUserId"])
  .index("by_user_time", ["clerkUserId", "timestamp"])
  .index("by_timestamp", ["timestamp"]),
```

### Step 2.2: Track usage in mutations

**Create**: `convex/usageEvents.ts`
- `record` mutation (internal): Insert usage event
- `getByUser` query: Get usage for admin dashboard
- `checkAnomaly` query: Flag users with > 100 events in last 5 min

**Modify**: `convex/messages.ts` - After successful send, record "chat_message" event

### Step 2.3: Admin usage dashboard

**Create**: `app/[locale]/(dashboard)/usage/page.tsx`
- Show per-user usage stats (messages today, this week)
- Highlight anomalous users (excessive usage)
- Total API costs estimate

---

## Phase 3: Student Progress Tracking

### Step 3.1: Learning schema additions

**Modify**: `convex/schema.ts` - Add:

```typescript
learningInteractions: defineTable({
  clerkUserId: v.string(),
  textbookId: v.optional(v.id("textbooks")),
  chapterId: v.optional(v.string()),
  topicId: v.optional(v.string()),
  subjectName: v.string(),
  grade: v.number(),
  topicTitle: v.string(),
  interactionType: v.union(
    v.literal("question"),
    v.literal("quiz_attempt"),
    v.literal("explanation_request"),
    v.literal("problem_solving")
  ),
  isCorrect: v.optional(v.boolean()),
  conversationId: v.optional(v.id("conversations")),
  timestamp: v.number(),
})
  .index("by_user", ["clerkUserId"])
  .index("by_user_subject", ["clerkUserId", "subjectName"]),

topicMastery: defineTable({
  clerkUserId: v.string(),
  subjectName: v.string(),
  grade: v.number(),
  topicTitle: v.string(),
  masteryLevel: v.union(
    v.literal("not_started"),
    v.literal("beginner"),
    v.literal("intermediate"),
    v.literal("advanced"),
    v.literal("mastered")
  ),
  totalInteractions: v.number(),
  correctAnswers: v.number(),
  totalQuizAttempts: v.number(),
  totalTimeSpent: v.number(),
  lastInteractionAt: v.number(),
})
  .index("by_user", ["clerkUserId"])
  .index("by_user_subject", ["clerkUserId", "subjectName"])
  .index("by_mastery", ["clerkUserId", "masteryLevel"]),

studentProgress: defineTable({
  clerkUserId: v.string(),
  totalStudyTime: v.number(),
  totalInteractions: v.number(),
  averageAccuracy: v.number(),
  currentLevel: v.union(
    v.literal("beginner"),
    v.literal("intermediate"),
    v.literal("advanced")
  ),
  topicsMastered: v.number(),
  currentStreak: v.number(),
  lastActiveAt: v.number(),
})
  .index("by_user", ["clerkUserId"]),
```

### Step 3.2: Learning analytics functions

**Create**: `convex/learningInteractions.ts`
- `record` mutation: Save interaction + update topicMastery
- `getByUser` query: Recent interactions for student
- `getBySubject` query: Interactions per subject

**Create**: `convex/topicMastery.ts`
- `getByUser` query: All mastery records
- `getWeakTopics` query: Topics with accuracy < 50%
- `getStrongTopics` query: Mastered topics
- `updateMastery` internal mutation: Recalculate from interactions

**Create**: `convex/studentProgress.ts`
- `getProgress` query: Authenticated student's own progress
- `getClassProgress` query: Teacher/admin view of all students
- `getStudentsBehind` query: Students falling behind (low accuracy or inactive)

### Step 3.3: Integrate tracking into chat

**Modify**: `components/chat/chat-view.tsx`
- After AI response, if reference is active, call `learningInteractions.record`
- Track subject/topic from reference metadata

**Modify**: `app/api/chat/route.ts`
- When image is analyzed (problem solving), mark as "problem_solving" type

### Step 3.4: Student progress dashboard

**Create**: `app/[locale]/(dashboard)/progress/page.tsx`
- Overview cards: Study time, topics mastered, streak, accuracy
- Subject breakdown with mastery levels
- Weak areas list with recommendations

**Create**: `components/dashboard/progress-overview.tsx`
**Create**: `components/dashboard/weak-areas-list.tsx`

---

## Phase 4: Learning Path & Personalization

### Step 4.1: Learning paths schema

**Modify**: `convex/schema.ts` - Add:
```typescript
learningPaths: defineTable({
  clerkUserId: v.string(),
  subjectName: v.string(),
  grade: v.number(),
  currentLevel: v.string(),
  completedTopics: v.array(v.string()),
  currentTopicId: v.optional(v.string()),
  recommendedNextTopics: v.array(v.object({
    topicId: v.string(),
    topicTitle: v.string(),
    reason: v.string(),
    priority: v.number(),
  })),
  updatedAt: v.number(),
})
  .index("by_user", ["clerkUserId"])
  .index("by_user_subject", ["clerkUserId", "subjectName"]),
```

### Step 4.2: Personalized system prompt

**Modify**: `app/api/chat/route.ts`
- Query student's weak areas before building system prompt
- Append personalization context:
  ```
  Сурагчийн түвшин: [level]. Сул талууд: [topics].
  Энэ сурагчид хариулах үедээ тэдний сул талуудыг анхаарч, нэмэлт тайлбар өгөх.
  ```

### Step 4.3: Teacher view - students behind

**Create**: `app/[locale]/(dashboard)/analytics/page.tsx`
- Class-wide analytics: hardest topics, most active students
- Students falling behind (< 50% accuracy, inactive > 7 days)
- Filterable by grade, subject

### Step 4.4: Frontend role guard

**Create**: `components/common/role-guard.tsx`
- Redirect students away from dashboard routes → /chat
- Show admin-only features conditionally

---

## Files Summary

### New files to create:
- `middleware.ts` - Route protection
- `convex/convex.config.ts` - Rate limiter component config
- `convex/rateLimits.ts` - Rate limit definitions
- `convex/lib/auth.ts` - Auth helper (requireAuth, requireRole)
- `convex/usageEvents.ts` - Usage tracking
- `convex/learningInteractions.ts` - Learning interaction CRUD
- `convex/topicMastery.ts` - Mastery aggregation
- `convex/studentProgress.ts` - Student progress queries
- `app/[locale]/(dashboard)/progress/page.tsx` - Student progress page
- `app/[locale]/(dashboard)/analytics/page.tsx` - Teacher analytics
- `app/[locale]/(dashboard)/usage/page.tsx` - Admin usage monitoring
- `components/dashboard/progress-overview.tsx`
- `components/dashboard/weak-areas-list.tsx`
- `components/common/role-guard.tsx`

### Files to modify:
- `convex/schema.ts` - Add 5 new tables
- `convex/conversations.ts` - Auth + ownership checks
- `convex/messages.ts` - Auth + rate limiting + ownership
- `convex/textbooks.ts` - RBAC (admin/teacher only for writes)
- `convex/teachers.ts` - RBAC (admin only)
- `convex/students.ts` - RBAC (admin only)
- `app/api/chat/route.ts` - Auth, SSRF fix, input validation, personalization
- `app/api/chimege/route.ts` - Auth check
- `app/api/extract-pdf/route.ts` - Auth check
- `components/chat/chat-view.tsx` - Remove clerkUserId, add interaction tracking
- `components/chat/chat-sidebar.tsx` - Update query calls
- `messages/mn.json` + `messages/en.json` - New keys

### Package to install:
- `@convex-dev/rate-limiter`

---

## Verification

1. `bun run build` passes after each phase
2. Unauthenticated requests to `/api/chat` return 401
3. Rate limiting: 11th message in 1 minute returns rate limit error
4. Student role cannot access `/teacher-info` or `/student-info`
5. User A cannot read User B's conversations
6. SSRF: Passing `imageUrl: "http://internal-server/..."` returns 400
7. Message > 4000 chars returns 400
8. Learning interaction recorded when chatting with textbook reference
9. Progress dashboard shows mastery data
10. Teacher can view class-wide analytics
