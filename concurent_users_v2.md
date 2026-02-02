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

| Component      | Choice                  | Why                                                  |
| -------------- | ----------------------- | ---------------------------------------------------- |
| **Queue**      | Upstash Redis           | Serverless, scales to 0, HTTP-based (no connections) |
| **Worker**     | Upstash QStash          | Built-in LLM support, auto-retry, callbacks          |
| **Durability** | Upstash Workflow        | Survives timeouts, reconnects, crashes               |
| **Streaming**  | Redis Streams + Pub/Sub | Resumable streams, multi-client support              |
| **Cache**      | Upstash Redis           | Cache common Q&A, reduce LLM costs 40-60%            |
| **Rate Limit** | Upstash Rate Limiter    | Per-user fair queuing                                |

### Why Upstash Over Alternatives?

| Feature           | Upstash            | BullMQ                | Trigger.dev | AWS SQS         |
| ----------------- | ------------------ | --------------------- | ----------- | --------------- |
| Serverless        | ✅ True serverless | ❌ Needs Redis server | ✅ Managed  | ✅ Managed      |
| HTTP-based        | ✅ No connections  | ❌ TCP connections    | ✅ HTTP     | ❌ SDK required |
| LLM Support       | ✅ Built-in        | ❌ Manual             | ✅ Built-in | ❌ Manual       |
| Vercel Compatible | ✅ Perfect         | ⚠️ Connection limits  | ✅ Good     | ⚠️ Cold starts  |
| Cost at 100k      | ~$200-500/mo       | ~$100/mo + server     | ~$30k/mo    | ~$500/mo        |
| Cold Start        | None               | N/A                   | None        | ~100ms          |

---

## Cost Estimates (100k Peak Users)

### Monthly Infrastructure Cost

| Service            | Plan          | Cost               | Notes                     |
| ------------------ | ------------- | ------------------ | ------------------------- |
| **Upstash Redis**  | Pay-as-you-go | ~$50-100           | Queue + cache + streams   |
| **Upstash QStash** | Pay-as-you-go | ~$100-200          | $1 per 100k messages      |
| **OpenRouter LLM** | Pay-per-token | ~$500-2000         | With caching saves 40-60% |
| **Vercel Pro**     | Pro           | $20                | Current plan              |
| **Convex**         | Pro           | $25                | Current plan              |
| **Total**          |               | **~$700-2,400/mo** | vs $30k+ without queue    |

### Cost Comparison

| Scenario          | Without Queue | With Queue | Savings |
| ----------------- | ------------- | ---------- | ------- |
| Normal (5k users) | ~$500/mo      | ~$300/mo   | 40%     |
| Peak (100k users) | ~$30,000/mo   | ~$2,400/mo | 92%     |

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
    retryAfter: success ? 0 : Math.ceil((reset - Date.now()) / 1000),
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

