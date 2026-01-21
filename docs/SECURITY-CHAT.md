# AI Tutor V2 - Chat Security Implementation Guide

> Comprehensive multi-layered security for the AI chat feature to prevent spam, control costs, and manage usage across school subscription plans.

## Table of Contents

- [Security Architecture](#security-architecture)
- [Protection Layers](#protection-layers)
- [Subscription Model](#subscription-model)
- [Database Schema](#database-schema)
- [Implementation](#implementation)
- [Error Messages](#error-messages)
- [Admin Dashboard](#admin-dashboard)
- [Environment Setup](#environment-setup)
- [Testing Checklist](#testing-checklist)

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     REQUEST FLOW & SECURITY LAYERS                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User Request ──► Edge (Middleware)                                 │
│                        │                                            │
│                        ▼                                            │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  LAYER 1: Edge Rate Limiting (Upstash Redis)                │    │
│  │  • Global: 1000 req/min system-wide                         │    │
│  │  • Per-IP: 30 req/min (unauthenticated)                     │    │
│  │  • Latency: < 2ms                                           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                        │                                             │
│                        ▼                                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  LAYER 2: Authentication (Clerk)                            │    │
│  │  • JWT validation                                           │    │
│  │  • Role check (student/teacher/admin)                       │    │
│  │  • School membership verification                           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                        │                                             │
│                        ▼                                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  LAYER 3: Quota Check (Convex)                              │    │
│  │  • School subscription active?                              │    │
│  │  • School pool balance check                                │    │
│  │  • Per-user daily limit check                               │    │
│  │  • Per-user RPM check (Upstash)                             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                        │                                             │
│                        ▼                                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  LAYER 4: Input Validation (Zod)                            │    │
│  │  • Message length: max 4000 chars                           │    │
│  │  • Content sanitization (XSS prevention)                    │    │
│  │  • Prompt injection detection                               │    │
│  │  • File upload validation                                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                        │                                             │
│                        ▼                                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  LAYER 5: LLM Request (OpenRouter)                          │    │
│  │  • Token counting (input)                                   │    │
│  │  • Streaming response                                       │    │
│  │  • Token counting (output)                                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                        │                                             │
│                        ▼                                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  LAYER 6: Usage Recording (Convex)                          │    │
│  │  • Update user daily count                                  │    │
│  │  • Update school pool balance                               │    │
│  │  • Record token usage                                       │    │
│  │  • Log for analytics/billing                                │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Protection Layers

### Layer 1: Edge Rate Limiting (Upstash Redis)

Fast rejection at the edge before requests hit your backend.

**Why Upstash?**

- HTTP-based (works in edge/serverless)
- < 2ms latency globally
- No connection management
- Built-in sliding window algorithm

**File: `src/lib/rate-limit.ts`**

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// System-wide protection (prevents total API abuse)
export const systemRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1000, "1 m"), // 1000 req/min global
  prefix: "ai-tutor:system",
  analytics: true, // Enable analytics in Upstash dashboard
});

// Per-IP limit (unauthenticated abuse prevention)
export const ipRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"), // 30 req/min per IP
  prefix: "ai-tutor:ip",
});

// Per-user RPM factory (authenticated users, configurable per plan)
export const createUserRateLimit = (rpm: number) =>
  new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(rpm, "1 m"),
    prefix: "ai-tutor:user",
  });

// Check rate limit and return result
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}
```

**File: `src/middleware.ts`**

```typescript
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ipRateLimit, systemRateLimit } from "@/lib/rate-limit";

