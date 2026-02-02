# Scalable Queue Architecture for 100k Peak Users

## Executive Summary

Build a serverless queue system to handle 100k concurrent users during peak hours for AI Tutor chat. Architecture uses **Upstash (Redis + QStash + Workflow)** integrated with existing **Next.js + Convex + OpenRouter** stack.

**Target**: Handle 100k users chatting simultaneously during peak hours (exam periods, class times)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI TUTOR SCALABLE ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────┐     ┌──────────────┐     ┌─────────────┐     ┌────────────┐ │
│   │  Users   │────▶│   Vercel     │────▶│   Upstash   │────▶│  Upstash   │ │
│   │ (100k)   │     │  Edge/API    │     │   Redis     │     │  QStash    │ │
│   └──────────┘     └──────────────┘     │  (Queue)    │     │  (Worker)  │ │
│        │                 │              └─────────────┘     └────────────┘ │
│        │                 │                    │                    │        │
│        ▼                 ▼                    ▼                    ▼        │
│   ┌──────────┐     ┌──────────────┐     ┌─────────────┐     ┌────────────┐ │
│   │  SSE     │◀────│   Stream     │◀────│   Redis     │◀────│ OpenRouter │ │
│   │ Client   │     │   Consumer   │     │  Streams    │     │    LLM     │ │
│   └──────────┘     └──────────────┘     └─────────────┘     └────────────┘ │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                         CONVEX (Persistence)                          │  │
│   │   • Chat History  • User Sessions  • Queue Status  • Analytics       │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Selection

| Component | Choice | Why |
|-----------|--------|-----|
| **Queue** | Upstash Redis | Serverless, scales to 0, HTTP-based (no connections) |
| **Worker** | Upstash QStash | Built-in LLM support, auto-retry, callbacks |
| **Durability** | Upstash Workflow | Survives timeouts, reconnects, crashes |
| **Streaming** | Redis Streams + Pub/Sub | Resumable streams, multi-client support |
| **Cache** | Upstash Redis | Cache common Q&A, reduce LLM costs 40-60% |
| **Rate Limit** | Upstash Rate Limiter | Per-user fair queuing |

### Why Upstash Over Alternatives?

| Feature | Upstash | BullMQ | Trigger.dev | AWS SQS |
|---------|---------|--------|-------------|---------|
| Serverless | ✅ True serverless | ❌ Needs Redis server | ✅ Managed | ✅ Managed |
| HTTP-based | ✅ No connections | ❌ TCP connections | ✅ HTTP | ❌ SDK required |
| LLM Support | ✅ Built-in | ❌ Manual | ✅ Built-in | ❌ Manual |
| Vercel Compatible | ✅ Perfect | ⚠️ Connection limits | ✅ Good | ⚠️ Cold starts |
| Cost at 100k | ~$200-500/mo | ~$100/mo + server | ~$30k/mo | ~$500/mo |
| Cold Start | None | N/A | None | ~100ms |

---

## Cost Estimates (100k Peak Users)

### Monthly Infrastructure Cost

| Service | Plan | Cost | Notes |
|---------|------|------|-------|
| **Upstash Redis** | Pay-as-you-go | ~$50-100 | Queue + cache + streams |
| **Upstash QStash** | Pay-as-you-go | ~$100-200 | $1 per 100k messages |
| **OpenRouter LLM** | Pay-per-token | ~$500-2000 | With caching saves 40-60% |
| **Vercel Pro** | Pro | $20 | Current plan |
| **Convex** | Pro | $25 | Current plan |
| **Total** | | **~$700-2,400/mo** | vs $30k+ without queue |

### Cost Comparison

| Scenario | Without Queue | With Queue | Savings |
|----------|--------------|------------|---------|
| Normal (5k users) | ~$500/mo | ~$300/mo | 40% |
| Peak (100k users) | ~$30,000/mo | ~$2,400/mo | 92% |

---

## Implementation Phases