export async function enqueueJob(
  job: Omit<ChatJob, "id" | "createdAt" | "status">
): Promise<string> {
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

export async function writeChunk(
  sessionId: string,
  chunk: string
): Promise<void> {
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
  await redis.xadd(streamKey, "*", {
    chunk: "[DONE]",
    timestamp: Date.now().toString(),
  });
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
    await redis.set(
      `chat:job:${jobId}`,
      JSON.stringify({
        ...JSON.parse((await redis.get(`chat:job:${jobId}`)) as string),
        status: "completed",
      })
    );

    // Remove from queue
    await redis.zrem("chat:queue", jobId);
  } else if (status === "error") {
    // Handle error
    await redis.set(
      `chat:job:${jobId}`,
      JSON.stringify({
        ...JSON.parse((await redis.get(`chat:job:${jobId}`)) as string),
        status: "failed",
        error,
      })
    );
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
import {
  enqueueJob,
  getQueuePosition,
  getQueueLength,
} from "@/lib/queue/job-queue";

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check rate limit
  const rateLimit = await checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Rate limited",
        retryAfter: rateLimit.retryAfter,
        message: "Түр хүлээнэ үү...", // "Please wait..."
      },
      { status: 429 }
    );
  }

  const body = await request.json();
  const {
    messages,
    model,
    conversationId,
    textbookContext,
    imageUrl,
    userRole,
  } = body;

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

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ chunk, id })}\n\n`)
          );
          currentLastId = id;
        }

        if (!done && chunks.length === 0) {
          // Wait for new chunks (polling with 100ms interval)
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
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

  const sendMessage = useCallback(
    async (
      messages: Array<{ role: string; content: string }>,
      model: string,
      conversationId: string,
      textbookContext?: string,
      imageUrl?: string,
      userRole?: string
    ) => {
      setError(null);
      setStreamingContent("");
      setQueueStatus((prev) => ({ ...prev, status: "queued" }));

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
          setQueueStatus((prev) => ({ ...prev, status: "error" }));
          return null;
        }

        const { jobId, sessionId, position, queueLength, estimatedWait } =
          await response.json();

        setQueueStatus({
          jobId,
          position,
          queueLength,
          estimatedWait,
          status: "queued",
        });

        // Start listening to stream
        setQueueStatus((prev) => ({ ...prev, status: "streaming" }));

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
                setQueueStatus((prev) => ({ ...prev, status: "complete" }));
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
        setQueueStatus((prev) => ({ ...prev, status: "error" }));
        return null;
      }
    },
    []
  );

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setQueueStatus((prev) => ({ ...prev, status: "idle" }));
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

function hashQuery(
  messages: Array<{ role: string; content: string }>,
  textbookId?: string
): string {
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

| Users   | Infrastructure                           | Monthly Cost |
| ------- | ---------------------------------------- | ------------ |
| 1-5k    | Current + Upstash Free                   | ~$50         |
| 5-20k   | Upstash Pay-as-you-go                    | ~$200-500    |
| 20-50k  | Upstash Fixed plans                      | ~$500-1000   |
| 50-100k | Upstash Fixed + Multiple OpenRouter keys | ~$1500-2500  |
| 100k+   | Enterprise plans + Multi-region          | Custom       |

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
  localStorage.setItem(
    "chat:session",
    JSON.stringify({ sessionId, lastChunkId })
  );
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

---

# PART 2: Strategy for Millions of Daily Active Users

## Lessons from Theo's T3.Chat & Convex (June 2025 Outage)

Based on research from [Convex Postmortem](https://news.convex.dev/how-convex-took-down-t3-chat-june-1-2025-postmortem/):

### What Happened

- T3.Chat went from **50 queries/second → 20,000+ queries/second** during compaction events
- WebSocket connection layer collapsed under load
- Bad client reconnect logic created a **self-inflicted DDoS**
- Outage lasted ~6 hours, complete unavailability for ~3 hours
- Tens of thousands of users affected

### Root Causes (Apply to AI Tutor)

| Issue                   | T3.Chat Problem                                  | AI Tutor Prevention                            |
| ----------------------- | ------------------------------------------------ | ---------------------------------------------- |
| **Thundering Herd**     | All clients reconnected simultaneously           | Exponential backoff with jitter                |
| **Background Tabs**     | Users leave chat open, causing connection storms | Detect tab visibility, reduce polling          |
| **Search Indexing**     | Full-text search caused query invalidation       | Use dedicated search index (Algolia/Typesense) |
| **Client Backoff**      | Reset backoff on partial success                 | Only reset after full server readiness         |
| **Operational Tooling** | Manual tools didn't preserve resource configs    | Infrastructure-as-code, immutable deploys      |

### Key Lessons for AI Tutor

1. **Never trust reconnection patterns** - Implement server-side session buffering
2. **Background tabs are dangerous** - Detect inactive tabs, switch to polling
3. **Load test with real patterns** - Mirror actual user behavior (background tabs, search-heavy)
4. **Tooling must protect humans** - Automate safeguards, no manual overrides during incidents

---

## Complete Caching Strategy for LLM Apps

### 7 Layers of Caching (Implement All)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CACHING LAYER ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Layer 1: BROWSER CACHE                                              │
│  ├── Static assets (JS/CSS) - 1 year TTL                            │
│  ├── API responses - stale-while-revalidate                         │
│  └── localStorage for session persistence                            │
│                                                                      │
│  Layer 2: CDN/EDGE CACHE (Vercel)                                   │
│  ├── ISR for static pages - 60s revalidation                        │
│  ├── Edge caching for API routes                                    │
│  └── Geographic distribution                                         │
│                                                                      │
│  Layer 3: APPLICATION CACHE (Upstash Redis)                         │
│  ├── Session data - 30 min TTL                                      │
│  ├── User preferences - 24 hour TTL                                 │
│  └── Recent conversations - 1 hour TTL                              │
│                                                                      │
│  Layer 4: EXACT MATCH CACHE (Redis)                                 │
│  ├── Identical prompt → response lookup                             │
│  ├── SHA256 hash of (messages + context)                            │
│  └── 24 hour TTL, ~10-20% hit rate                                  │
│                                                                      │
│  Layer 5: SEMANTIC CACHE (Vector DB)                                │
│  ├── Similar meaning → cached response                              │
│  ├── Embedding similarity threshold 0.92+                           │
│  ├── 40-60% cost savings                                            │
│  └── 24 hour TTL                                                     │
│                                                                      │
│  Layer 6: PROMPT CACHE (LLM Provider)                               │
│  ├── Reuse processed prompt prefixes                                │
│  ├── System prompt + textbook context                               │
│  ├── Anthropic/OpenAI native support                                │
│  └── Up to 90% token savings on repeated context                    │
│                                                                      │
│  Layer 7: KV CACHE (LLM Inference)                                  │
│  ├── LMCache for chunk-level reuse                                  │
│  ├── Self-hosted only (vLLM, SGLang)                                │
│  └── Not applicable for API-based LLM                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Layer-by-Layer Implementation

#### Layer 1: Browser Cache

```typescript
// next.config.js
headers: () => [
  {
    source: "/_next/static/:path*",
    headers: [
      { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
    ],
  },
];
```

#### Layer 2: Edge/ISR Cache

```typescript
// For static dashboard pages
export const revalidate = 60; // ISR: regenerate every 60s

// For API responses
export const runtime = "edge";
return new Response(data, {
  headers: {
    "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
  },
});
```

#### Layer 4: Exact Match Cache

```typescript
// Already in plan: lib/queue/response-cache.ts
// Lookup flow:
// 1. Hash(messages + textbookId + model)
// 2. Redis GET → hit? Return cached response
// 3. Miss? Proceed to semantic cache
```

#### Layer 5: Semantic Cache (NEW)

```typescript
// lib/cache/semantic-cache.ts
import { Index } from "@upstash/vector";

const semanticIndex = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
});