export default clerkMiddleware(async (auth, req) => {
  // Only rate limit chat API routes
  if (req.nextUrl.pathname.startsWith("/api/chat")) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";

    // System limit check (global protection)
    const systemResult = await systemRateLimit.limit("global");
    if (!systemResult.success) {
      return NextResponse.json(
        {
          error: "Систем завгүй байна. Түр хүлээнэ үү.",
          reason: "system_busy",
        },
        { status: 503 }
      );
    }

    // IP limit check (per-IP protection)
    const ipResult = await ipRateLimit.limit(ip);
    if (!ipResult.success) {
      return NextResponse.json(
        {
          error: "Хэт олон хүсэлт илгээлээ. Түр хүлээнэ үү.",
          reason: "ip_rate_exceeded",
          retryAfter: Math.ceil((ipResult.reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((ipResult.reset - Date.now()) / 1000)
            ),
          },
        }
      );
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
```

### Layer 2: Authentication (Clerk)

All chat requests must be authenticated.

```typescript
// In API route
import { auth } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return Response.json(
      { error: "Нэвтрэх шаардлагатай.", reason: "unauthorized" },
      { status: 401 }
    );
  }

  // Continue with authenticated user...
}
```

### Layer 3: Quota Check (Convex)

**File: `convex/chat.ts`**

```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Plan-based limits configuration
const PLAN_LIMITS = {
  basic: {
    student: { dailyMessages: 30, rpm: 5 },
    teacher: { dailyMessages: 100, rpm: 10 },
    admin: { dailyMessages: Infinity, rpm: 30 },
    monthlyTokens: 10000,
  },
  standard: {
    student: { dailyMessages: 100, rpm: 10 },
    teacher: { dailyMessages: 300, rpm: 15 },
    admin: { dailyMessages: Infinity, rpm: 30 },
    monthlyTokens: 50000,
  },
  premium: {
    student: { dailyMessages: 300, rpm: 20 },
    teacher: { dailyMessages: 1000, rpm: 25 },
    admin: { dailyMessages: Infinity, rpm: 30 },
    monthlyTokens: 200000,
  },
} as const;

type Plan = keyof typeof PLAN_LIMITS;
type Role = "student" | "teacher" | "admin";

function getPlanLimits(plan: Plan, role: Role, customLimits?: any) {
  const baseLimits = PLAN_LIMITS[plan][role];
  return {
    dailyMessages:
      customLimits?.[`${role}DailyMessages`] ?? baseLimits.dailyMessages,
    rpm: customLimits?.[`${role}Rpm`] ?? baseLimits.rpm,
  };
}

function getNextMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(16, 0, 0, 0); // UTC+8 midnight = 16:00 UTC
  if (midnight <= now) {
    midnight.setDate(midnight.getDate() + 1);
  }
  return midnight.getTime();
}

// Check if user can send a message
export const checkQuota = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);

    // Check if user exists and is not blocked
    if (!user) {
      return { allowed: false, reason: "user_not_found" };
    }
    if (user.isBlocked) {
      return { allowed: false, reason: "blocked" };
    }

    // Check school subscription
    if (!user.schoolId) {
      return { allowed: false, reason: "no_school" };
    }

    const school = await ctx.db.get(user.schoolId);
    if (!school) {
      return { allowed: false, reason: "school_not_found" };
    }
    if (!school.isActive) {
      return { allowed: false, reason: "subscription_inactive" };
    }
    if (school.subscriptionEnd < Date.now()) {
      return { allowed: false, reason: "subscription_expired" };
    }

    // Get plan limits
    const limits = getPlanLimits(
      school.plan as Plan,
      user.role as Role,
      school.customLimits
    );
    const userDailyLimit = user.customDailyLimit ?? limits.dailyMessages;
    const userRpm = user.customRpm ?? limits.rpm;

    // Check daily usage
    const today = new Date().toISOString().split("T")[0];
    const dailyUsage = await ctx.db
      .query("userDailyUsage")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).eq("date", today)
      )
      .first();

    const currentCount = dailyUsage?.messageCount ?? 0;

    if (userDailyLimit !== Infinity && currentCount >= userDailyLimit) {
      return {
        allowed: false,
        reason: "daily_limit",
        resetAt: getNextMidnight(),
        current: currentCount,
        limit: userDailyLimit,
      };
    }

    // Check school pool
    if (school.tokensUsedThisMonth >= school.monthlyTokenLimit) {
      return { allowed: false, reason: "school_pool_exhausted" };
    }

    return {
      allowed: true,
      remaining:
        userDailyLimit === Infinity ? Infinity : userDailyLimit - currentCount,
      rpm: userRpm,
      schoolId: school._id,
    };
  },
});