### Phase 1: Foundation (Priority: Critical)
**Files to Create/Modify:**
- `lib/queue/redis-client.ts` - Upstash Redis client
- `lib/queue/rate-limiter.ts` - Per-user rate limiting
- `lib/queue/cache.ts` - Response caching

### Phase 2: Queue System (Priority: Critical)
**Files to Create/Modify:**
- `lib/queue/job-queue.ts` - Job queue management
- `lib/queue/stream-manager.ts` - Redis Streams for resumable LLM output
- `app/api/queue/route.ts` - Queue submission endpoint
- `app/api/queue/callback/route.ts` - QStash callback handler

### Phase 3: Worker Integration (Priority: High)
**Files to Create/Modify:**
- `lib/queue/llm-worker.ts` - LLM processing logic
- `lib/queue/workflow.ts` - Upstash Workflow for durability
- `app/api/stream/[sessionId]/route.ts` - SSE stream endpoint

### Phase 4: Client Integration (Priority: High)
**Files to Create/Modify:**
- `hooks/use-queue-chat.ts` - React hook for queued chat
- `components/chat/queue-status.tsx` - Queue position UI
- Update `components/chat/chat-container.tsx` - Integrate queue

### Phase 5: Caching & Optimization (Priority: Medium)
**Files to Create/Modify:**
- `lib/queue/response-cache.ts` - Semantic caching
- `lib/queue/analytics.ts` - Queue metrics
- `convex/queueAnalytics.ts` - Store analytics in Convex

---

## Detailed Implementation

### 1. Redis Client Setup

**File: `lib/queue/redis-client.ts`**
```typescript
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Connection test
export async function testConnection() {
  return await redis.ping();
}
```

### 2. Rate Limiter (Fair Queue per User)

**File: `lib/queue/rate-limiter.ts`**
```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis-client";

// Sliding window: 10 requests per minute per user
export const chatRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "ratelimit:chat",
  analytics: true,
});

// Check rate limit before queuing
export async function checkRateLimit(userId: string) {
  const { success, remaining, reset } = await chatRateLimiter.limit(userId);
  return {
    allowed: success,
    remaining,
    resetAt: new Date(reset),
    retryAfter: success ? 0 : Math.ceil((reset - Date.now()) / 1000)
  };
}
```

### 3. Job Queue with Priority

**File: `lib/queue/job-queue.ts`**
```typescript
import { redis } from "./redis-client";
import { nanoid } from "nanoid";

export interface ChatJob {
  id: string;
  userId: string;
  conversationId: string;
  messages: Array<{ role: string; content: string }>;
  model: string;
  textbookContext?: string;
  imageUrl?: string;
  priority: number; // 1=teacher/admin, 10=student
  createdAt: number;
  status: "pending" | "processing" | "completed" | "failed";
}

const QUEUE_KEY = "chat:queue";
const JOB_PREFIX = "chat:job:";

export async function enqueueJob(job: Omit<ChatJob, "id" | "createdAt" | "status">): Promise<string> {
  const id = nanoid();
  const fullJob: ChatJob = {
    ...job,
    id,
    createdAt: Date.now(),
    status: "pending",
  };

  // Store job data
  await redis.set(`${JOB_PREFIX}${id}`, JSON.stringify(fullJob), { ex: 3600 });

  // Add to sorted set (score = priority * 1e12 + timestamp for FIFO within priority)
  const score = job.priority * 1e12 + fullJob.createdAt;
  await redis.zadd(QUEUE_KEY, { score, member: id });

  return id;
}

export async function getQueuePosition(jobId: string): Promise<number> {
  const rank = await redis.zrank(QUEUE_KEY, jobId);
  return rank !== null ? rank + 1 : -1;
}

export async function getQueueLength(): Promise<number> {
  return await redis.zcard(QUEUE_KEY);
}

export async function getJobStatus(jobId: string): Promise<ChatJob | null> {
  const data = await redis.get(`${JOB_PREFIX}${jobId}`);
  return data ? JSON.parse(data as string) : null;
}
```

### 4. Stream Manager (Resumable LLM Output)