export async function getSemanticallySimilar(
  queryEmbedding: number[],
  threshold: number = 0.92
): Promise<{ response: string; score: number } | null> {
  const results = await semanticIndex.query({
    vector: queryEmbedding,
    topK: 1,
    includeMetadata: true,
  });

  if (results.length > 0 && results[0].score >= threshold) {
    return {
      response: results[0].metadata?.response as string,
      score: results[0].score,
    };
  }
  return null;
}

export async function cacheSemanticResponse(
  queryEmbedding: number[],
  response: string,
  metadata: Record<string, any>
): Promise<void> {
  await semanticIndex.upsert({
    id: `cache_${Date.now()}`,
    vector: queryEmbedding,
    metadata: { response, ...metadata, cachedAt: Date.now() },
  });
}
```

#### Layer 6: Prompt Caching (Provider-Side)

```typescript
// OpenAI already caches repeated prompt prefixes automatically
// Anthropic requires explicit cache control
// Structure prompts for maximum cache reuse:

const systemPrompt = `
You are an AI Tutor for Mongolian K-12 students...
[STATIC SYSTEM INSTRUCTIONS - CACHED]
`;

const textbookContext = `
Chapter 5: Light Refraction (Гэрлийн хугарал)
[TEXTBOOK CONTENT - CACHED PER CHAPTER]
`;

const userQuery = `
[DYNAMIC USER MESSAGE - NOT CACHED]
`;
```

### Cache Hit Flow

```
User Query
    │
    ▼
┌─────────────────┐
│ 1. Exact Match  │ ──hit──▶ Return (0-5ms)
│    (Redis)      │
└────────┬────────┘
         │ miss
         ▼
┌─────────────────┐
│ 2. Semantic     │ ──hit──▶ Return (20-50ms)
│    (Vector)     │
└────────┬────────┘
         │ miss
         ▼
┌─────────────────┐
│ 3. Prompt Cache │ ──hit──▶ Reduced tokens (provider-side)
│    (LLM)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. Full LLM     │ ──────▶ Generate (1-5s)
│    Request      │
└─────────────────┘
         │
         ▼
    Cache response in Layer 4 & 5
```

### Expected Savings

| Cache Layer  | Hit Rate   | Latency Saved | Cost Saved         |
| ------------ | ---------- | ------------- | ------------------ |
| Exact Match  | 10-20%     | 1-5 seconds   | 100% (no LLM call) |
| Semantic     | 30-50%     | 1-5 seconds   | 100% (no LLM call) |
| Prompt       | 60-80%     | 0.5-1 second  | 50-90% tokens      |
| **Combined** | **70-90%** | **Avg 2-3s**  | **60-80%**         |

---

## Multi-Provider LLM Gateway Strategy

### Why Multi-Provider?

- **OpenRouter** can have rate limits based on account balance
- **Single provider outages** can take down your entire service
- **Cost optimization** - route to cheapest provider that meets quality

### Recommended Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    LLM GATEWAY ARCHITECTURE                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────┐     ┌─────────────────┐     ┌─────────────────┐   │
│   │ AI Tutor│────▶│  LiteLLM/Bifrost│────▶│ OpenRouter      │   │
│   │   App   │     │    Gateway      │     │ (Primary)       │   │
│   └─────────┘     └────────┬────────┘     └─────────────────┘   │
│                            │                                      │
│                            │ failover (50ms)                      │
│                            ▼                                      │
│                   ┌─────────────────┐     ┌─────────────────┐   │
│                   │ Fallback Chain  │────▶│ Google AI       │   │
│                   │                 │     │ (Fallback 1)    │   │
│                   │                 │     └─────────────────┘   │
│                   │                 │                            │
│                   │                 │────▶│ OpenAI Direct   │   │
│                   │                 │     │ (Fallback 2)    │   │
│                   └─────────────────┘     └─────────────────┘   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Provider Failover Chain

```typescript
// lib/llm/gateway.ts
const PROVIDERS = [
  { name: "openrouter", weight: 0.7, maxLatency: 5000 },
  { name: "google-ai", weight: 0.2, maxLatency: 3000 },
  { name: "openai", weight: 0.1, maxLatency: 4000 },
];