// Record usage after successful message
export const recordUsage = mutation({
  args: {
    userId: v.id("users"),
    schoolId: v.id("schools"),
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    responseTimeMs: v.number(),
  },
  handler: async (ctx, args) => {
    const totalTokens = args.inputTokens + args.outputTokens;
    const today = new Date().toISOString().split("T")[0];
    const now = Date.now();

    // Update or create daily usage record
    const existing = await ctx.db
      .query("userDailyUsage")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).eq("date", today)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        messageCount: existing.messageCount + 1,
        inputTokens: existing.inputTokens + args.inputTokens,
        outputTokens: existing.outputTokens + args.outputTokens,
        totalTokens: existing.totalTokens + totalTokens,
        lastMessageAt: now,
      });
    } else {
      await ctx.db.insert("userDailyUsage", {
        userId: args.userId,
        schoolId: args.schoolId,
        date: today,
        messageCount: 1,
        inputTokens: args.inputTokens,
        outputTokens: args.outputTokens,
        totalTokens: totalTokens,
        firstMessageAt: now,
        lastMessageAt: now,
      });
    }

    // Update school pool
    const school = await ctx.db.get(args.schoolId);
    if (school) {
      await ctx.db.patch(args.schoolId, {
        tokensUsedThisMonth: school.tokensUsedThisMonth + totalTokens,
      });
    }

    // Create detailed usage log
    await ctx.db.insert("usageLogs", {
      userId: args.userId,
      schoolId: args.schoolId,
      conversationId: args.conversationId,
      messageId: args.messageId,
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      totalTokens: totalTokens,
      estimatedCost: calculateCost(
        args.model,
        args.inputTokens,
        args.outputTokens
      ),
      responseTimeMs: args.responseTimeMs,
      createdAt: now,
    });
  },
});

// Helper: Calculate cost in USD cents
function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  // Prices per 1M tokens (as of 2025)
  const prices: Record<string, { input: number; output: number }> = {
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "claude-3-haiku": { input: 0.25, output: 1.25 },
    "deepseek-chat": { input: 0.14, output: 0.28 },
    "gemini-flash": { input: 0.075, output: 0.3 },
  };

  const modelPrices = prices[model] ?? { input: 0.5, output: 1.5 };
  const inputCost = (inputTokens / 1_000_000) * modelPrices.input;
  const outputCost = (outputTokens / 1_000_000) * modelPrices.output;

  return Math.round((inputCost + outputCost) * 100); // Convert to cents
}
```

### Layer 4: Input Validation

**File: `src/lib/validation.ts`**

```typescript
import { z } from "zod";

// Supported models
export const SUPPORTED_MODELS = [
  "gpt-4o-mini",
  "claude-3-haiku",
  "deepseek-chat",
  "gemini-flash",
] as const;