**File: `lib/queue/stream-manager.ts`**
```typescript
import { redis } from "./redis-client";

const STREAM_PREFIX = "llm:stream:";
const STREAM_TTL = 3600; // 1 hour

export async function writeChunk(sessionId: string, chunk: string): Promise<void> {
  const streamKey = `${STREAM_PREFIX}${sessionId}`;

  // Add to Redis Stream
  await redis.xadd(streamKey, "*", { chunk, timestamp: Date.now().toString() });

  // Publish for real-time subscribers
  await redis.publish(`${streamKey}:notify`, chunk);

  // Set TTL on first write
  await redis.expire(streamKey, STREAM_TTL);
}

export async function readStream(
  sessionId: string,
  lastId: string = "0"
): Promise<Array<{ id: string; chunk: string }>> {
  const streamKey = `${STREAM_PREFIX}${sessionId}`;

  const entries = await redis.xrange(streamKey, lastId, "+", 100);

  return entries.map((entry: any) => ({
    id: entry[0],
    chunk: entry[1].chunk,
  }));
}

export async function markStreamComplete(sessionId: string): Promise<void> {
  const streamKey = `${STREAM_PREFIX}${sessionId}`;
  await redis.xadd(streamKey, "*", { chunk: "[DONE]", timestamp: Date.now().toString() });
  await redis.publish(`${streamKey}:notify`, "[DONE]");
}
```

### 5. QStash Worker Integration

**File: `app/api/queue/callback/route.ts`**
```typescript
import { verifySignatureAppRouter } from "@upstash/qstash/dist/nextjs";
import { redis } from "@/lib/queue/redis-client";
import { writeChunk, markStreamComplete } from "@/lib/queue/stream-manager";

async function handler(request: Request) {
  const body = await request.json();
  const { jobId, sessionId, chunk, status, error } = body;

  if (status === "chunk") {
    // Write streaming chunk
    await writeChunk(sessionId, chunk);
  } else if (status === "complete") {
    // Mark stream as complete
    await markStreamComplete(sessionId);

    // Update job status
    await redis.set(`chat:job:${jobId}`, JSON.stringify({
      ...JSON.parse(await redis.get(`chat:job:${jobId}`) as string),
      status: "completed"
    }));

    // Remove from queue
    await redis.zrem("chat:queue", jobId);
  } else if (status === "error") {
    // Handle error
    await redis.set(`chat:job:${jobId}`, JSON.stringify({
      ...JSON.parse(await redis.get(`chat:job:${jobId}`) as string),
      status: "failed",
      error
    }));
  }

  return new Response("OK", { status: 200 });
}

export const POST = verifySignatureAppRouter(handler);
```

### 6. Queue Submission Endpoint