async function callWithFailover(messages: Message[], model: string) {
  for (const provider of PROVIDERS) {
    try {
      const response = await callProvider(provider.name, messages, model);
      if (response.ok) return response;
    } catch (error) {
      console.error(`Provider ${provider.name} failed, trying next...`);
      continue;
    }
  }
  throw new Error("All providers failed");
}
```

### Cost Comparison by Provider

| Provider     | GPT-4o-mini | Claude 3.5 Sonnet | Gemini Flash |
| ------------ | ----------- | ----------------- | ------------ |
| OpenRouter   | $0.15/1M in | $3/1M in          | $0.075/1M in |
| Direct       | $0.15/1M in | $3/1M in          | $0.075/1M in |
| **Best for** | Default     | Complex reasoning | High volume  |

---

## High-Level Strategy: Millions of DAU Without Downtime

### The "5 Nines" Target (99.999% Uptime)

| Component    | Strategy       | Redundancy                |
| ------------ | -------------- | ------------------------- |
| **Frontend** | Vercel Edge    | Global CDN, auto-failover |
| **Database** | Convex         | Built-in replication      |
| **Queue**    | Upstash        | Multi-region, serverless  |
| **LLM**      | Multi-provider | 3+ provider fallback      |
| **Cache**    | Upstash Redis  | Global replication        |

### Traffic Tiers & Handling

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRAFFIC TIER STRATEGY                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TIER 1: Normal (< 10k concurrent)                              │
│  ├── Direct LLM calls                                           │
│  ├── All caching layers active                                  │
│  └── Full feature set                                           │
│                                                                  │
│  TIER 2: High (10k - 50k concurrent)                            │
│  ├── Queue all student requests                                 │
│  ├── Teachers bypass queue                                      │
│  ├── Aggressive semantic caching                                │
│  └── Rate limit: 5 req/min per user                            │
│                                                                  │
│  TIER 3: Peak (50k - 100k concurrent)                           │
│  ├── All users through queue                                    │
│  ├── "Simple mode" - shorter responses                          │
│  ├── Cache hit requirement: 0.88 threshold                      │
│  └── Rate limit: 3 req/min per user                            │
│                                                                  │
│  TIER 4: Overload (> 100k concurrent)                           │
│  ├── New requests get "busy" message                            │
│  ├── Existing requests continue                                 │
│  ├── Email notification option                                  │
│  └── Admin dashboard shows real-time status                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Convex-Specific Optimizations

Based on [Convex Best Practices](https://docs.convex.dev/understanding/best-practices/):

```typescript
// 1. Avoid Date.now() in queries - invalidates cache
// BAD:
const messages = useQuery(api.messages.list, { after: Date.now() - 3600000 });

// GOOD: Round to minute
const roundedTime = Math.floor(Date.now() / 60000) * 60000;
const messages = useQuery(api.messages.list, { after: roundedTime });

// 2. Use Convex components for complex patterns
// Rate limiting, counters, leaderboards - use pre-built components

// 3. Background tab handling
useEffect(() => {
  const handleVisibility = () => {
    if (document.hidden) {
      // Pause real-time subscriptions
      convex.pause();
    } else {
      // Resume with backoff
      setTimeout(() => convex.resume(), 1000 + Math.random() * 2000);
    }
  };
  document.addEventListener("visibilitychange", handleVisibility);
  return () =>
    document.removeEventListener("visibilitychange", handleVisibility);
}, []);
```

### Monitoring & Alerting

```
┌─────────────────────────────────────────────────────────────────┐
│                    MONITORING STACK                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Application Metrics (Sentry)                                 │
│     ├── Error rates by endpoint                                 │
│     ├── Response times P50/P95/P99                              │
│     └── User-facing errors                                      │
│                                                                  │
│  2. Infrastructure Metrics (Vercel Analytics)                    │
│     ├── Edge function duration                                  │
│     ├── Cold starts                                             │
│     └── Geographic latency                                      │
│                                                                  │
│  3. Queue Metrics (Upstash Dashboard)                           │
│     ├── Queue depth                                             │
│     ├── Processing rate                                         │
│     └── Cache hit rates                                         │
│                                                                  │
│  4. LLM Metrics (Custom)                                        │
│     ├── Token usage by model                                    │
│     ├── Provider latency                                        │
│     └── Cost per conversation                                   │
│                                                                  │
│  5. Alerts (PagerDuty/Slack)                                    │
│     ├── Queue > 1000: Warning                                   │
│     ├── Queue > 5000: Critical                                  │
│     ├── Error rate > 1%: Warning                                │
│     └── Error rate > 5%: Critical                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Pre-Peak Checklist