// Chat message validation schema
export const chatMessageSchema = z.object({
  content: z
    .string()
    .min(1, "Мессеж хоосон байж болохгүй")
    .max(4000, "Мессеж хэт урт байна (4000 тэмдэгтээс бага байх ёстой)")
    .refine((val) => !containsPromptInjection(val), {
      message: "Зөвшөөрөгдөөгүй агуулга байна",
    }),
  conversationId: z.string().optional(),
  model: z.enum(SUPPORTED_MODELS).default("gpt-4o-mini"),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

// Prompt injection detection patterns
const INJECTION_PATTERNS = [
  // Direct instruction overrides
  /ignore (all )?(previous|above|prior) instructions/i,
  /disregard (all )?(previous|above|prior)/i,
  /forget (all )?(previous|above|prior)/i,

  // Role manipulation
  /you are now/i,
  /act as/i,
  /pretend (to be|you are)/i,
  /roleplay as/i,

  // System prompt extraction
  /what (is|are) your (system |initial )?instructions/i,
  /show me your (system )?prompt/i,
  /repeat your (system )?prompt/i,
  /print your (system )?instructions/i,

  // Instruction injection markers
  /new instructions:/i,
  /system prompt:/i,
  /\[INST\]/i,
  /\[SYSTEM\]/i,
  /<\|im_start\|>/i,
  /<\|system\|>/i,

  // Jailbreak attempts
  /DAN mode/i,
  /developer mode/i,
  /unrestricted mode/i,
];

function containsPromptInjection(text: string): boolean {
  const normalizedText = text.toLowerCase().replace(/\s+/g, " ");
  return INJECTION_PATTERNS.some((pattern) => pattern.test(normalizedText));
}

// Sanitize content for safe storage and display
export function sanitizeMessage(content: string): string {
  return content
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&(?!(lt|gt|amp|quot|apos);)/g, "&amp;")
    .trim();
}

// Validate and sanitize in one step
export function validateAndSanitize(
  input: unknown
):
  | { success: true; data: ChatMessageInput }
  | { success: false; error: z.ZodError } {
  const result = chatMessageSchema.safeParse(input);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: {
      ...result.data,
      content: sanitizeMessage(result.data.content),
    },
  };
}
```

### Layer 5 & 6: LLM Request + Usage Recording

**File: `src/app/api/chat/route.ts`**

```typescript
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createUserRateLimit } from "@/lib/rate-limit";
import { validateAndSanitize, SUPPORTED_MODELS } from "@/lib/validation";
import { countTokens } from "@/lib/tokenizer";
import { getErrorMessage } from "@/lib/error-messages";
import * as Sentry from "@sentry/nextjs";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// OpenRouter model mapping
const MODEL_MAP: Record<string, string> = {
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "claude-3-haiku": "anthropic/claude-3-haiku",
  "deepseek-chat": "deepseek/deepseek-chat",
  "gemini-flash": "google/gemini-flash-1.5",
};

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    // ═══════════════════════════════════════════════════════════
    // LAYER 2: Authentication Check
    // ═══════════════════════════════════════════════════════════
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return Response.json(
        { error: getErrorMessage("unauthorized"), reason: "unauthorized" },
        { status: 401 }
      );
    }

    // Get user from Convex
    const user = await convex.query(api.users.getByClerkId, { clerkId });
    if (!user) {
      return Response.json(
        { error: getErrorMessage("user_not_found"), reason: "user_not_found" },
        { status: 404 }
      );
    }

    // ═══════════════════════════════════════════════════════════
    // LAYER 3: Quota Check
    // ═══════════════════════════════════════════════════════════
    const quota = await convex.query(api.chat.checkQuota, { userId: user._id });

    if (!quota.allowed) {
      // Log violation if it's a limit issue
      if (
        quota.reason === "daily_limit" ||
        quota.reason === "school_pool_exhausted"
      ) {
        await convex.mutation(api.security.logViolation, {
          userId: user._id,
          ip: req.headers.get("x-forwarded-for") ?? "unknown",
          type: quota.reason === "daily_limit" ? "daily" : "pool",
          endpoint: "/api/chat",
        });
      }

      return Response.json(
        {
          error: getErrorMessage(quota.reason),
          reason: quota.reason,
          resetAt: quota.resetAt,
          current: quota.current,
          limit: quota.limit,
        },
        { status: 429 }
      );
    }

    // Per-user RPM check (Upstash)
    const userRateLimit = createUserRateLimit(quota.rpm);
    const rpmResult = await userRateLimit.limit(user._id);

    if (!rpmResult.success) {
      await convex.mutation(api.security.logViolation, {
        userId: user._id,
        ip: req.headers.get("x-forwarded-for") ?? "unknown",
        type: "rpm",
        endpoint: "/api/chat",
      });

      return Response.json(
        {
          error: getErrorMessage("rpm_exceeded"),
          reason: "rpm_exceeded",
          retryAfter: Math.ceil((rpmResult.reset - Date.now()) / 1000),
        },
        { status: 429 }
      );
    }

    // ═══════════════════════════════════════════════════════════
    // LAYER 4: Input Validation
    // ═══════════════════════════════════════════════════════════
    const body = await req.json();
    const validation = validateAndSanitize(body);

    if (!validation.success) {
      return Response.json(
        {
          error: getErrorMessage("invalid_content"),
          reason: "validation_error",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { content, model, conversationId } = validation.data;

    // Count input tokens
    const inputTokens = countTokens(content);

    // ═══════════════════════════════════════════════════════════
    // LAYER 5: LLM Request
    // ═══════════════════════════════════════════════════════════

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      const newConv = await convex.mutation(api.conversations.create, {
        userId: user._id,
        title: content.slice(0, 50) + (content.length > 50 ? "..." : ""),
        model,
      });
      convId = newConv;
    }

    // Save user message
    const userMessage = await convex.mutation(api.messages.create, {
      conversationId: convId,
      role: "user",
      content,
    });

    // Call OpenRouter
    const openRouterResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            process.env.NEXT_PUBLIC_APP_URL ?? "https://ai-tutor.mn",
          "X-Title": "AI Tutor Mongolia",
        },
        body: JSON.stringify({
          model: MODEL_MAP[model],
          messages: [
            {
              role: "system",
              content:
                "Та Монголын сурагчдад зориулсан боловсролын AI туслах юм. Монгол хэлээр хариулна уу. Асуултанд товч, тодорхой хариулж, шаардлагатай бол жишээ өгнө үү.",
            },
            { role: "user", content },
          ],
          stream: true,
          max_tokens: 2048,
        }),
      }
    );

    if (!openRouterResponse.ok) {
      const error = await openRouterResponse.text();
      Sentry.captureMessage(`OpenRouter error: ${error}`, "error");
      return Response.json(
        { error: getErrorMessage("llm_error"), reason: "llm_error" },
        { status: 502 }
      );
    }

    // Stream response
    const reader = openRouterResponse.body?.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let fullResponse = "";
    let outputTokens = 0;

    const stream = new ReadableStream({
      async start(controller) {
        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk
              .split("\n")
              .filter((line) => line.trim() !== "");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    fullResponse += content;
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                    );
                  }
                } catch {
                  // Skip malformed JSON
                }
              }
            }
          }
        } finally {
          // Calculate output tokens
          outputTokens = countTokens(fullResponse);

          // Save assistant message
          const assistantMessage = await convex.mutation(api.messages.create, {
            conversationId: convId!,
            role: "assistant",
            content: fullResponse,
          });

          // ═══════════════════════════════════════════════════════════
          // LAYER 6: Record Usage
          // ═══════════════════════════════════════════════════════════
          await convex.mutation(api.chat.recordUsage, {
            userId: user._id,
            schoolId: quota.schoolId,
            conversationId: convId!,
            messageId: assistantMessage,
            model,
            inputTokens,
            outputTokens,
            responseTimeMs: Date.now() - startTime,
          });

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Chat API error:", error);

    return Response.json(
      { error: getErrorMessage("internal_error"), reason: "internal_error" },
      { status: 500 }
    );
  }
}
```

---

## Subscription Model

### Tier Configuration

| Feature       | Basic        | Standard     | Premium       |
| ------------- | ------------ | ------------ | ------------- |
| Price/Teacher | $5/mo        | $5/mo        | $5/mo         |
| Price/Student | $1/mo        | $1/mo        | $1/mo         |
| Student/day   | 30 messages  | 100 messages | 300 messages  |
| Teacher/day   | 100 messages | 300 messages | 1000 messages |
| Admin/day     | Unlimited    | Unlimited    | Unlimited     |
| School Pool   | 10K tok/mo   | 50K tok/mo   | 200K tok/mo   |
| RPM/user      | 5            | 10           | 20            |

### Hybrid Quota System

1. **School Pool**: Monthly token budget shared by all users in the school
2. **Per-User Daily Cap**: Prevents a single user from consuming the entire pool
3. **Role Multipliers**: Teachers automatically get higher limits than students
4. **RPM Limit**: Prevents rapid-fire requests regardless of remaining quota
5. **Custom Overrides**: Admin can set custom limits per-user or per-school

### Limit Exceeded Behavior

- **Hard block** with clear Mongolian error message
- Display remaining time until reset (daily resets at midnight UTC+8)
- Suggest contacting admin if more access needed

---

## Database Schema

### New Tables (Convex Schema Additions)

**File: `convex/schema.ts`**

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ═══════════════════════════════════════════════════════════════
  // SCHOOLS - Multi-tenancy root
  // ═══════════════════════════════════════════════════════════════
  schools: defineTable({
    name: v.string(),
    slug: v.string(), // Unique identifier (URL-safe)
    plan: v.union(
      v.literal("basic"),
      v.literal("standard"),
      v.literal("premium")
    ),
    billingCycle: v.union(
      v.literal("monthly"),
      v.literal("semester"),
      v.literal("yearly")
    ),
    subscriptionStart: v.number(),
    subscriptionEnd: v.number(),
    isActive: v.boolean(),

    // Pool limits (monthly)
    monthlyTokenLimit: v.number(),
    tokensUsedThisMonth: v.number(),
    poolResetDate: v.number(),

    // Custom overrides (optional)
    customLimits: v.optional(
      v.object({
        studentDailyMessages: v.optional(v.number()),
        teacherDailyMessages: v.optional(v.number()),
        studentRpm: v.optional(v.number()),
        teacherRpm: v.optional(v.number()),
      })
    ),

    // Metadata
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    address: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_isActive", ["isActive"]),

  // ═══════════════════════════════════════════════════════════════
  // USER DAILY USAGE - Per-user daily tracking
  // ═══════════════════════════════════════════════════════════════
  userDailyUsage: defineTable({
    userId: v.id("users"),
    schoolId: v.id("schools"),
    date: v.string(), // "2025-01-16" format (UTC+8)

    // Counts
    messageCount: v.number(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),

    // Timing
    firstMessageAt: v.number(),
    lastMessageAt: v.number(),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_school_date", ["schoolId", "date"]),

  // ═══════════════════════════════════════════════════════════════
  // USAGE LOGS - Detailed audit trail
  // ═══════════════════════════════════════════════════════════════
  usageLogs: defineTable({
    userId: v.id("users"),
    schoolId: v.id("schools"),
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),

    // LLM details
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    estimatedCost: v.number(), // In USD cents

    // Performance
    responseTimeMs: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_school", ["schoolId"])
    .index("by_date", ["createdAt"]),

  // ═══════════════════════════════════════════════════════════════
  // RATE LIMIT VIOLATIONS - Abuse monitoring
  // ═══════════════════════════════════════════════════════════════
  rateLimitViolations: defineTable({
    userId: v.optional(v.id("users")),
    ip: v.string(),
    type: v.union(
      v.literal("rpm"),
      v.literal("daily"),
      v.literal("pool"),
      v.literal("suspicious"),
      v.literal("ip_rate")
    ),
    endpoint: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_ip", ["ip"])
    .index("by_date", ["createdAt"])
    .index("by_type", ["type"]),

  // ═══════════════════════════════════════════════════════════════
  // USERS - Updated with school link
  // ═══════════════════════════════════════════════════════════════
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("teacher"),
      v.literal("student")
    ),
    schoolId: v.optional(v.id("schools")),
    avatarUrl: v.optional(v.string()),

    // Custom limits (admin can override per-user)
    customDailyLimit: v.optional(v.number()),
    customRpm: v.optional(v.number()),

    // Blocking
    isBlocked: v.optional(v.boolean()),
    blockedReason: v.optional(v.string()),
    blockedAt: v.optional(v.number()),

    createdAt: v.number(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_schoolId", ["schoolId"])
    .index("by_role", ["role"]),

  // ... existing tables (conversations, messages, etc.)
});
```