**File: `app/api/queue/route.ts`**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Client } from "@upstash/qstash";
import { checkRateLimit } from "@/lib/queue/rate-limiter";
import { enqueueJob, getQueuePosition, getQueueLength } from "@/lib/queue/job-queue";

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check rate limit
  const rateLimit = await checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return NextResponse.json({
      error: "Rate limited",
      retryAfter: rateLimit.retryAfter,
      message: "Түр хүлээнэ үү..." // "Please wait..."
    }, { status: 429 });
  }

  const body = await request.json();
  const { messages, model, conversationId, textbookContext, imageUrl, userRole } = body;

  // Determine priority (teachers/admins get priority)
  const priority = userRole === "admin" || userRole === "teacher" ? 1 : 10;

  // Enqueue job
  const jobId = await enqueueJob({
    userId,
    conversationId,
    messages,
    model,
    textbookContext,
    imageUrl,
    priority,
  });

  // Get queue info
  const position = await getQueuePosition(jobId);
  const queueLength = await getQueueLength();

  // If queue is small, process immediately via QStash
  if (queueLength < 100) {
    await qstash.publishJSON({
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/llm/process`,
      body: { jobId },
      retries: 3,
      callback: `${process.env.NEXT_PUBLIC_APP_URL}/api/queue/callback`,
    });
  }

  return NextResponse.json({
    jobId,
    sessionId: jobId, // Use jobId as sessionId for streaming
    position,
    queueLength,
    estimatedWait: Math.ceil(position / 50), // ~50 jobs per minute
  });
}
```

### 7. SSE Stream Endpoint (Client Consumption)

**File: `app/api/stream/[sessionId]/route.ts`**
```typescript
import { NextRequest } from "next/server";
import { redis } from "@/lib/queue/redis-client";
import { readStream } from "@/lib/queue/stream-manager";

export const runtime = "edge";

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;
  const lastId = request.nextUrl.searchParams.get("lastId") || "0";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let currentLastId = lastId;
      let done = false;

      while (!done) {
        const chunks = await readStream(sessionId, currentLastId);

        for (const { id, chunk } of chunks) {
          if (chunk === "[DONE]") {
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            done = true;
            break;
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk, id })}\n\n`));
          currentLastId = id;
        }

        if (!done && chunks.length === 0) {
          // Wait for new chunks (polling with 100ms interval)
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
```

### 8. React Hook for Queued Chat

**File: `hooks/use-queue-chat.ts`**
```typescript
"use client";

import { useState, useCallback, useRef } from "react";

interface QueueStatus {
  jobId: string | null;
  position: number;
  queueLength: number;
  estimatedWait: number;
  status: "idle" | "queued" | "processing" | "streaming" | "complete" | "error";
}

export function useQueueChat() {
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    jobId: null,
    position: 0,
    queueLength: 0,
    estimatedWait: 0,
    status: "idle",
  });
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (
    messages: Array<{ role: string; content: string }>,
    model: string,
    conversationId: string,
    textbookContext?: string,
    imageUrl?: string,
    userRole?: string
  ) => {
    setError(null);
    setStreamingContent("");
    setQueueStatus(prev => ({ ...prev, status: "queued" }));

    try {
      // Submit to queue
      const response = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          model,
          conversationId,
          textbookContext,
          imageUrl,
          userRole,
        }),
      });

      if (response.status === 429) {
        const data = await response.json();
        setError(data.message);
        setQueueStatus(prev => ({ ...prev, status: "error" }));
        return null;
      }

      const { jobId, sessionId, position, queueLength, estimatedWait } = await response.json();

      setQueueStatus({
        jobId,
        position,
        queueLength,
        estimatedWait,
        status: "queued",
      });

      // Start listening to stream
      setQueueStatus(prev => ({ ...prev, status: "streaming" }));

      abortControllerRef.current = new AbortController();

      const streamResponse = await fetch(`/api/stream/${sessionId}`, {
        signal: abortControllerRef.current.signal,
      });

      const reader = streamResponse.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              setQueueStatus(prev => ({ ...prev, status: "complete" }));
              return fullContent;
            }

            try {
              const { chunk } = JSON.parse(data);
              fullContent += chunk;
              setStreamingContent(fullContent);
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      return fullContent;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return null;
      }
      setError("Алдаа гарлаа. Дахин оролдоно уу."); // "Error occurred. Please try again."
      setQueueStatus(prev => ({ ...prev, status: "error" }));
      return null;
    }
  }, []);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setQueueStatus(prev => ({ ...prev, status: "idle" }));
    setStreamingContent("");
  }, []);

  return {
    sendMessage,
    cancel,
    queueStatus,
    streamingContent,
    error,
    isQueued: queueStatus.status === "queued",
    isStreaming: queueStatus.status === "streaming",
    isComplete: queueStatus.status === "complete",
  };
}
```

### 9. Queue Status UI Component

**File: `components/chat/queue-status.tsx`**
```typescript
"use client";

import { useTranslations } from "next-intl";

interface QueueStatusProps {
  position: number;
  estimatedWait: number;
  onCancel: () => void;
}