Before expected high-traffic periods (exam weeks, class times):

1. **Infrastructure**
   - [ ] Upstash Redis scaled to Fixed plan
   - [ ] QStash message limit increased
   - [ ] OpenRouter balance > $500
   - [ ] Backup LLM provider credentials ready

2. **Caching**
   - [ ] Semantic cache warmed with common questions
   - [ ] Textbook embeddings pre-computed
   - [ ] CDN cache primed

3. **Monitoring**
   - [ ] Alert thresholds adjusted
   - [ ] On-call engineer assigned
   - [ ] Rollback plan documented

4. **Client**
   - [ ] Force update to latest client version
   - [ ] Background tab detection enabled
   - [ ] Graceful degradation UI tested

---

## Summary: The Complete Stack for Scale

| Component        | Technology                | Purpose                          |
| ---------------- | ------------------------- | -------------------------------- |
| **Frontend**     | Next.js 15 + Vercel Edge  | Global distribution, ISR         |
| **Auth**         | Clerk                     | Managed auth, role-based access  |
| **Database**     | Convex                    | Real-time sync, built-in scaling |
| **Queue**        | Upstash Redis             | Serverless job queue             |
| **Worker**       | Upstash QStash            | Durable LLM processing           |
| **Streaming**    | Redis Streams + SSE       | Resumable LLM output             |
| **Cache L1**     | Browser + Vercel CDN      | Static assets, ISR               |
| **Cache L2**     | Upstash Redis             | Session, exact match             |
| **Cache L3**     | Upstash Vector            | Semantic similarity              |
| **LLM Gateway**  | LiteLLM/Custom            | Multi-provider failover          |
| **Primary LLM**  | OpenRouter                | Cost-effective routing           |
| **Fallback LLM** | Google AI, OpenAI         | Redundancy                       |
| **Monitoring**   | Sentry + Vercel + PostHog | Full observability               |

**Total Monthly Cost at 100k Peak Users: ~$2,000-4,000**
(vs $30,000+ without these optimizations)

---

# PART 3: Education-Optimized Strategy for 1M Students

## Your Unique Advantage: Static Curriculum

Unlike general chatbots, AI Tutor has **massive caching potential**:

| Factor      | Your Situation                            | Impact                   |
| ----------- | ----------------------------------------- | ------------------------ |
| **Content** | Static K-12 PDFs (math, physics, biology) | Pre-generate all answers |
| **Users**   | 100 schools, same curriculum              | Same questions asked     |
| **Source**  | ~50-100 textbook chapters total           | Finite question space    |
| **Pattern** | Exam prep, homework (predictable)         | Cache warm before peak   |
| **Scale**   | 1M students in Mongolia                   | Extreme cache reuse      |

### Expected Cache Hit Rates

| Scenario       | General Chatbot | AI Tutor (Education) |
| -------------- | --------------- | -------------------- |
| Exact Match    | 10-20%          | **30-50%**           |
| Semantic Match | 30-50%          | **70-90%**           |
| Combined       | 40-70%          | **85-95%**           |

**Result**: With 90% cache hits, only 10% of requests need LLM calls.

- 100k concurrent users → only 10k LLM calls
- Cost reduction: **90%**

---

## Cache Warming Strategy: Pre-Generate Everything

### Phase 1: Question Generation (One-Time Setup)

For each textbook chapter, generate predicted questions:

```typescript
// scripts/generate-questions.ts
import { openai } from "@ai-sdk/openai";

async function generateQuestionsForChapter(
  chapterText: string,
  metadata: {
    subject: string;
    grade: number;
    chapter: string;
  }
) {
  const prompt = `
You are analyzing a ${metadata.subject} textbook chapter for grade ${metadata.grade}.
Chapter: ${metadata.chapter}

Generate 50 likely student questions about this content, including:
- Definition questions ("Гэрлийн хугарал гэж юу вэ?")
- Explanation questions ("Яагаад гэрэл усанд орохдоо хугардаг вэ?")
- Formula questions ("Хугаралын томъёог бичнэ үү")
- Example questions ("Жишээ бодлого харуулна уу")
- Comparison questions ("Ойлголт ба тусгалын ялгаа юу вэ?")
- Application questions ("Энэ хуулийг хэрхэн ашигладаг вэ?")
- Exam-style questions ("Шалгалтын бодлого харуулна уу")