---

## Error Messages

**File: `src/lib/error-messages.ts`**

```typescript
// Mongolian error messages for all security scenarios
export const ERROR_MESSAGES: Record<string, string> = {
  // Authentication
  unauthorized: "Нэвтрэх шаардлагатай.",
  user_not_found: "Хэрэглэгч олдсонгүй.",

  // Blocking
  blocked: "Таны хаяг хаагдсан байна. Админтай холбогдоно уу.",

  // Subscription
  no_school: "Сургуульд бүртгэгдээгүй байна.",
  school_not_found: "Сургууль олдсонгүй.",
  subscription_inactive: "Сургуулийн бүртгэл идэвхгүй байна.",
  subscription_expired:
    "Сургуулийн бүртгэл дууссан байна. Админтай холбогдоно уу.",

  // Rate limits
  daily_limit: "Өнөөдрийн хязгаарт хүрлээ. Маргааш дахин оролдоно уу.",
  school_pool_exhausted:
    "Сургуулийн сарын хязгаарт хүрлээ. Админтай холбогдоно уу.",
  rpm_exceeded: "Хэт олон хүсэлт илгээлээ. Түр хүлээнэ үү.",
  ip_rate_exceeded: "Хэт олон хүсэлт илгээлээ. Түр хүлээнэ үү.",
  system_busy: "Систем завгүй байна. Түр хүлээнэ үү.",

  // Validation
  invalid_content: "Зөвшөөрөгдөөгүй агуулга байна.",
  message_too_long: "Мессеж хэт урт байна (4000 тэмдэгтээс бага байх ёстой).",
  validation_error: "Буруу өгөгдөл.",

  // LLM
  llm_error: "AI хариу өгөхөд алдаа гарлаа. Дахин оролдоно уу.",

  // Generic
  internal_error: "Алдаа гарлаа. Дахин оролдоно уу.",
};

export function getErrorMessage(reason: string): string {
  return ERROR_MESSAGES[reason] ?? ERROR_MESSAGES.internal_error;
}

// Format reset time for display
export function formatResetTime(resetAt: number): string {
  const now = Date.now();
  const diff = resetAt - now;

  if (diff <= 0) return "одоо";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours} цаг ${minutes} минутын дараа`;
  }
  return `${minutes} минутын дараа`;
}
```

---

## Admin Dashboard

### Usage Statistics Page

**File: `src/app/(dashboard)/admin/usage/page.tsx`**

```typescript
import { convexQuery } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { StatCard } from "@/components/dashboard/stat-card";
import { UsageChart } from "@/components/dashboard/usage-chart";
import { SchoolUsageTable } from "@/components/dashboard/school-usage-table";
import { TopUsersTable } from "@/components/dashboard/top-users-table";
import { ViolationsTable } from "@/components/dashboard/violations-table";