export function QueueStatus({ position, estimatedWait, onCancel }: QueueStatusProps) {
  const t = useTranslations("chat");

  return (
    <div className="flex items-center gap-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-800">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-blue-900 dark:text-blue-100">
          {t("queuePosition", { position })}
        </p>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          {t("estimatedWait", { minutes: estimatedWait })}
        </p>
      </div>
      <button
        onClick={onCancel}
        className="rounded-md px-3 py-1 text-sm text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-800"
      >
        {t("cancel")}
      </button>
    </div>
  );
}
```

### 10. Response Cache (40-60% Cost Savings)

**File: `lib/queue/response-cache.ts`**
```typescript
import { redis } from "./redis-client";
import crypto from "crypto";

const CACHE_PREFIX = "cache:response:";
const CACHE_TTL = 86400; // 24 hours

function hashQuery(messages: Array<{ role: string; content: string }>, textbookId?: string): string {
  const content = JSON.stringify({ messages, textbookId });
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export async function getCachedResponse(
  messages: Array<{ role: string; content: string }>,
  textbookId?: string
): Promise<string | null> {
  const hash = hashQuery(messages, textbookId);
  return await redis.get(`${CACHE_PREFIX}${hash}`);
}

export async function setCachedResponse(
  messages: Array<{ role: string; content: string }>,
  response: string,
  textbookId?: string
): Promise<void> {
  const hash = hashQuery(messages, textbookId);
  await redis.set(`${CACHE_PREFIX}${hash}`, response, { ex: CACHE_TTL });
}
```

---

## Environment Variables

Add to `.env.local`:
```bash
# Upstash Redis
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Upstash QStash
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=xxx
QSTASH_CURRENT_SIGNING_KEY=xxx
QSTASH_NEXT_SIGNING_KEY=xxx
```

---

## Translations to Add

**`messages/en.json`:**
```json
{
  "chat": {
    "queuePosition": "Position in queue: #{position}",
    "estimatedWait": "Estimated wait: ~{minutes} minute(s)",
    "cancel": "Cancel",
    "rateLimited": "Too many requests. Please wait {seconds} seconds.",
    "queueFull": "System is busy. Please try again later."
  }
}
```

**`messages/mn.json`:**
```json
{
  "chat": {
    "queuePosition": "Дараалалд: #{position}",
    "estimatedWait": "Хүлээх хугацаа: ~{minutes} минут",
    "cancel": "Цуцлах",
    "rateLimited": "Хэт олон хүсэлт. {seconds} секунд хүлээнэ үү.",
    "queueFull": "Систем завгүй байна. Түр хүлээгээд дахин оролдоно уу."
  }
}
```

---

## Files to Create/Modify Summary

### New Files (Create)
1. `lib/queue/redis-client.ts` - Redis client
2. `lib/queue/rate-limiter.ts` - Rate limiting
3. `lib/queue/job-queue.ts` - Job queue management
4. `lib/queue/stream-manager.ts` - Resumable streams
5. `lib/queue/response-cache.ts` - Response caching
6. `app/api/queue/route.ts` - Queue submission
7. `app/api/queue/callback/route.ts` - QStash callback
8. `app/api/stream/[sessionId]/route.ts` - SSE stream
9. `app/api/llm/process/route.ts` - LLM processing worker
10. `hooks/use-queue-chat.ts` - React hook
11. `components/chat/queue-status.tsx` - Queue UI

### Existing Files (Modify)
1. `components/chat/chat-container.tsx` - Integrate queue hook
2. `components/chat/chat-input.tsx` - Show queue status
3. `messages/en.json` - Add translations
4. `messages/mn.json` - Add translations
5. `.env.local` - Add Upstash credentials

---

## Verification Steps

1. **Setup Upstash accounts:**
   - Create Redis database at upstash.com
   - Create QStash instance at upstash.com
   - Get all credentials

2. **Test rate limiting:**
   ```bash
   # Should allow first 10 requests, then 429
   for i in {1..15}; do curl -X POST /api/queue; done
   ```

3. **Test queue positioning:**
   - Open 5 browser tabs
   - Send messages simultaneously
   - Verify queue positions shown correctly

4. **Test stream resumption:**
   - Start a chat
   - Refresh page mid-stream
   - Verify stream resumes from last position

5. **Load test (before peak):**
   ```bash
   # Use k6 or similar
   k6 run --vus 100 --duration 30s load-test.js
   ```

6. **Build verification:**
   ```bash
   bun run build
   ```

---

## Scaling Roadmap

| Users | Infrastructure | Monthly Cost |
|-------|---------------|--------------|
| 1-5k | Current + Upstash Free | ~$50 |
| 5-20k | Upstash Pay-as-you-go | ~$200-500 |
| 20-50k | Upstash Fixed plans | ~$500-1000 |
| 50-100k | Upstash Fixed + Multiple OpenRouter keys | ~$1500-2500 |
| 100k+ | Enterprise plans + Multi-region | Custom |

---

## Graceful Degradation Strategy

When system is overloaded:

1. **Queue > 1000**: Show "Processing..." (no queue position)
2. **Queue > 5000**: Enable "simple mode" (shorter responses)
3. **Queue > 10000**: Show "system busy" message, offer email notification
4. **Rate limit hit**: Show countdown timer

This ensures users always get feedback, never a broken experience.

---

## User Preferences (Confirmed)

Based on user input:

1. **Teacher/Admin Priority**: **Bypass queue entirely**
   - Teachers and admins skip the queue completely
   - Direct LLM call without going through queue system
   - Ensures educators always have instant access

2. **Queue UI**: **Never show position**
   - Show only "Processing..." indicator
   - No queue position or estimated wait time displayed
   - Cleaner UX, less anxiety for users

3. **Reconnection**: **Auto-resume stream**
   - Save session ID in localStorage
   - On page refresh/reconnect, resume from last chunk
   - No lost responses, seamless experience

---

## Implementation Adjustments Based on Preferences

### Teacher/Admin Bypass Logic

**File: `app/api/queue/route.ts`** - Add bypass check:
```typescript
// Teachers/admins bypass queue entirely
if (userRole === "admin" || userRole === "teacher") {
  // Direct LLM call without queue
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, model, textbookContext, imageUrl }),
  });

  return response; // Stream directly
}