Output as JSON array of questions in Mongolian.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Output valid JSON only." },
      {
        role: "user",
        content: prompt + "\n\nChapter content:\n" + chapterText,
      },
    ],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content);
}
```

### Phase 2: Pre-Compute Answers

```typescript
// scripts/warm-cache.ts
async function warmCacheForChapter(
  questions: string[],
  chapterContext: string,
  metadata: { subject: string; grade: number; chapter: string }
) {
  for (const question of questions) {
    // 1. Generate answer
    const answer = await generateAnswer(question, chapterContext);

    // 2. Generate embedding for question
    const embedding = await getEmbedding(question);

    // 3. Store in exact match cache (Redis)
    const hash = hashQuery(
      [{ role: "user", content: question }],
      metadata.chapter
    );
    await redis.set(`cache:response:${hash}`, answer, { ex: 86400 * 30 }); // 30 days

    // 4. Store in semantic cache (Vector DB)
    await semanticIndex.upsert({
      id: `warm_${metadata.subject}_${metadata.grade}_${metadata.chapter}_${hash}`,
      vector: embedding,
      metadata: {
        response: answer,
        subject: metadata.subject,
        grade: metadata.grade,
        chapter: metadata.chapter,
        questionType: classifyQuestion(question),
        cachedAt: Date.now(),
        isPreWarmed: true,
      },
    });

    console.log(`Cached: ${question.substring(0, 50)}...`);
  }
}
```

### Phase 3: Scheduled Cache Refresh

```typescript
// lib/cache/scheduler.ts
import { CronJob } from "cron";

// Run before peak hours (3 PM Mongolia time = after school)
const PEAK_PREP_TIME = "0 14 * * 1-5"; // 2 PM weekdays

export function scheduleCacheWarmup() {
  new CronJob(PEAK_PREP_TIME, async () => {
    console.log("Starting pre-peak cache warmup...");

    // Get trending topics from last 24 hours
    const trendingQuestions = await getTrendingQuestions();

    // Re-warm cache for trending topics
    for (const question of trendingQuestions) {
      await ensureCached(question);
    }

    console.log(`Warmed ${trendingQuestions.length} trending questions`);
  }).start();
}

// Also warm after textbook upload
export async function warmCacheAfterUpload(textbookId: string) {
  const textbook = await convex.query(api.textbooks.get, { id: textbookId });
  const chapters = parseTableOfContents(textbook.tableOfContents);

  for (const chapter of chapters) {
    const questions = await generateQuestionsForChapter(chapter.content, {
      subject: textbook.subjectName,
      grade: textbook.grade,
      chapter: chapter.title,
    });

    await warmCacheForChapter(questions, chapter.content, {
      subject: textbook.subjectName,
      grade: textbook.grade,
      chapter: chapter.title,
    });
  }
}
```

---

## Chapter-Based Cache Clustering

Group cache entries by chapter for higher hit rates:

```
┌─────────────────────────────────────────────────────────────────┐
│                 CHAPTER-BASED CACHE STRUCTURE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Physics Grade 10                                                │
│  ├── Chapter 5: Light Refraction (Гэрлийн хугарал)              │
│  │   ├── Cached Questions: 50                                   │
│  │   ├── Hit Rate: 92%                                          │
│  │   └── Namespace: physics:10:light-refraction                 │
│  │                                                               │
│  ├── Chapter 6: Mirrors (Толь)                                  │
│  │   ├── Cached Questions: 45                                   │
│  │   ├── Hit Rate: 88%                                          │
│  │   └── Namespace: physics:10:mirrors                          │
│                                                                  │
│  Math Grade 9                                                    │
│  ├── Chapter 3: Quadratic Equations (Квадрат тэгшитгэл)         │
│  │   ├── Cached Questions: 60                                   │
│  │   ├── Hit Rate: 95% (very common!)                           │
│  │   └── Namespace: math:9:quadratic                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Namespace-Aware Cache Lookup

```typescript
// lib/cache/chapter-cache.ts
export async function lookupWithChapterContext(
  question: string,
  activeChapter?: { subject: string; grade: number; chapter: string }
) {
  // 1. If user has a chapter selected, search within that namespace first
  if (activeChapter) {
    const namespaceHit = await semanticIndex.query({
      vector: await getEmbedding(question),
      topK: 1,
      filter: {
        subject: { $eq: activeChapter.subject },
        grade: { $eq: activeChapter.grade },
        chapter: { $eq: activeChapter.chapter },
      },
    });

    if (namespaceHit.length > 0 && namespaceHit[0].score >= 0.88) {
      return {
        response: namespaceHit[0].metadata?.response,
        source: "chapter-cache",
        score: namespaceHit[0].score,
      };
    }
  }

  // 2. Fall back to global semantic search
  const globalHit = await semanticIndex.query({
    vector: await getEmbedding(question),
    topK: 1,
  });

  if (globalHit.length > 0 && globalHit[0].score >= 0.92) {
    return {
      response: globalHit[0].metadata?.response,
      source: "global-cache",
      score: globalHit[0].score,
    };
  }

  return null; // Cache miss
}
```