export default async function UsageDashboardPage() {
  const stats = await convexQuery(api.usage.getDashboardStats);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Хэрэглээний статистик</h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Өнөөдрийн мессеж"
          value={stats.todayMessages.toLocaleString()}
          icon="MessageSquare"
        />
        <StatCard
          title="Энэ сарын токен"
          value={formatTokens(stats.monthlyTokens)}
          icon="Coins"
        />
        <StatCard
          title="Идэвхтэй хэрэглэгч"
          value={stats.activeUsers.toLocaleString()}
          icon="Users"
        />
        <StatCard
          title="Тооцоолсон зардал"
          value={`$${(stats.estimatedCost / 100).toFixed(2)}`}
          icon="DollarSign"
        />
      </div>

      {/* Usage Chart */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">
          Сүүлийн 30 өдрийн хэрэглээ
        </h2>
        <UsageChart data={stats.dailyUsage} />
      </div>

      {/* School Usage */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Сургуулиар</h2>
        <SchoolUsageTable data={stats.schoolUsage} />
      </div>

      {/* Top Users */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Идэвхтэй хэрэглэгчид</h2>
        <TopUsersTable data={stats.topUsers} />
      </div>

      {/* Violations */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Сүүлийн зөрчлүүд</h2>
        <ViolationsTable data={stats.recentViolations} />
      </div>
    </div>
  );
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}
```

---

## Environment Setup

### Required Environment Variables

```env
# ═══════════════════════════════════════════════════════════════
# UPSTASH REDIS (Rate Limiting)
# ═══════════════════════════════════════════════════════════════
# Get from: https://console.upstash.com/redis
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# ═══════════════════════════════════════════════════════════════
# SENTRY (Error Tracking)
# ═══════════════════════════════════════════════════════════════
# Get from: https://sentry.io/settings/projects/xxx/keys/
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=sntrys_xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# ═══════════════════════════════════════════════════════════════
# EXISTING (from BUILD.md)
# ═══════════════════════════════════════════════════════════════
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_xxx
CLERK_SECRET_KEY=sk_xxx
CONVEX_DEPLOYMENT=dev:xxx
NEXT_PUBLIC_CONVEX_URL=https://xxx.convex.cloud
OPENROUTER_API_KEY=sk-or-xxx
```

### Dependencies to Install

```bash
# Security & Rate Limiting
bun add @upstash/ratelimit @upstash/redis

# Token Counting
bun add gpt-tokenizer

# Validation
bun add zod

# Already installed (from main setup)
# @clerk/nextjs, convex, @sentry/nextjs
```

---

## Testing Checklist

### Security Tests

- [ ] **System Rate Limit**: Send 1000+ requests in 1 minute → should get 503
- [ ] **IP Rate Limit**: Send 30+ requests from same IP in 1 minute → should get 429
- [ ] **User RPM Test**: Send requests faster than user's RPM limit → should get 429
- [ ] **Daily Limit Test**: Send messages until daily quota → should block with Mongolian error
- [ ] **Pool Exhaustion Test**: Drain school pool → all users should be blocked
- [ ] **Input Validation**: Send >4000 char message → should reject
- [ ] **Prompt Injection**: Send "ignore previous instructions" → should be rejected
- [ ] **Blocked User**: Set `isBlocked: true` → user cannot chat
- [ ] **Inactive School**: Set school `isActive: false` → users cannot chat
- [ ] **Expired Subscription**: Set `subscriptionEnd` to past → users cannot chat

### Usage Tracking Tests

- [ ] **Token Count Accuracy**: Compare counted tokens vs actual usage
- [ ] **Daily Usage Increment**: `messageCount` increases after each message
- [ ] **School Pool Update**: `tokensUsedThisMonth` increases correctly
- [ ] **Usage Logs Created**: Each message creates a `usageLogs` entry
- [ ] **Cost Calculation**: `estimatedCost` is calculated correctly

### Admin Dashboard Tests

- [ ] **Stats Load**: Dashboard shows correct totals on refresh
- [ ] **School Usage**: Each school shows correct token usage
- [ ] **Top Users**: Shows users with most messages today
- [ ] **Violations Display**: Rate limit violations appear in table
- [ ] **Daily Chart**: Shows last 30 days of usage

### Error Handling

- [ ] **Mongolian Errors**: All error messages display in Mongolian
- [ ] **Sentry Capture**: Errors appear in Sentry dashboard
- [ ] **Graceful Degradation**: If Redis down, app continues (with warning)
- [ ] **Reset Time Display**: Shows time until quota reset

---

## References

- [Convex Rate Limiter](https://stack.convex.dev/rate-limiting)
- [Upstash Next.js Rate Limiting](https://upstash.com/blog/nextjs-ratelimiting)
- [Claude API Rate Limits](https://docs.claude.com/en/api/rate-limits)
- [OpenAI Rate Limits Guide](https://platform.openai.com/docs/guides/rate-limits)
- [LLM Security Best Practices](https://codinhood.com/post/ultimate-guide-ai-api-rate-limiting)
- [OWASP LLM Top 10](https://www.brightdefense.com/resources/owasp-top-10-llm/)