// Students go through queue
const jobId = await enqueueJob({ ... });
```

### Simplified Queue Status UI

**File: `components/chat/queue-status.tsx`** - Simplified:
```typescript
export function QueueStatus({ onCancel }: { onCancel: () => void }) {
  const t = useTranslations("chat");

  return (
    <div className="flex items-center gap-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      <p className="text-blue-900 dark:text-blue-100">
        {t("processing")} {/* "Боловсруулж байна..." */}
      </p>
      <button onClick={onCancel} className="ml-auto text-sm text-blue-600">
        {t("cancel")}
      </button>
    </div>
  );
}
```

### Auto-Resume with localStorage

**File: `hooks/use-queue-chat.ts`** - Add session persistence:
```typescript
// On mount, check for existing session
useEffect(() => {
  const savedSession = localStorage.getItem("chat:session");
  if (savedSession) {
    const { sessionId, lastChunkId } = JSON.parse(savedSession);
    // Resume stream from last position
    resumeStream(sessionId, lastChunkId);
  }
}, []);

// Save progress as chunks arrive
const saveProgress = (sessionId: string, lastChunkId: string) => {
  localStorage.setItem("chat:session", JSON.stringify({ sessionId, lastChunkId }));
};

// Clear on completion
const clearSession = () => {
  localStorage.removeItem("chat:session");
};
```

---

## Updated Translations

**`messages/mn.json`:**
```json
{
  "chat": {
    "processing": "Боловсруулж байна...",
    "cancel": "Цуцлах",
    "rateLimited": "Хэт олон хүсэлт. {seconds} секунд хүлээнэ үү.",
    "systemBusy": "Систем завгүй байна. Түр хүлээгээд дахин оролдоно уу."
  }
}
```

**`messages/en.json`:**
```json
{
  "chat": {
    "processing": "Processing...",
    "cancel": "Cancel",
    "rateLimited": "Too many requests. Please wait {seconds} seconds.",
    "systemBusy": "System is busy. Please try again later."
  }
}
```