---

## Exam Period Strategy

During exam weeks (predictable in Mongolia school calendar):

### Pre-Exam Preparation (1 Week Before)

```typescript
// lib/cache/exam-prep.ts
async function prepareForExamPeriod(examInfo: {
  subject: string;
  grade: number;
  topics: string[];
  date: Date;
}) {
  console.log(
    `Preparing cache for ${examInfo.subject} Grade ${examInfo.grade} exam`
  );

  // 1. Generate exam-style questions for each topic
  for (const topic of examInfo.topics) {
    const examQuestions = await generateExamQuestions(topic, {
      difficulty: ["easy", "medium", "hard"],
      types: ["multiple-choice", "short-answer", "problem-solving"],
      count: 20,
    });

    await warmCacheForQuestions(examQuestions);
  }

  // 2. Increase cache TTL for exam topics
  await extendCacheTTL(`${examInfo.subject}:${examInfo.grade}`, 86400 * 7); // 7 days

  // 3. Pre-allocate more resources
  await upstash.setMaxConnections(examInfo.subject, 1000);

  // 4. Alert on-call engineer
  await sendSlackAlert(`Exam prep complete for ${examInfo.subject}`);
}
```

### During Exam Period

```typescript
// Adjust caching thresholds during exam
const EXAM_MODE_CONFIG = {
  semanticThreshold: 0.85, // Lower threshold = more cache hits
  maxQueueSize: 50000, // Allow larger queue
  teacherBypass: true, // Teachers always bypass
  rateLimitStudent: 3, // Stricter rate limit per minute
  enableSimpleMode: true, // Shorter responses to handle volume
};
```

---

## Scaling to 1 Million Daily Active Users

### Architecture for 1M DAU

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    1 MILLION USER ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Users (1M DAU, 100k peak concurrent)                                        │
│          │                                                                   │
│          ▼                                                                   │
│  ┌───────────────┐                                                          │
│  │ Vercel Edge   │ ← CDN/ISR for static content (95% of requests)          │
│  │ (Global CDN)  │                                                          │
│  └───────┬───────┘                                                          │
│          │ 5% dynamic requests                                               │
│          ▼                                                                   │
│  ┌───────────────┐     ┌───────────────┐                                    │
│  │ Cache Layer 1 │────▶│ Upstash Redis │ ← Exact match (30-50% hit)        │
│  │ (Exact Match) │     │ (Global)      │                                    │
│  └───────┬───────┘     └───────────────┘                                    │
│          │ 50% continue                                                      │
│          ▼                                                                   │
│  ┌───────────────┐     ┌───────────────┐                                    │
│  │ Cache Layer 2 │────▶│ Upstash Vector│ ← Semantic match (70-90% hit)     │
│  │ (Semantic)    │     │ (1536-dim)    │                                    │
│  └───────┬───────┘     └───────────────┘                                    │
│          │ 10% continue (only ~10k requests during peak!)                    │
│          ▼                                                                   │
│  ┌───────────────┐     ┌───────────────┐     ┌───────────────┐             │
│  │ Queue         │────▶│ Upstash QStash│────▶│ OpenRouter    │             │
│  │ (Priority)    │     │ (Workers)     │     │ + Fallbacks   │             │
│  └───────────────┘     └───────────────┘     └───────────────┘             │
│          │                                                                   │
│          ▼                                                                   │
│  ┌───────────────────────────────────────────────────────────────┐          │
│  │                      CONVEX (Persistence)                      │          │
│  │  • 1M user records  • 10M conversations  • 100M messages      │          │
│  │  • Real-time sync   • Built-in scaling   • Global deployment  │          │
│  └───────────────────────────────────────────────────────────────┘          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Math: Why This Works

```
Peak Hour Calculation:
- 1M DAU
- 10% active during peak hour = 100,000 concurrent users
- Each user sends 3 messages/hour = 300,000 requests/hour
- = 83 requests/second

With 90% cache hit rate:
- 83 req/s × 10% = 8.3 LLM calls/second
- 8.3 × 3600 = ~30,000 LLM calls per peak hour
- Very manageable for OpenRouter + fallbacks

Cost during peak hour:
- 30,000 calls × $0.0015/call (GPT-4o-mini avg) = $45
- Peak hour cost: ~$45
- Daily cost (8 peak-equivalent hours): ~$360
- Monthly: ~$10,000

Without caching:
- 300,000 LLM calls/hour × $0.0015 = $450/hour
- Daily: ~$3,600
- Monthly: ~$100,000

SAVINGS: 90% ($90,000/month)
```

---

## Implementation Priority for Your Use Case

### Week 1: Foundation

1. Set up Upstash Redis + Vector
2. Implement exact match cache
3. Implement semantic cache with Upstash Vector
4. Deploy to production

### Week 2: Cache Warming

1. Build question generation script
2. Process all textbook PDFs
3. Generate 50 questions per chapter
4. Warm cache with pre-computed answers

### Week 3: Queue System

1. Implement Upstash QStash queue
2. Add teacher/admin bypass
3. Implement rate limiting
4. Build queue status UI

### Week 4: Optimization

1. Add chapter-based namespacing
2. Build exam period preparation tools
3. Set up monitoring/alerts
4. Load test with realistic patterns

---

## Mongolia-Specific Considerations

### School Calendar Integration

```typescript
// lib/calendar/mongolia-schools.ts
const MONGOLIA_SCHOOL_CALENDAR = {
  examPeriods: [
    { name: "Fall Midterm", start: "2026-10-15", end: "2026-10-25" },
    { name: "Fall Final", start: "2026-12-15", end: "2026-12-25" },
    { name: "Spring Midterm", start: "2027-03-15", end: "2027-03-25" },
    { name: "Spring Final", start: "2027-05-15", end: "2027-05-25" },
    { name: "National Exam", start: "2027-06-01", end: "2027-06-15" },
  ],
  peakHours: {
    weekday: { start: 15, end: 21 }, // 3 PM - 9 PM
    weekend: { start: 10, end: 20 }, // 10 AM - 8 PM
  },
  holidays: [
    "2026-07-11", // Naadam
    "2026-02-26", // Tsagaan Sar
    // ...
  ],
};

export function isExamPeriod(): boolean {
  const now = new Date();
  return MONGOLIA_SCHOOL_CALENDAR.examPeriods.some(
    (period) => now >= new Date(period.start) && now <= new Date(period.end)
  );
}

export function isPeakHour(): boolean {
  const hour = new Date().getHours();
  const isWeekend = [0, 6].includes(new Date().getDay());
  const peak = isWeekend
    ? MONGOLIA_SCHOOL_CALENDAR.peakHours.weekend
    : MONGOLIA_SCHOOL_CALENDAR.peakHours.weekday;
  return hour >= peak.start && hour <= peak.end;
}
```

### Subject Distribution (Estimate)

| Subject           | Expected % of Questions | Priority |
| ----------------- | ----------------------- | -------- |
| Math              | 35%                     | Highest  |
| Physics           | 20%                     | High     |
| Biology           | 15%                     | Medium   |
| Chemistry         | 15%                     | Medium   |
| History/Geography | 10%                     | Lower    |
| Other             | 5%                      | Lower    |

Pre-warm math and physics caches more aggressively.

---

## Cost Projection: 1M DAU

| Component          | Monthly Cost      | Notes                    |
| ------------------ | ----------------- | ------------------------ |
| **Vercel Pro**     | $20               | Current plan             |
| **Convex Pro**     | $25               | Scale tier if needed     |
| **Upstash Redis**  | ~$200             | 10GB cache, 100k req/day |
| **Upstash Vector** | ~$100             | 100k vectors             |
| **Upstash QStash** | ~$50              | Low volume (90% cached)  |
| **OpenRouter LLM** | ~$8,000           | 10% of requests          |
| **Sentry**         | $26               | Error tracking           |
| **PostHog**        | $0-450            | Analytics                |
| **Total**          | **~$8,500-9,000** |                          |

vs. **Without optimization: ~$90,000-100,000/month**

---

## Sources

- [Convex T3.Chat Postmortem](https://news.convex.dev/how-convex-took-down-t3-chat-june-1-2025-postmortem/)
- [Redis Semantic Caching Guide](https://redis.io/blog/what-is-semantic-caching/)
- [GPTCache GitHub](https://github.com/zilliztech/GPTCache)
- [LiteLLM Gateway](https://github.com/BerriAI/litellm)
- [Convex Best Practices](https://docs.convex.dev/understanding/best-practices/)
- [Vercel ISR Documentation](https://vercel.com/blog/isr-a-flexible-way-to-cache-dynamic-content)
- [OpenRouter Rate Limits](https://openrouter.ai/docs/api/reference/limits)
- [Lamini Docs-to-QA](https://github.com/lamini-ai/docs-to-qa)
- [Semantic Caching for Chatbots](https://bhargavaparv.medium.com/cache-augmented-generation-for-chatbots-step-by-step-guide-db737a925817)
- [Scaling to 1M Users](https://medium.com/@kanishks772/scaling-to-1-million-users-the-architecture-i-wish-i-knew-sooner-39c688ded2f1)
