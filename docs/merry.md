# AI Tutor V2 - Convex Agents + RAG Implementation Plan

## Executive Summary

Complete migration to **Convex Agents** for conversation management with **RAG** for textbook search.

| What You Get                            | How                                                        |
| --------------------------------------- | ---------------------------------------------------------- |
| Automatic thread/message management     | Agent Threads (replaces `conversations`/`messages` tables) |
| Built-in streaming with real-time UI    | Async Delta Streaming                                      |
| Tool calling for RAG, progress, quizzes | Agent Tools                                                |
| Per-student usage tracking for billing  | `usageHandler` callback                                    |
| Debug UI for testing                    | Convex Playground                                          |

---

## Quick Start

```bash
# Install all packages
bun add @convex-dev/agent @convex-dev/rag @ai-sdk/openai @ai-sdk/google
```

---

# Part 1: Streaming Comparison (Your Question)

## HTTP Streaming (Current Implementation)

```
User sends message → API route → LLM streams → Frontend reads stream → UI updates
                                                 ↘ After complete → Save to Convex
```

- **Pros**: Simple, works now
- **Cons**: If user refreshes mid-stream, response is lost; single device only

## Async Delta Streaming (Recommended for Your Scale)

```
User sends message → Agent saves "streaming" message to DB
                  → LLM streams chunks → Each chunk saved as "delta" to DB (debounced)
                  → Frontend subscribes to DB → Gets real-time updates via WebSocket
                  → When done, deltas merged into final message
```

**Benefits for Your Use Case:**

- **Multi-device sync**: Student on phone + laptop sees same streaming
- **Network resilience**: Mobile users with flaky connections won't lose responses
- **Smooth UI**: Built-in `useSmoothText` hook for typing effect
- **Convex native**: Leverages existing real-time subscriptions

**Tradeoffs Table:**

| Factor             | HTTP Streaming       | Async Delta Streaming  |
| ------------------ | -------------------- | ---------------------- |
| Complexity         | Simple               | More complex setup     |
| Network Resilience | Breaks on disconnect | Survives interruptions |
| Multi-Device       | Single client        | Multiple clients       |
| DB Load            | Minimal              | Moderate (debounced)   |
| Refresh Safe       | ❌ Lost              | ✅ Persisted           |

**My Recommendation**: Use **Async Delta Streaming** for your 100K-200K DAU scale. The extra setup is worth it for mobile users in Mongolia who may have unstable connections.

---

# Part 2: Convex Agents Full Implementation

## Step 1: Update convex.config.ts

```typescript
// convex/convex.config.ts
import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import rag from "@convex-dev/rag/convex.config";
import agent from "@convex-dev/agent/convex.config";

const app = defineApp();
app.use(rateLimiter); // Already have this
app.use(rag); // Add RAG
app.use(agent); // Add Agent
export default app;
```

## Step 2: Create Tutor Agent with Tools

```typescript
// convex/agents/tutorAgent.ts
import { Agent, createTool } from "@convex-dev/agent";
import { components, internal } from "./_generated/api";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { rag } from "../rag";
import { rateLimiter } from "../rateLimits";

// Tutor Agent - Main student-facing chat
export const tutorAgent = new Agent(components.agent, {
  name: "Mongolian AI Tutor",

  // Use Gemini 2.5 Flash for cost efficiency
  languageModel: google.chat("gemini-2.5-flash"),

  // Optional: Enable vector search over message history
  textEmbeddingModel: google.textEmbeddingModel("text-embedding-004"),

  // System instructions in Mongolian
  instructions: `Та бол Монгол хэлээр заадаг AI багш туслах.

Таны үүрэг:
1. Сурагчдын асуултад тодорхой, ойлгомжтой хариулах
2. Алхам алхмаар тайлбарлах
3. Сурагчийн түвшинд тохируулах
4. Сурах бичгийн агуулгад үндэслэх (searchTextbook tool ашиглах)
5. Урам өгч, эерэг хандлагатай байх

Дүрэм:
- Хэзээ ч шууд хариулт өгөхгүй, бодох арга заана
- Монгол хэлээр хариулна
- Жишээ ашиглана`,

  // Usage tracking for billing
  usageHandler: async (ctx, { usage, userId, threadId }) => {
    if (!userId) return;

    // Track actual token usage per user
    await rateLimiter.limit(ctx, "tokenUsagePerUser", {
      key: userId,
      count: usage.totalTokens,
      reserve: true,
    });

    // Save to billing table
    await ctx.runMutation(internal.billing.recordUsage, {
      userId,
      threadId,
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
      model: "gemini-2.5-flash",
    });
  },

  // Tools the agent can use
  tools: {
    // Search textbook content via RAG
    searchTextbook: createTool({
      description:
        "Search textbook content for relevant information about a topic",
      args: z.object({
        query: z.string().describe("What to search for in the textbook"),
        grade: z.number().optional().describe("Grade level 1-12"),
        subject: z
          .string()
          .optional()
          .describe("Subject name like math, physics"),
      }),
      handler: async (ctx, args) => {
        const namespace =
          args.subject && args.grade
            ? `${args.subject.toLowerCase()}-${args.grade}`
            : undefined;

        const { text, results } = await rag.search(ctx, {
          namespace,
          query: args.query,
          limit: 5,
          vectorScoreThreshold: 0.5,
        });

        return {
          content: text,
          sourcesFound: results.length,
          message:
            results.length > 0
              ? "Сурах бичгээс олдсон мэдээлэл:"
              : "Сурах бичгээс олдсонгүй",
        };
      },
    }),

    // Get student's mastery level for a topic
    getStudentMastery: createTool({
      description: "Check how well the student understands a specific topic",
      args: z.object({
        topicTitle: z.string().describe("The topic to check mastery for"),
      }),
      handler: async (ctx, args) => {
        const userId = ctx.userId;
        if (!userId)
          return { masteryLevel: "unknown", message: "User not identified" };

        const mastery = await ctx.runQuery(internal.topicMastery.getByTopic, {
          clerkUserId: userId,
          topicTitle: args.topicTitle,
        });

        return (
          mastery || {
            masteryLevel: "not_started",
            totalInteractions: 0,
            message: "Сурагч энэ сэдвийг судлаагүй байна",
          }
        );
      },
    }),

    // Record learning interaction
    recordInteraction: createTool({
      description:
        "Record that the student interacted with a topic (for progress tracking)",
      args: z.object({
        topicTitle: z.string(),
        subjectName: z.string(),
        grade: z.number(),
        interactionType: z.enum([
          "question",
          "explanation_request",
          "problem_solving",
        ]),
        wasHelpful: z.boolean().optional(),
      }),
      handler: async (ctx, args) => {
        const userId = ctx.userId;
        if (!userId) return { recorded: false };

        await ctx.runMutation(internal.learningInteractions.recordFromAgent, {
          clerkUserId: userId,
          ...args,
        });

        return { recorded: true };
      },
    }),

    // Generate quiz questions
    generateQuiz: createTool({
      description: "Generate quiz questions based on a topic from the textbook",
      args: z.object({
        topic: z.string().describe("Topic to generate questions about"),
        numQuestions: z.number().default(5),
        difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
      }),
      handler: async (ctx, args) => {
        // Search for topic content first
        const { text } = await rag.search(ctx, {
          query: args.topic,
          limit: 3,
        });

        return {
          topicContent: text,
          requestedQuestions: args.numQuestions,
          difficulty: args.difficulty,
          instruction: "Generate quiz questions based on this content",
        };
      },
    }),
  },
});
```

## Step 3: Create Thread Management Actions

```typescript
// convex/agents/tutorActions.ts
import { v } from "convex/values";
import {
  action,
  mutation,
  query,
  internalMutation,
} from "../_generated/server";
import { tutorAgent } from "./tutorAgent";
import {
  createThread,
  listThreadsByUserId,
  listUIMessages,
  syncStreams,
} from "@convex-dev/agent";
import { components } from "../_generated/api";
import { paginationOptsValidator, vStreamArgs } from "@convex-dev/agent";

// Create a new tutoring session
export const startSession = action({
  args: {
    subject: v.optional(v.string()),
    grade: v.optional(v.number()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const threadId = await createThread(ctx, components.agent, {
      userId: identity.subject,
      title:
        args.title ||
        `${args.subject || "General"} - ${new Date().toLocaleDateString("mn-MN")}`,
      summary: args.subject
        ? `${args.grade}-р анги ${args.subject}`
        : undefined,
    });

    return { threadId };
  },
});

// Send message with streaming (Async Delta approach)
export const sendMessage = action({
  args: {
    threadId: v.string(),
    message: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Continue the thread
    const { thread } = await tutorAgent.continueThread(ctx, {
      threadId: args.threadId as any,
      userId: identity.subject,
    });

    // Stream with delta saving (for real-time UI)
    const result = await thread.streamText(
      {
        prompt: args.imageUrl
          ? [
              { type: "text", text: args.message },
              { type: "image", image: args.imageUrl },
            ]
          : args.message,
      },
      {
        saveStreamDeltas: {
          chunking: "word", // Chunk by word for smooth typing
          throttleMs: 100, // Save every 100ms (debounced)
        },
      },
    );

    return { messageId: result.messageId };
  },
});

// List user's threads (conversations)
export const listUserThreads = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await listThreadsByUserId(ctx, components.agent, {
      userId: identity.subject,
    });
  },
});

// List messages for a thread (with streaming support)
export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get paginated messages
    const paginated = await listUIMessages(ctx, components.agent, {
      threadId: args.threadId as any,
      paginationOpts: args.paginationOpts,
    });

    // Sync streaming deltas for real-time updates
    const streams = await syncStreams(ctx, components.agent, {
      threadId: args.threadId as any,
      ...args.streamArgs,
    });

    return { ...paginated, streams };
  },
});

// Delete a thread
export const deleteThread = action({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    await tutorAgent.deleteThreadAsync(ctx, {
      threadId: args.threadId as any,
    });

    return { success: true };
  },
});
```

## Step 4: React Hooks for Frontend

```typescript
// hooks/use-tutor-agent.ts
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUIMessages, useSmoothText } from "@convex-dev/agent/react";
import { useState, useCallback } from "react";

export function useTutorAgent() {
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);

  // Actions
  const startSession = useAction(api.agents.tutorActions.startSession);
  const sendMessage = useAction(api.agents.tutorActions.sendMessage);
  const deleteThread = useAction(api.agents.tutorActions.deleteThread);

  // Queries
  const threads = useQuery(api.agents.tutorActions.listUserThreads);

  // Messages with streaming support
  const { results: messages, status, loadMore } = useUIMessages(
    api.agents.tutorActions.listThreadMessages,
    currentThreadId ? { threadId: currentThreadId } : "skip",
    { initialNumItems: 50, stream: true }
  );

  // Start new session
  const initSession = useCallback(async (subject?: string, grade?: number) => {
    const { threadId } = await startSession({ subject, grade });
    setCurrentThreadId(threadId);
    return threadId;
  }, [startSession]);

  // Send message
  const send = useCallback(async (message: string, imageUrl?: string) => {
    if (!currentThreadId) {
      // Auto-create thread on first message
      const { threadId } = await startSession({});
      setCurrentThreadId(threadId);
      await sendMessage({ threadId, message, imageUrl });
    } else {
      await sendMessage({ threadId: currentThreadId, message, imageUrl });
    }
  }, [currentThreadId, startSession, sendMessage]);

  // Select existing thread
  const selectThread = useCallback((threadId: string) => {
    setCurrentThreadId(threadId);
  }, []);

  return {
    // State
    currentThreadId,
    threads,
    messages,
    isStreaming: status === "streaming",

    // Actions
    initSession,
    send,
    selectThread,
    deleteThread,
    loadMore,
  };
}

// Smooth text component for streaming messages
export function StreamingMessage({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const [visibleText] = useSmoothText(text, {
    startStreaming: isStreaming,
  });

  return <span>{visibleText}</span>;
}
```

## Step 5: Usage Tracking for Billing

```typescript
// convex/billing.ts
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

// Schema addition needed:
// billingUsage: defineTable({
//   userId: v.string(),
//   threadId: v.string(),
//   inputTokens: v.number(),
//   outputTokens: v.number(),
//   model: v.string(),
//   billingPeriod: v.string(), // "2026-01" format
//   timestamp: v.number(),
// })
//   .index("by_user_period", ["userId", "billingPeriod"])
//   .index("by_period", ["billingPeriod"])

// Record usage from agent
export const recordUsage = internalMutation({
  args: {
    userId: v.string(),
    threadId: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const billingPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    await ctx.db.insert("billingUsage", {
      ...args,
      billingPeriod,
      timestamp: Date.now(),
    });
  },
});

// Get user's usage for current month
export const getUserUsage = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const now = new Date();
    const billingPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    const usage = await ctx.db
      .query("billingUsage")
      .withIndex("by_user_period", (q) =>
        q.eq("userId", args.userId).eq("billingPeriod", billingPeriod),
      )
      .collect();

    const totals = usage.reduce(
      (acc, u) => ({
        inputTokens: acc.inputTokens + u.inputTokens,
        outputTokens: acc.outputTokens + u.outputTokens,
        totalMessages: acc.totalMessages + 1,
      }),
      { inputTokens: 0, outputTokens: 0, totalMessages: 0 },
    );

    return {
      ...totals,
      billingPeriod,
      estimatedCost:
        (totals.inputTokens * 0.00015 + totals.outputTokens * 0.0006) / 1000, // Gemini pricing
    };
  },
});
```

## Step 6: Rate Limiting Update

```typescript
// convex/rateLimits.ts (update existing file)
import { MINUTE, SECOND, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Existing limits...
  sendMessage: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 30 },
  fileUpload: { kind: "token bucket", rate: 5, period: MINUTE, capacity: 5 },

  // NEW: Token-based limits for billing
  tokenUsagePerUser: {
    kind: "token bucket",
    period: MINUTE,
    rate: 5000, // 5K tokens per minute
    capacity: 20000, // Burst up to 20K
  },
  globalTokenUsage: {
    kind: "token bucket",
    period: MINUTE,
    rate: 500000, // 500K tokens per minute globally
  },
});
```

---

# Part 3: Additional Agents (Quiz, Teacher, Lesson Plan)

## Quiz Generator Agent

```typescript
// convex/agents/quizAgent.ts
import { Agent, createTool } from "@convex-dev/agent";
import { components } from "../_generated/api";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { rag } from "../rag";

export const quizAgent = new Agent(components.agent, {
  name: "Quiz Generator",
  languageModel: google.chat("gemini-2.5-flash"),

  instructions: `Та бол сорилын асуулт боловсруулагч.
Өгөгдсөн сэдвийн дагуу олон сонголттой тест үүсгэнэ.
Бүх асуулт Монгол хэлээр байна.
Хариултын тайлбар оруулна.`,

  tools: {
    getTopicContent: createTool({
      description: "Get textbook content for a topic to base questions on",
      args: z.object({
        topic: z.string(),
        grade: z.number(),
        subject: z.string(),
      }),
      handler: async (ctx, args) => {
        const { text } = await rag.search(ctx, {
          namespace: `${args.subject.toLowerCase()}-${args.grade}`,
          query: args.topic,
          limit: 5,
        });
        return { content: text };
      },
    }),
  },
});
```

## Teacher Assistant Agent

```typescript
// convex/agents/teacherAgent.ts
import { Agent, createTool } from "@convex-dev/agent";
import { components, internal } from "../_generated/api";
import { google } from "@ai-sdk/google";
import { z } from "zod";

export const teacherAgent = new Agent(components.agent, {
  name: "Teacher Assistant",
  languageModel: google.chat("gemini-2.5-flash"),

  instructions: `Та бол багш нарт туслах AI туслах.
Сурагчдын явц, дүн шинжилгээ, хичээлийн төлөвлөгөө боловсруулахад туслана.`,

  tools: {
    getClassProgress: createTool({
      description: "Get progress data for a class",
      args: z.object({
        grade: z.number(),
        group: z.string(),
        subject: z.string(),
      }),
      handler: async (ctx, args) => {
        // Query topicMastery aggregated by class
        return await ctx.runQuery(internal.analytics.getClassProgress, args);
      },
    }),

    getStudentsAtRisk: createTool({
      description: "Identify students who are struggling",
      args: z.object({
        grade: z.number(),
        group: z.string(),
        threshold: z.number().default(50), // Below 50% accuracy
      }),
      handler: async (ctx, args) => {
        return await ctx.runQuery(internal.analytics.getStudentsAtRisk, args);
      },
    }),
  },
});
```

---

# Part 4: Migration Strategy

## Data Migration (Existing Conversations)

If you have existing conversations in `conversations`/`messages` tables:

```typescript
// convex/migrations/migrateToAgentThreads.ts
import { internalMutation } from "../_generated/server";
import { createThread, saveMessage } from "@convex-dev/agent";
import { components } from "../_generated/api";

export const migrateConversations = internalMutation({
  handler: async (ctx) => {
    const conversations = await ctx.db.query("conversations").collect();

    for (const conv of conversations) {
      // Create agent thread
      const threadId = await createThread(ctx, components.agent, {
        userId: conv.clerkUserId,
        title: conv.title,
      });

      // Migrate messages
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
        .collect();

      for (const msg of messages) {
        await saveMessage(ctx, components.agent, {
          threadId,
          role: msg.role,
          content: msg.content,
          // Note: Images need separate handling
        });
      }

      // Optional: Mark old conversation as migrated
      await ctx.db.patch(conv._id, { migratedToThreadId: threadId });
    }
  },
});
```

**Recommendation**: For launch, I suggest running both systems in parallel:

1. New users → Agent threads
2. Existing users → Keep old conversations readable, create new threads going forward
3. After 30 days, migrate remaining active users

---

# Part 5: Files to Create/Modify

## New Files

```
convex/
├── rag.ts                          # RAG client configuration
├── textbookIngestion.ts            # Content ingestion to RAG
├── billing.ts                      # Usage tracking for billing
├── agents/
│   ├── tutorAgent.ts               # Main tutor agent definition
│   ├── tutorActions.ts             # Thread/message actions
│   ├── quizAgent.ts                # Quiz generation agent
│   └── teacherAgent.ts             # Teacher assistant agent
└── migrations/
    └── migrateToAgentThreads.ts    # Data migration

hooks/
├── use-tutor-agent.ts              # Main chat hook
└── use-quiz-generator.ts           # Quiz hook

components/chat/
├── agent-chat-view.tsx             # New chat component using agents
├── agent-message.tsx               # Message with tool results display
└── streaming-text.tsx              # Smooth streaming text component
```

## Modified Files

```
convex/convex.config.ts             # Add agent + rag components
convex/rateLimits.ts                # Add token-based limits
convex/schema.ts                    # Add billingUsage table
package.json                        # Add dependencies
```

---

# Part 6: Implementation Order

| Phase     | Task                                      | Time          |
| --------- | ----------------------------------------- | ------------- |
| 1         | Install packages, update convex.config.ts | 30 min        |
| 2         | Set up RAG + ingest 1 test textbook       | 2-3 hours     |
| 3         | Create TutorAgent with basic tools        | 2-3 hours     |
| 4         | Implement streaming actions               | 1-2 hours     |
| 5         | Create React hooks                        | 1-2 hours     |
| 6         | Update chat UI components                 | 2-3 hours     |
| 7         | Add usage tracking + billing              | 1-2 hours     |
| 8         | Test end-to-end                           | 2 hours       |
| 9         | Add Quiz + Teacher agents                 | 2-3 hours     |
| **Total** |                                           | **~2-3 days** |

---

# Part 7: Verification

## Test Plan

1. **RAG Search Test**

   ```typescript
   // In Convex dashboard or test
   const result = await rag.search(ctx, {
     namespace: "math-10",
     query: "Квадрат тэгшитгэл",
     limit: 3,
   });
   // Verify: results.length > 0, text contains relevant content
   ```

2. **Agent Chat Test**
   - Create thread
   - Send message "Фотосинтез гэж юу вэ?"
   - Verify: Agent calls searchTextbook tool
   - Verify: Response contains textbook content

3. **Streaming Test**
   - Send message
   - Verify: UI shows typing effect
   - Verify: Refresh page, response still visible

4. **Usage Tracking Test**
   - Send 5 messages
   - Check billingUsage table
   - Verify: Token counts recorded per message

---

# Summary: What Changes

| Before (Current)             | After (With Agents)              |
| ---------------------------- | -------------------------------- |
| Manual `conversations` table | Agent Threads (automatic)        |
| Manual `messages` table      | Agent Messages (automatic)       |
| HTTP streaming in API route  | Async Delta Streaming via Convex |
| No RAG                       | RAG with textbook search         |
| No tool calling              | Tools for search, progress, quiz |
| Simple rate limiting         | Token-based usage tracking       |
| No billing data              | Per-user token tracking          |

---

# Appendix: RAG Implementation Details

## Why Convex RAG is Perfect for This Project

| Requirement                          | Convex RAG Solution          |
| ------------------------------------ | ---------------------------- |
| Store vectors for 1-12 grade content | ✅ Built-in vector storage   |
| Custom PDF to vector pipeline        | ✅ Accepts custom embeddings |
| Organize by subject/grade            | ✅ Namespaces + filters      |
| Search in Mongolian                  | ✅ Works with any language   |
| Scale to 100K+ users                 | ✅ Serverless, auto-scaling  |
| Real-time updates                    | ✅ Convex native             |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CONTENT INGESTION                             │
│                                                                       │
│  PDF Textbooks → Your Custom Extractor → Convex RAG Component        │
│       ↓                    ↓                      ↓                   │
│  [Math 10]           [Text Chunks]          [Embeddings]             │
│  [Physics 11]        [Metadata]             [Vector Index]           │
│  [Biology 9]                                                          │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         SEARCH & RETRIEVAL                            │
│                                                                       │
│  Student Question: "Квадрат тэгшитгэлийг хэрхэн бодох вэ?"           │
│         ↓                                                             │
│  Vector Search (namespace: "math-10", filters: {chapter: "algebra"}) │
│         ↓                                                             │
│  Top 5 relevant chunks from Math 10 textbook                         │
│         ↓                                                             │
│  Context + Question → Gemini → Response                              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Phase 1: Install & Configure RAG Component (1-2 hours)

**1.1 Install Package**

```bash
bun add @convex-dev/rag @ai-sdk/openai
```

**1.2 Update convex.config.ts**

```typescript
// convex/convex.config.ts
import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import rag from "@convex-dev/rag/convex.config";

const app = defineApp();
app.use(rateLimiter);
app.use(rag); // Add RAG component
export default app;
```

**1.3 Create RAG Client**

```typescript
// convex/rag.ts
import { RAG } from "@convex-dev/rag";
import { components } from "./_generated/api";
import { openai } from "@ai-sdk/openai";

// Define filter types for educational content
type FilterTypes = {
  grade: string; // "1" - "12"
  subject: string; // "math", "physics", "biology", etc.
  chapter: string; // Chapter identifier
};

export const rag = new RAG<FilterTypes>(components.rag, {
  // Use OpenAI embeddings (works well with Mongolian)
  textEmbeddingModel: openai.embedding("text-embedding-3-small"),
  embeddingDimension: 1536,

  // Enable filtering by grade, subject, chapter
  filterNames: ["grade", "subject", "chapter"],
});
```

---

### Phase 2: Create Ingestion Pipeline (2-3 hours)

**2.1 Ingest Textbook Content**

```typescript
// convex/textbookIngestion.ts
import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { rag } from "./rag";
import { api, internal } from "./_generated/api";

// Ingest a single textbook's content into RAG
export const ingestTextbook = action({
  args: {
    textbookId: v.id("textbooks"),
  },
  handler: async (ctx, args) => {
    // Get textbook details
    const textbook = await ctx.runQuery(api.textbooks.get, {
      id: args.textbookId,
    });
    if (!textbook || !textbook.extractedText) {
      throw new Error("Textbook not found or text not extracted");
    }

    // Create namespace: "subject-grade" (e.g., "math-10", "physics-11")
    const namespace = `${textbook.subjectName.toLowerCase()}-${textbook.grade}`;

    // Ingest each chapter separately for better granularity
    if (textbook.tableOfContents) {
      for (const chapter of textbook.tableOfContents) {
        // Extract chapter text (you may need to split extractedText by chapter)
        const chapterText = extractChapterText(textbook.extractedText, chapter);

        await rag.add(ctx, {
          namespace,
          text: chapterText,
          key: `${args.textbookId}-${chapter.id}`, // Unique key for updates
          filters: {
            grade: String(textbook.grade),
            subject: textbook.subjectName.toLowerCase(),
            chapter: chapter.id,
          },
          metadata: {
            textbookId: args.textbookId,
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            chapterDescription: chapter.description,
          },
        });
      }
    } else {
      // Ingest entire textbook as one entry
      await rag.add(ctx, {
        namespace,
        text: textbook.extractedText,
        key: args.textbookId,
        filters: {
          grade: String(textbook.grade),
          subject: textbook.subjectName.toLowerCase(),
          chapter: "all",
        },
        metadata: {
          textbookId: args.textbookId,
          subjectName: textbook.subjectName,
        },
      });
    }

    return { success: true, namespace };
  },
});

// Helper to extract chapter text (customize based on your PDF structure)
function extractChapterText(fullText: string, chapter: any): string {
  // Implement based on your PDF extraction format
  // This is a placeholder - adapt to your actual structure
  return fullText; // For now, return full text
}
```

**2.2 Bulk Ingestion for All Textbooks**

```typescript
// convex/textbookIngestion.ts (continued)
export const ingestAllTextbooks = action({
  args: {},
  handler: async (ctx) => {
    const textbooks = await ctx.runQuery(api.textbooks.listAll);

    const results = [];
    for (const textbook of textbooks) {
      if (textbook.extractedText && textbook.status === "active") {
        try {
          const result = await ctx.runAction(
            api.textbookIngestion.ingestTextbook,
            {
              textbookId: textbook._id,
            },
          );
          results.push({ textbookId: textbook._id, ...result });
        } catch (error) {
          results.push({ textbookId: textbook._id, error: String(error) });
        }
      }
    }

    return results;
  },
});
```

---

### Phase 3: Implement Search (1-2 hours)

**3.1 Search Function**

```typescript
// convex/ragSearch.ts
import { v } from "convex/values";
import { action } from "./_generated/server";
import { rag } from "./rag";

export const search = action({
  args: {
    query: v.string(),
    grade: v.optional(v.number()),
    subject: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Build namespace based on filters
    const namespace =
      args.subject && args.grade
        ? `${args.subject.toLowerCase()}-${args.grade}`
        : undefined;

    const { results, text, entries } = await rag.search(ctx, {
      namespace,
      query: args.query,
      limit: args.limit || 5,
      vectorScoreThreshold: 0.5, // Minimum similarity score
      chunkContext: {
        before: 1, // Include 1 chunk before for context
        after: 1, // Include 1 chunk after for context
      },
      filters: args.subject
        ? { subject: args.subject.toLowerCase() }
        : undefined,
    });

    return {
      results,
      text, // Pre-formatted text with separators
      entries,
      count: results.length,
    };
  },
});
```

**3.2 Search with LLM Response**

```typescript
// convex/ragSearch.ts (continued)
export const searchAndGenerate = action({
  args: {
    query: v.string(),
    grade: v.optional(v.number()),
    subject: v.optional(v.string()),
    conversationHistory: v.optional(
      v.array(
        v.object({
          role: v.string(),
          content: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const namespace =
      args.subject && args.grade
        ? `${args.subject.toLowerCase()}-${args.grade}`
        : undefined;

    // Use built-in generateText for automatic RAG
    const { text, context } = await rag.generateText(ctx, {
      search: {
        namespace,
        limit: 5,
        vectorScoreThreshold: 0.5,
      },
      prompt: args.query,
      model: openai.chat("gpt-4o-mini"), // Or use Gemini via OpenRouter
      systemPrompt: `Та бол Монгол хэлээр заадаг AI багш.
        Доорх контекст дээр үндэслэн сурагчийн асуултад хариулна уу.
        Хэрэв контекст хангалтгүй бол үнэнчээр хэлнэ үү.`,
    });

    return { response: text, context };
  },
});
```

---

### Phase 4: Integrate with Chat API (1-2 hours)

**4.1 Update Chat Route to Use RAG**

```typescript
// app/api/chat/route.ts - Add RAG context retrieval

// Before sending to LLM, search for relevant content
const ragResults = await convex.action(api.ragSearch.search, {
  query: lastUserMessage,
  grade: textbookContext?.grade,
  subject: textbookContext?.subjectName,
  limit: 5,
});

// Add RAG context to system prompt
const ragContext = ragResults.text
  ? `\n\nХолбогдох сурах бичгийн агуулга:\n${ragResults.text}`
  : "";

const systemPromptWithRAG = `${SYSTEM_PROMPT}${personalizationContext}${ragContext}`;
```

---

### Phase 5: Admin Interface for RAG Management (Optional, 2-3 hours)

**5.1 Admin Dashboard Component**

```typescript
// components/admin/rag-management.tsx
export function RAGManagement() {
  const ingestAll = useMutation(api.textbookIngestion.ingestAllTextbooks);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleIngest = async () => {
    setStatus("loading");
    try {
      await ingestAll();
      setStatus("success");
    } catch (error) {
      setStatus("error");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>RAG Content Management</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={handleIngest} disabled={status === "loading"}>
          {status === "loading" ? "Боловсруулж байна..." : "Бүх сурах бичгийг индекслэх"}
        </Button>
        {status === "success" && <p className="text-green-600">Амжилттай!</p>}
        {status === "error" && <p className="text-red-600">Алдаа гарлаа</p>}
      </CardContent>
    </Card>
  );
}
```

---

## Namespace Strategy for Educational Content

```
Namespaces:
├── math-1       (1-р анги математик)
├── math-2       (2-р анги математик)
├── ...
├── math-12      (12-р анги математик)
├── physics-7    (7-р анги физик)
├── physics-8    (8-р анги физик)
├── ...
├── biology-6    (6-р анги биологи)
├── biology-7    (7-р анги биологи)
└── ...

Within each namespace:
├── Entry: textbook-chapter-1
├── Entry: textbook-chapter-2
└── Entry: textbook-chapter-3

Each entry contains:
├── Chunks (auto-generated, ~100-1000 chars each)
├── Embeddings (1536 dimensions)
├── Filters: { grade, subject, chapter }
└── Metadata: { textbookId, chapterTitle }
```

---

## Cost Implications

### Embedding Costs (One-time per textbook)

| Content                         | Tokens       | Cost (text-embedding-3-small) |
| ------------------------------- | ------------ | ----------------------------- |
| 1 textbook (~50K chars)         | ~12K tokens  | ~$0.0002                      |
| 100 textbooks                   | ~1.2M tokens | ~$0.02                        |
| All grades (1-12) × 10 subjects | ~12M tokens  | ~$0.20                        |

**Total one-time embedding cost: ~$0.20 - $1.00**

### Search Costs (Per query)

| Query Type                        | Tokens       | Cost      |
| --------------------------------- | ------------ | --------- |
| Embed user question               | ~100 tokens  | $0.000002 |
| Per 1000 searches                 | ~100K tokens | $0.002    |
| Per day (100K users × 5 searches) | 50M tokens   | $1.00     |

**Daily search embedding cost: ~$1.00 at 500K searches**

---

## Files to Create/Modify

### New Files

```
convex/rag.ts                    # RAG client configuration
convex/textbookIngestion.ts      # Content ingestion actions
convex/ragSearch.ts              # Search and generate actions
components/admin/rag-management.tsx  # Admin UI (optional)
```

### Modified Files

```
convex/convex.config.ts          # Add RAG component
app/api/chat/route.ts            # Integrate RAG context
package.json                     # Add @convex-dev/rag
```

---

## Verification Steps

1. **Install & Deploy**

   ```bash
   bun add @convex-dev/rag @ai-sdk/openai
   bunx convex dev
   ```

2. **Test Ingestion**
   - Upload a test textbook
   - Run ingestion action
   - Check Convex dashboard for RAG entries

3. **Test Search**
   - Query: "Фотосинтез гэж юу вэ?"
   - Verify relevant biology content returned
   - Check similarity scores

4. **Test Chat Integration**
   - Ask question about specific subject
   - Verify response uses textbook content
   - Check RAG context in response

---

## Summary

| Aspect                 | Assessment                               |
| ---------------------- | ---------------------------------------- |
| **Feasibility**        | ✅ Fully compatible with your setup      |
| **Integration Effort** | ~1-2 days                                |
| **Cost**               | ~$1/day for embeddings at 100K+ searches |
| **Scalability**        | ✅ Convex handles automatically          |
| **Mongolian Support**  | ✅ OpenAI embeddings work well           |

---

# Convex AI Agents Implementation

## What is Convex AI Agents?

Convex AI Agents is a **framework for building agentic AI applications** that:

- Manages conversation threads automatically
- Persists chat history by default
- Supports multi-agent workflows
- Integrates seamlessly with RAG
- Provides real-time updates across all clients

### RAG vs Agents: What's the Difference?

| Feature  | RAG Component                   | Agent Component                        |
| -------- | ------------------------------- | -------------------------------------- |
| Purpose  | Vector search, retrieve context | Multi-turn conversations, tool calling |
| State    | Stateless searches              | Persistent threads                     |
| Use      | Augment prompts with data       | Build conversational AI apps           |
| Tools    | N/A                             | Full tool calling support              |
| Best For | Simple Q&A                      | Complex interactions                   |

**For your app: Use BOTH together!**

- Agents = Handle conversations, call tools
- RAG = Provide textbook knowledge to agents

---

## Use Cases for Your Educational Platform

### 1. Intelligent Tutor Agent (Primary Use Case)

```
Student: "Би квадрат тэгшитгэл ойлгохгүй байна"
           ↓
Tutor Agent:
  1. Searches RAG for Math 10 algebra content
  2. Analyzes student's mastery level (from topicMastery table)
  3. Generates personalized explanation
  4. Suggests practice problems
  5. Tracks interaction in learningInteractions
```

**Features:**

- Remembers conversation history
- Adapts to student's level
- Uses actual textbook content
- Tracks progress automatically

---

### 2. Quiz Generator Agent

```
Teacher: "10-р ангийн физикийн Механик бүлгээс 5 асуулт үүсгэ"
           ↓
Quiz Agent:
  1. Searches RAG for Physics 10 Mechanics chapter
  2. Generates 5 quiz questions based on content
  3. Creates answer key
  4. Returns structured quiz format
```

**Features:**

- Questions based on actual textbook
- Multiple difficulty levels
- Auto-grading capability
- Saves quiz for reuse

---

### 3. Homework Helper Agent

```
Student uploads photo of homework problem
           ↓
Homework Agent:
  1. Analyzes image (Vision)
  2. Searches RAG for relevant topic
  3. Provides step-by-step solution
  4. Explains the concept
  5. Suggests similar practice problems
```

**Features:**

- Image understanding
- Step-by-step explanations
- Cross-references with textbook
- Doesn't just give answers

---

### 4. Learning Path Agent

```
System: "Create learning path for struggling student"
           ↓
Learning Path Agent:
  1. Analyzes student's topicMastery records
  2. Identifies weak areas
  3. Searches RAG for prerequisite topics
  4. Creates personalized study plan
  5. Updates learningPaths table
```

**Features:**

- Personalized recommendations
- Adaptive to progress
- Connected to curriculum structure

---

### 5. Teacher Assistant Agent

```
Teacher: "Миний ангийн сурагчдын 'Гэрлийн хугарал' сэдвийн байдал?"
           ↓
Teacher Assistant Agent:
  1. Queries topicMastery for all students
  2. Aggregates performance data
  3. Identifies struggling students
  4. Suggests intervention strategies
  5. Generates class report
```

**Features:**

- Class-wide analytics
- Individual student tracking
- Actionable insights
- Report generation

---

## Architecture: RAG + Agents Together

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           STUDENT INTERFACE                             │
│         Chat Input → Voice → Image Upload → Topic Selection             │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           TUTOR AGENT                                   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Instructions: "You are a Mongolian AI tutor..."                 │   │
│  │  Model: Gemini 2.5 Flash                                         │   │
│  │  Tools:                                                          │   │
│  │    - searchTextbook (RAG)                                        │   │
│  │    - getStudentMastery                                           │   │
│  │    - recordInteraction                                           │   │
│  │    - generateQuiz                                                │   │
│  │    - analyzeImage                                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
            ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
            │   RAG       │   │   Convex    │   │   Vision    │
            │  Component  │   │   Database  │   │    API      │
            │ (Textbooks) │   │ (Progress)  │   │  (Images)   │
            └─────────────┘   └─────────────┘   └─────────────┘
```

---

## Implementation: Complete Agent Setup

### Step 1: Install Agent Component

```bash
bun add @convex-dev/agent @ai-sdk/openai @ai-sdk/google
```

### Step 2: Update convex.config.ts

```typescript
// convex/convex.config.ts
import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import rag from "@convex-dev/rag/convex.config";
import agent from "@convex-dev/agent/convex.config";

const app = defineApp();
app.use(rateLimiter);
app.use(rag);
app.use(agent); // Add Agent component
export default app;
```

### Step 3: Create Tutor Agent

```typescript
// convex/tutorAgent.ts
import { Agent, createTool } from "@convex-dev/agent";
import { components, internal } from "./_generated/api";
import { google } from "@ai-sdk/google";
import { rag } from "./rag";
import { v } from "convex/values";

// Define custom context type for tools
type TutorContext = {
  studentId: string;
  grade?: number;
  subject?: string;
};

// Create the Tutor Agent
export const tutorAgent = new Agent<TutorContext>(components.agent, {
  name: "Mongolian AI Tutor",

  // Use Gemini for cost efficiency
  chat: google.chat("gemini-2.0-flash"),

  // System instructions in Mongolian
  instructions: `Та бол Монгол хэлээр заадаг AI багш туслах.

Таны үүрэг:
1. Сурагчдын асуултад тодорхой, ойлгомжтой хариулах
2. Алхам алхмаар тайлбарлах
3. Сурагчийн түвшинд тохируулах
4. Сурах бичгийн агуулгад үндэслэх
5. Урам өгч, эерэг хандлагатай байх

Дүрэм:
- Хэзээ ч шууд хариулт өгөхгүй, бодох арга заана
- Монгол хэлээр хариулна
- Жишээ ашиглана
- Сурагчийн сул талыг анхаарна`,

  // Agent tools
  tools: {
    // Search textbook content via RAG
    searchTextbook: createTool({
      description: "Search textbook content for relevant information",
      args: {
        query: v.string(),
        subject: v.optional(v.string()),
        grade: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        const { results, text } = await rag.search(ctx, {
          namespace:
            args.subject && args.grade
              ? `${args.subject}-${args.grade}`
              : undefined,
          query: args.query,
          limit: 5,
          vectorScoreThreshold: 0.5,
        });
        return { content: text, sources: results.length };
      },
    }),

    // Get student's mastery level
    getStudentMastery: createTool({
      description: "Get student's mastery level for a topic",
      args: {
        topicTitle: v.string(),
      },
      handler: async (ctx, args) => {
        const mastery = await ctx.runQuery(internal.topicMastery.getByTopic, {
          clerkUserId: ctx.toolCtx.studentId,
          topicTitle: args.topicTitle,
        });
        return mastery || { masteryLevel: "not_started", totalInteractions: 0 };
      },
    }),

    // Record learning interaction
    recordInteraction: createTool({
      description: "Record a learning interaction for progress tracking",
      args: {
        topicTitle: v.string(),
        interactionType: v.union(
          v.literal("question"),
          v.literal("explanation_request"),
          v.literal("problem_solving"),
        ),
        isCorrect: v.optional(v.boolean()),
      },
      handler: async (ctx, args) => {
        await ctx.runMutation(internal.learningInteractions.record, {
          clerkUserId: ctx.toolCtx.studentId,
          subjectName: ctx.toolCtx.subject || "general",
          grade: ctx.toolCtx.grade || 0,
          topicTitle: args.topicTitle,
          interactionType: args.interactionType,
          isCorrect: args.isCorrect,
        });
        return { recorded: true };
      },
    }),

    // Generate practice quiz
    generateQuiz: createTool({
      description: "Generate quiz questions based on topic",
      args: {
        topic: v.string(),
        numQuestions: v.number(),
        difficulty: v.union(
          v.literal("easy"),
          v.literal("medium"),
          v.literal("hard"),
        ),
      },
      handler: async (ctx, args) => {
        // Search for topic content
        const { text } = await rag.search(ctx, {
          query: args.topic,
          limit: 3,
        });

        // This would trigger another LLM call to generate quiz
        // For now, return placeholder
        return {
          topic: args.topic,
          content: text,
          questionsToGenerate: args.numQuestions,
          difficulty: args.difficulty,
        };
      },
    }),
  },
});
```

### Step 4: Create Thread Actions

```typescript
// convex/tutorAgent.ts (continued)

// Start a new tutoring session
export const startSession = action({
  args: {
    subject: v.optional(v.string()),
    grade: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const { threadId, thread } = await tutorAgent.createThread(ctx, {
      // Custom context available to all tools
      toolCtx: {
        studentId: identity.subject,
        subject: args.subject,
        grade: args.grade,
      },
    });

    return { threadId };
  },
});

// Send message and get response
export const sendMessage = action({
  args: {
    threadId: v.string(),
    message: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const thread = await tutorAgent.continueThread(ctx, {
      threadId: args.threadId as any,
    });

    // Generate response with optional image
    const result = await thread.generateText({
      prompt: args.imageUrl
        ? [
            { type: "text", text: args.message },
            { type: "image", image: args.imageUrl },
          ]
        : args.message,
    });

    return {
      response: result.text,
      toolCalls: result.toolCalls,
    };
  },
});

// Stream response (for real-time UI)
export const streamMessage = action({
  args: {
    threadId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const thread = await tutorAgent.continueThread(ctx, {
      threadId: args.threadId as any,
    });

    // Returns stream that can be consumed by client
    const stream = await thread.streamText({
      prompt: args.message,
    });

    return stream;
  },
});
```

### Step 5: React Hook for Chat

```typescript
// hooks/use-tutor-agent.ts
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useCallback } from "react";

export function useTutorAgent() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const startSession = useAction(api.tutorAgent.startSession);
  const sendMessage = useAction(api.tutorAgent.sendMessage);

  // Get thread messages (real-time updates!)
  const messages = useQuery(
    api.tutorAgent.getThreadMessages,
    threadId ? { threadId } : "skip",
  );

  const initSession = useCallback(
    async (subject?: string, grade?: number) => {
      const { threadId } = await startSession({ subject, grade });
      setThreadId(threadId);
      return threadId;
    },
    [startSession],
  );

  const send = useCallback(
    async (message: string, imageUrl?: string) => {
      if (!threadId) throw new Error("No active session");

      setIsLoading(true);
      try {
        const response = await sendMessage({ threadId, message, imageUrl });
        return response;
      } finally {
        setIsLoading(false);
      }
    },
    [threadId, sendMessage],
  );

  return {
    threadId,
    messages,
    isLoading,
    initSession,
    send,
  };
}
```

---

## Feature Comparison: Current vs With Agents

| Feature            | Current Implementation   | With Agents               |
| ------------------ | ------------------------ | ------------------------- |
| Chat history       | Manual (messages table)  | Automatic (threads)       |
| Context management | Manual (last N messages) | Automatic + hybrid search |
| Tool calling       | N/A                      | Built-in                  |
| Multi-agent        | N/A                      | Supported                 |
| Progress tracking  | Separate logic           | Integrated via tools      |
| RAG                | Separate (if added)      | Integrated via tools      |
| Real-time updates  | Manual queries           | Automatic via Convex      |
| Streaming          | Manual HTTP streams      | Built-in WebSocket        |

---

## Recommended Implementation Strategy

### Option A: Full Agent Migration (Recommended)

Replace current chat implementation with Agents:

- More powerful features
- Cleaner architecture
- Better scalability
- ~2-3 days effort

### Option B: Hybrid Approach

Keep current chat, add Agents for specific features:

- Quiz generation agent
- Learning path agent
- Keep simpler chat as-is
- ~1-2 days effort

---

## Files to Create for Agents

```
convex/agents/
├── tutorAgent.ts       # Main tutor agent
├── quizAgent.ts        # Quiz generation agent
├── learningPathAgent.ts # Personalization agent
└── tools/
    ├── ragTools.ts     # RAG search tools
    ├── progressTools.ts # Student progress tools
    └── quizTools.ts    # Quiz generation tools

hooks/
├── use-tutor-agent.ts  # React hook for tutor
└── use-agent-chat.ts   # Generic agent chat hook

components/chat/
├── agent-chat-view.tsx # Agent-based chat UI
└── agent-message.tsx   # Message with tool results
```

---

## Cost Addition for Agents

Agents add minimal cost because:

- Same LLM calls as current (Gemini)
- Thread storage in Convex (included)
- Tool calls use existing data

**Additional cost: ~$0/month** (uses same LLM budget)

---

## Summary: RAG + Agents

| Component    | Purpose                          | Cost     | Effort   |
| ------------ | -------------------------------- | -------- | -------- |
| **RAG**      | Store & search textbook content  | ~$1/day  | 1-2 days |
| **Agents**   | Manage conversations, call tools | $0 extra | 2-3 days |
| **Together** | Intelligent tutoring system      | ~$1/day  | 3-5 days |

---

# Previous Content: Production Architecture

## Executive Summary

- **Target Scale**: 1M total users, 100-200K DAU
- **Cost**: ~$0.03/user/month ($5,500/month at 200K DAU)
- **Ops Burden**: Minimal (fully serverless)
- **Launch**: Fast (government partnership)

---

## Complete Production Tech Stack

### Frontend Layer

| Component            | Technology                  | Purpose                           |
| -------------------- | --------------------------- | --------------------------------- |
| Framework            | **Next.js 15** (App Router) | Server components, API routes     |
| UI Library           | **shadcn/ui** + Tailwind v4 | Consistent, accessible components |
| Internationalization | **next-intl**               | Mongolian/English support         |
| State Management     | **React hooks** + Convex    | Real-time reactive state          |
| Theme                | **next-themes**             | Dark/light mode                   |
| Toast Notifications  | **Sonner**                  | User feedback                     |

### Backend/Database Layer

| Component    | Technology         | Purpose                                          |
| ------------ | ------------------ | ------------------------------------------------ |
| Database     | **Convex**         | Real-time DB, file storage, serverless functions |
| Caching      | **Upstash Redis**  | Rate limiting, response caching                  |
| File Storage | **Convex Storage** | PDFs, images, thumbnails                         |

### Authentication Layer

| Component          | Technology         | Purpose              |
| ------------------ | ------------------ | -------------------- |
| Auth Provider      | **WorkOS AuthKit** | Free up to 1M MAU    |
| Session Management | JWT tokens         | Stateless auth       |
| OAuth              | Google, Facebook   | Social login options |

### AI/ML Layer

| Component      | Technology           | Purpose                        |
| -------------- | -------------------- | ------------------------------ |
| LLM Router     | **OpenRouter**       | Multi-model support, fallbacks |
| Primary LLM    | **Gemini 2.5 Flash** | Text chat, vision (cheap)      |
| Fallback LLM   | **DeepSeek V3**      | If Gemini fails                |
| Speech-to-Text | **Chimege API**      | Mongolian voice input          |
| Text-to-Speech | **Chimege API**      | (Future) Voice responses       |

### Infrastructure Layer

| Component  | Technology                   | Purpose                      |
| ---------- | ---------------------------- | ---------------------------- |
| Hosting    | **Vercel**                   | Edge functions, auto-scaling |
| CDN        | **Vercel Edge Network**      | Global distribution          |
| Domain/DNS | **Vercel** or **Cloudflare** | Fast DNS resolution          |

### Monitoring & Analytics

| Component      | Technology               | Purpose                    |
| -------------- | ------------------------ | -------------------------- |
| Error Tracking | **Sentry**               | Exception monitoring       |
| Analytics      | **PostHog**              | User behavior, usage stats |
| Logs           | **Vercel Logs**          | Request/error logs         |
| Uptime         | **Better Uptime** (free) | Downtime alerts            |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USERS                                       │
│                    (Mobile/Desktop Browser)                              │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         VERCEL EDGE                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                      │
│  │ middleware  │  │  Next.js    │  │  API Routes │                      │
│  │ (rate limit)│  │  App Router │  │  /api/chat  │                      │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                      │
└─────────┼────────────────┼────────────────┼─────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────┐  ┌───────────┐  ┌──────────────────────────────────────┐
│  UPSTASH REDIS  │  │  CONVEX   │  │           AI SERVICES                │
│  ┌───────────┐  │  │  ┌─────┐  │  │  ┌──────────┐  ┌──────────────┐     │
│  │Rate Limit │  │  │  │ DB  │  │  │  │OpenRouter│  │   Chimege    │     │
│  │LLM Cache  │  │  │  │Files│  │  │  │(Gemini)  │  │   (STT)      │     │
│  └───────────┘  │  │  │Auth │  │  │  └──────────┘  └──────────────┘     │
└─────────────────┘  │  └─────┘  │  └──────────────────────────────────────┘
                     └───────────┘
                           │
                           ▼
                     ┌───────────┐
                     │  WORKOS   │
                     │  AuthKit  │
                     └───────────┘
```

---

## Data Flow: Chat Message

```
1. User types message
   │
2. ├─→ [Edge] Rate limit check (Upstash Redis)
   │    └─→ Reject if exceeded (show "Бага хүлээнэ үү")
   │
3. ├─→ [Edge] Auth check (WorkOS JWT)
   │
4. ├─→ [Cache] Check for cached response (Upstash Redis)
   │    └─→ Return cached if exists
   │
5. ├─→ [Convex] Fetch user context (weak topics, textbook ref)
   │
6. ├─→ [OpenRouter] Send to Gemini 2.5 Flash
   │    └─→ Stream response back
   │
7. ├─→ [Cache] Store response in cache (24h TTL)
   │
8. └─→ [Convex] Save message to conversation (batched)
```

---

## Data Flow: Voice Input

```
1. User records audio (max 60 seconds)
   │
2. ├─→ [Client] Validate audio (>0.5s, has sound)
   │
3. ├─→ [Edge] Rate limit check (Upstash Redis)
   │
4. ├─→ [API] Send to Chimege STT
   │    └─→ Get Mongolian text transcription
   │
5. └─→ Continue to Chat Message flow (step 4)
```

---

## Database Schema (Convex)

### Core Tables

```typescript
// Users (synced from WorkOS)
users: {
  workosId: string,
  email: string,
  displayName: string,
  role: "admin" | "teacher" | "student",
  schoolId: optional(string),
  createdAt: number,
}

// Conversations
conversations: {
  userId: string,  // workosId
  title: string,
  model: "gemini" | "openai",
  messageCount: number,
  createdAt: number,
  updatedAt: number,
}

// Messages
messages: {
  conversationId: Id<"conversations">,
  role: "user" | "assistant",
  content: string,
  model: string,
  imageId: optional(Id<"_storage">),
  createdAt: number,
}

// Textbooks
textbooks: {
  subjectName: string,
  grade: number,
  year: number,
  type: "required" | "optional",
  pdfFileId: Id<"_storage">,
  thumbnailId: optional(Id<"_storage">),
  tableOfContents: array(TOCItem),
  extractedText: optional(string),
}

// Topic Mastery (for personalization)
topicMastery: {
  userId: string,
  subjectName: string,
  topicTitle: string,
  masteryLevel: "beginner" | "intermediate" | "advanced" | "mastered",
  totalInteractions: number,
  correctAnswers: number,
  lastInteractionAt: number,
}

// Learning Interactions (batched writes)
learningInteractions: {
  userId: string,
  subjectName: string,
  topicTitle: string,
  interactionType: "question" | "quiz" | "explanation",
  isCorrect: optional(boolean),
  timestamp: number,
}
```

### Indexes for Performance

```typescript
// Users
by_workosId: ["workosId"];
by_role: ["role"];

// Conversations
by_user: ["userId"];
by_user_updated: ["userId", "updatedAt"];

// Messages
by_conversation: ["conversationId"];

// Textbooks
by_grade: ["grade"];
by_subject_grade: ["subjectName", "grade"];

// Topic Mastery
by_user: ["userId"];
by_user_subject: ["userId", "subjectName"];
```

---

## API Routes

### Public Routes (No Auth)

- `GET /` - Landing page
- `GET /sign-in` - WorkOS login
- `GET /sign-up` - WorkOS signup
- `GET /api/webhooks/workos` - User sync webhook

### Protected Routes (Require Auth)

- `GET /chat` - Chat interface
- `GET /chat/c/[id]` - Specific conversation
- `POST /api/chat` - Send message (streaming)
- `POST /api/chimege` - STT transcription
- `POST /api/extract-pdf` - PDF text extraction

### Admin Routes (Role: admin/teacher)

- `GET /student-info` - Student management
- `GET /teacher-info` - Teacher management
- `GET /textbook` - Textbook management
- `GET /analytics` - Usage dashboard

---

## Environment Variables

### Required for Production

```env
# App
NEXT_PUBLIC_APP_URL=https://your-domain.mn

# WorkOS Auth
WORKOS_API_KEY=sk_live_xxx
WORKOS_CLIENT_ID=client_xxx
NEXT_PUBLIC_WORKOS_CLIENT_ID=client_xxx
WORKOS_REDIRECT_URI=https://your-domain.mn/api/auth/callback
WORKOS_WEBHOOK_SECRET=whsec_xxx

# Convex
CONVEX_DEPLOYMENT=prod:your-app
NEXT_PUBLIC_CONVEX_URL=https://your-app.convex.cloud

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx

# LLM (OpenRouter)
OPENROUTER_API_KEY=sk-or-xxx

# Chimege
CHIMEGE_STT_API_KEY=xxx
CHIMEGE_TTS_API_KEY=xxx

# Monitoring
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_AUTH_TOKEN=sntrys_xxx
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

## Rate Limiting Configuration

### Edge Rate Limits (Upstash)

```typescript
// middleware.ts
const rateLimits = {
  // Per IP (DDoS protection)
  perIP: {
    rate: 100, // requests
    window: "60s", // per minute
  },

  // Per User (abuse protection)
  perUser: {
    chat: {
      rate: 30, // messages
      window: "60s", // per minute
    },
    voice: {
      rate: 10, // STT requests
      window: "60s", // per minute
    },
    upload: {
      rate: 5, // file uploads
      window: "60s", // per minute
    },
  },

  // Global (system protection)
  global: {
    rate: 10000, // total requests
    window: "60s", // per minute
  },
};
```

### Convex Rate Limits (Backup)

```typescript
// convex/rateLimits.ts
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  sendMessage: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 30 },
  fileUpload: { kind: "token bucket", rate: 5, period: MINUTE, capacity: 5 },
  pdfExtraction: { kind: "fixed window", rate: 2, period: HOUR },
  sttRequest: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 10 },
});
```

---

## Caching Strategy

### LLM Response Cache (Upstash Redis)

```typescript
// Cache key generation
const cacheKey = `chat:${hash(
  JSON.stringify({
    subject: textbookContext?.subjectName,
    grade: textbookContext?.grade,
    question: normalizeQuestion(lastMessage),
  }),
)}`;

// Cache config
const cacheConfig = {
  ttl: 86400, // 24 hours
  maxSize: "10MB", // per cached response
  hitThreshold: 3, // only cache after 3 identical questions
};
```

### What to Cache

- ✅ Common educational questions
- ✅ Textbook explanations (same chapter = same response)
- ❌ Personalized responses (include weak topics)
- ❌ Image analysis (too unique)
- ❌ Conversation continuations

---

## Error Handling & Graceful Degradation

### Failure Scenarios

| Failure               | User Experience                                | Auto-Recovery      |
| --------------------- | ---------------------------------------------- | ------------------ |
| Gemini timeout (>30s) | "Холболт удааширлаа. Дахин оролдоно уу."       | Auto-retry 1x      |
| Gemini down           | Switch to DeepSeek automatically               | Fallback chain     |
| Chimege STT down      | "Дуу хөрвүүлэлт боломжгүй. Текстээр бичнэ үү." | Text-only mode     |
| Convex slow           | Show cached data + loading spinner             | Optimistic updates |
| Rate limit hit        | "Бага хүлээнэ үү (30 секунд)" + countdown      | Auto-unlock        |

### LLM Fallback Chain

```typescript
const modelFallbackChain = [
  { provider: "google", model: "gemini-2.5-flash" },
  { provider: "deepseek", model: "deepseek-v3" },
  { provider: "openai", model: "gpt-4o-mini" }, // expensive, last resort
];
```

---

## Security Configuration

### Content Security Policy

```typescript
// next.config.js
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline' *.vercel-scripts.com;
      style-src 'self' 'unsafe-inline';
      img-src 'self' blob: data: *.convex.cloud;
      font-src 'self';
      connect-src 'self' *.convex.cloud *.upstash.io *.workos.com *.openrouter.ai chimege.mn;
      frame-ancestors 'none';
    `.replace(/\n/g, ""),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "origin-when-cross-origin" },
];
```

### Input Validation

```typescript
// All user inputs validated with Zod
const chatMessageSchema = z.object({
  content: z.string().max(4000).min(1),
  imageUrl: z.string().startsWith("data:image/").optional(),
  textbookContext: z.string().max(10000).optional(),
  model: z.enum(["gemini", "openai"]),
});
```

---

## Monitoring & Alerts

### Sentry Configuration

```typescript
// sentry.client.config.ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1, // 10% of requests
  replaysSessionSampleRate: 0.01, // 1% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% on errors
});
```

### PostHog Events

```typescript
// Key events to track
posthog.capture("message_sent", { model, hasImage, hasVoice });
posthog.capture("voice_input_started");
posthog.capture("rate_limit_hit", { type });
posthog.capture("llm_fallback", { from, to });
posthog.capture("cache_hit", { type: "llm_response" });
```

### Uptime Alerts (Better Uptime)

- Monitor: `https://your-domain.mn/api/health`
- Check interval: 1 minute
- Alert channels: Email, Slack/Telegram

---

## Deployment Checklist

### Pre-Launch

- [ ] WorkOS configured with production URLs
- [ ] All environment variables set in Vercel
- [ ] Convex deployed to production
- [ ] Upstash Redis provisioned
- [ ] Sentry project created
- [ ] PostHog project configured
- [ ] Domain DNS configured
- [ ] SSL certificate active

### Launch Day

- [ ] Test auth flow end-to-end
- [ ] Test chat with all models
- [ ] Test voice input
- [ ] Test image upload
- [ ] Verify rate limiting works
- [ ] Check error tracking in Sentry
- [ ] Monitor Convex dashboard
- [ ] Monitor Upstash dashboard

### Post-Launch (First 48 Hours)

- [ ] Monitor error rates in Sentry
- [ ] Check usage patterns in PostHog
- [ ] Review LLM costs in OpenRouter
- [ ] Adjust rate limits if needed
- [ ] Address any user-reported issues

---

## Cost Summary by Scale

| DAU  | Monthly Cost | Per User |
| ---- | ------------ | -------- |
| 10K  | $345         | $0.035   |
| 50K  | $1,435       | $0.029   |
| 100K | $2,825       | $0.028   |
| 200K | $5,525       | $0.028   |
| 500K | $13,650      | $0.027   |
| 1M   | $27,150      | $0.027   |

---

## Implementation Priority

### Phase 1: Auth Migration (1-2 days)

1. Set up WorkOS AuthKit
2. Create webhook for user sync to Convex
3. Update middleware for new auth
4. Test auth flow thoroughly

### Phase 2: Caching Layer (2-3 days)

1. Set up Upstash Redis
2. Implement edge rate limiting
3. Add LLM response caching
4. Test rate limiting behavior

### Phase 3: Database Optimization (2-3 days)

1. Batch learning interaction writes
2. Add pagination to analytics queries
3. Optimize topic mastery updates

### Phase 4: LLM Optimization (1-2 days)

1. Switch to Gemini 2.5 Flash everywhere
2. Add fallback chain
3. Implement streaming timeout
4. Test cache hit rates

### Phase 5: Monitoring (1 day)

1. Configure Sentry alerts
2. Set up PostHog dashboards
3. Add uptime monitoring
4. Create runbook for incidents

**Total Estimated Time: 2-3 weeks**

---

## Files to Create/Modify

### New Files

```
lib/upstash.ts              # Redis client
lib/rate-limit.ts           # Edge rate limiting
lib/llm-cache.ts            # Response caching
lib/workos.ts               # WorkOS client
app/api/auth/callback/route.ts  # WorkOS callback
app/api/webhooks/workos/route.ts # User sync
convex/batchLearning.ts     # Batched writes
```

### Modified Files

```
middleware.ts               # Add rate limiting
app/api/chat/route.ts       # Add caching, timeout, fallback
convex/learningInteractions.ts  # Batch writes
convex/usageEvents.ts       # Pagination
convex/users.ts             # WorkOS integration
```

---

## Developer Operations Stack

### Code Quality & Review

| Tool                       | Purpose                   | Cost                        |
| -------------------------- | ------------------------- | --------------------------- |
| **GitHub**                 | Code hosting, PRs, issues | Free (public) or $4/user    |
| **GitHub Actions**         | CI/CD pipelines           | Free (2000 min/mo)          |
| **Vercel Preview Deploys** | Preview every PR          | Included                    |
| **ESLint + Prettier**      | Code formatting           | Free                        |
| **TypeScript**             | Type safety               | Free                        |
| **CodeRabbit**             | AI code review            | Free (open source) / $15/mo |

### Automated Code Review (CodeRabbit)

**Why CodeRabbit for Solo Developer:**

- AI reviews every PR automatically (like having a senior dev review your code)
- Catches bugs, security issues, performance problems
- Suggests improvements based on best practices
- Free for public repos, $15/month for private

**What CodeRabbit Reviews:**

| Category           | What It Catches                                        |
| ------------------ | ------------------------------------------------------ |
| **Security**       | SQL injection, XSS, exposed secrets, auth issues       |
| **Performance**    | N+1 queries, memory leaks, slow patterns               |
| **Code Quality**   | Unused code, complexity, naming conventions            |
| **Best Practices** | React patterns, TypeScript idioms, Next.js conventions |
| **Bugs**           | Logic errors, null checks, type mismatches             |

**How It Works:**

```
1. You create a PR
           ↓
2. CodeRabbit automatically reviews (within 2-3 minutes)
           ↓
3. Adds inline comments on problematic lines
           ↓
4. Provides summary with severity levels
           ↓
5. You fix issues and push again
           ↓
6. CodeRabbit re-reviews automatically
```

**Example CodeRabbit Review:**

```markdown
## Summary

This PR adds rate limiting to the chat API. Overall looks good with a few suggestions.

### Issues Found

⚠️ **Security (High)**: API key exposed in client-side code (line 45)
⚠️ **Performance (Medium)**: N+1 query in user lookup (line 78)
💡 **Suggestion**: Consider using `useMemo` for expensive computation (line 102)

### Files Reviewed

- `app/api/chat/route.ts` ✅ (2 issues)
- `lib/rate-limit.ts` ✅ (1 suggestion)
```

**Setup (5 minutes):**

1. Go to https://coderabbit.ai
2. Connect GitHub account
3. Select repository
4. CodeRabbit starts reviewing all new PRs automatically

**Alternative Options:**

| Tool           | Best For                | Cost               |
| -------------- | ----------------------- | ------------------ |
| **CodeRabbit** | AI review (recommended) | Free / $15/mo      |
| **SonarCloud** | Code quality metrics    | Free (open source) |
| **Codacy**     | Security scanning       | Free (open source) |
| **DeepSource** | Auto-fix suggestions    | Free / $12/mo      |

**Recommendation**: Use **CodeRabbit** as primary (AI review) + **SonarCloud** (quality metrics) for comprehensive coverage. Both free for open source.

---

### Security Scanning Services

For a production app handling student data, you need multiple layers of security checks:

#### 1. Dependency Vulnerability Scanning

**GitHub Dependabot (Free - Built-in)**

Automatically scans `package.json` for vulnerable packages and creates PRs to update them.

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

**What It Catches:**

- Known CVEs in npm packages
- Outdated packages with security fixes
- Transitive dependency vulnerabilities

---

**Snyk (Free tier: 200 tests/month)**

More comprehensive than Dependabot:

| Feature             | Dependabot | Snyk     |
| ------------------- | ---------- | -------- |
| Dependency scanning | ✅         | ✅       |
| License compliance  | ❌         | ✅       |
| Container scanning  | ❌         | ✅       |
| Code scanning       | ❌         | ✅       |
| Fix suggestions     | Basic      | Detailed |

**Setup:**

```yaml
# .github/workflows/security.yml
- name: Run Snyk
  uses: snyk/actions/node@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

---

#### 2. Secret Scanning

**GitHub Secret Scanning (Free - Built-in)**

Automatically detects exposed secrets in code:

- API keys (OpenAI, Stripe, etc.)
- Database credentials
- Private keys
- OAuth tokens

**Enable:** Settings → Security → Secret scanning → Enable

**Pre-commit Hook (Extra Layer):**

```bash
# Install gitleaks locally
brew install gitleaks

# Add to pre-commit
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

Prevents secrets from being committed in the first place.

---

#### 3. Static Application Security Testing (SAST)

**SonarCloud (Free for open source)**

Scans your code for:

- SQL injection patterns
- XSS vulnerabilities
- Path traversal
- Hardcoded credentials
- Insecure cryptography

**GitHub Action:**

```yaml
- name: SonarCloud Scan
  uses: SonarSource/sonarcloud-github-action@master
  env:
    SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

---

**Semgrep (Free tier: unlimited)**

Custom security rules for your stack:

```yaml
# .github/workflows/semgrep.yml
- name: Semgrep
  uses: returntocorp/semgrep-action@v1
  with:
    config: >-
      p/nextjs
      p/react
      p/typescript
      p/security-audit
```

**What Semgrep Catches for Next.js:**

- `dangerouslySetInnerHTML` without sanitization
- Missing CSRF protection
- Insecure cookies
- SQL injection in API routes
- Path traversal in file operations

---

#### 4. Runtime Security Headers

**Already in your plan (next.config.js):**

- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options

**Additional Headers to Add:**

```typescript
// middleware.ts
const securityHeaders = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Permissions-Policy": "camera=(), microphone=(self), geolocation=()",
  "X-XSS-Protection": "1; mode=block",
};
```

---

#### 5. API Security Scanning

**For your API routes**, implement in CI:

```yaml
# .github/workflows/api-security.yml
- name: OWASP ZAP API Scan
  uses: zaproxy/action-api-scan@v0.5.0
  with:
    target: "https://preview-xxx.vercel.app"
    rules_file_name: ".zap/rules.tsv"
```

**What ZAP Checks:**

- Authentication bypass
- Injection vulnerabilities
- Broken access control
- Security misconfiguration

---

#### Complete Security Stack Summary

| Tool                       | Purpose                | Cost          | When It Runs   |
| -------------------------- | ---------------------- | ------------- | -------------- |
| **Dependabot**             | Dependency CVEs        | Free          | Weekly         |
| **Snyk**                   | Deep dependency scan   | Free (200/mo) | Every PR       |
| **GitHub Secret Scanning** | Exposed secrets        | Free          | Every push     |
| **Gitleaks**               | Pre-commit secrets     | Free          | Before commit  |
| **SonarCloud**             | SAST code analysis     | Free          | Every PR       |
| **Semgrep**                | Next.js security rules | Free          | Every PR       |
| **OWASP ZAP**              | API security           | Free          | Weekly/Release |

---

#### Security CI Pipeline

```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: "0 0 * * 0" # Weekly

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Dependency scanning
      - name: Snyk Scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        continue-on-error: true

      # Secret scanning
      - name: Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # SAST
      - name: Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: p/nextjs p/react p/security-audit

      # SonarCloud
      - name: SonarCloud
        uses: SonarSource/sonarcloud-github-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

---

#### Security Checklist for Launch

**Pre-Launch:**

- [ ] Enable GitHub Dependabot
- [ ] Enable GitHub Secret Scanning
- [ ] Set up Snyk (connect to repo)
- [ ] Set up SonarCloud (connect to repo)
- [ ] Add Semgrep to CI
- [ ] Add security headers in middleware
- [ ] Test CSP doesn't break functionality

**Post-Launch (Monthly):**

- [ ] Review Dependabot PRs
- [ ] Check Snyk dashboard for new CVEs
- [ ] Review SonarCloud security hotspots
- [ ] Run OWASP ZAP scan on staging

---

#### Security Costs

| Tool                   | Cost                |
| ---------------------- | ------------------- |
| GitHub Dependabot      | Free                |
| GitHub Secret Scanning | Free                |
| Gitleaks               | Free                |
| Snyk                   | Free (200 tests/mo) |
| SonarCloud             | Free (open source)  |
| Semgrep                | Free                |
| OWASP ZAP              | Free                |
| **Total Security**     | **$0/month**        |

All security scanning is free for your use case!

### Git Workflow

```
main (production)
  └── develop (staging)
       └── feature/xxx (your branches)

PR → Auto Preview Deploy → Review → Merge → Auto Deploy to Prod
```

### CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run lint
      - run: bun run build # TypeScript check
      - run: bun run test # Unit tests
```

Vercel handles deployment automatically on merge to main.

---

### Error Tracking (Sentry)

**What Sentry Catches:**

- JavaScript runtime errors
- Unhandled promise rejections
- API route errors (500s)
- Performance issues (slow pages)

**Configuration:**

```typescript
// sentry.client.config.ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV, // production/preview/development

  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of transactions

  // Session replay (see what user did before error)
  replaysSessionSampleRate: 0.01, // 1% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% when error occurs

  // Filter noise
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Network request failed",
  ],
});
```

**Alert Rules (set in Sentry dashboard):**

- Error rate > 1% → Slack/Email alert
- New error type → Immediate alert
- P95 latency > 3s → Performance alert

**Cost:** Free tier (5K errors/month), then $26/month

---

### Logging (Structured)

**Where Logs Go:**

- **Vercel Logs** - All request/response logs (free, 1 hour retention)
- **Sentry** - Errors with full context
- **PostHog** - User events/analytics

**Structured Logging Pattern:**

```typescript
// lib/logger.ts
import * as Sentry from "@sentry/nextjs";

export const logger = {
  info: (message: string, data?: object) => {
    console.log(
      JSON.stringify({
        level: "info",
        message,
        ...data,
        timestamp: Date.now(),
      }),
    );
  },

  error: (message: string, error: Error, data?: object) => {
    console.error(
      JSON.stringify({
        level: "error",
        message,
        error: error.message,
        ...data,
      }),
    );
    Sentry.captureException(error, { extra: data });
  },

  warn: (message: string, data?: object) => {
    console.warn(JSON.stringify({ level: "warn", message, ...data }));
    Sentry.captureMessage(message, { level: "warning", extra: data });
  },
};

// Usage in API route
logger.info("Chat message received", { userId, model, hasImage: !!imageUrl });
logger.error("LLM request failed", error, { userId, model });
```

**For Long-term Log Storage (if needed later):**

- Axiom (free tier: 500MB/month)
- Logtail (free tier: 1GB/month)

---

### Uptime & Status Monitoring

**Option 1: Better Uptime (Recommended - Free)**

| Feature        | Details                     |
| -------------- | --------------------------- |
| Monitors       | 10 free                     |
| Check interval | 3 minutes                   |
| Alerts         | Email, Slack, SMS           |
| Status page    | Public status.yourdomain.mn |

**Setup:**

```
Monitor 1: https://yourdomain.mn (homepage)
Monitor 2: https://yourdomain.mn/api/health (API health)
Monitor 3: https://yourdomain.mn/api/chat (POST, expects 401)
```

**Health Endpoint:**

```typescript
// app/api/health/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const checks = {
    status: "ok",
    timestamp: Date.now(),
    services: {
      convex: "ok",
      upstash: "ok",
    },
  };

  // Quick health checks
  try {
    // Check Convex (optional, can be slow)
    // await convex.query(api.health.ping);

    // Check Upstash
    const redis = await getRedisClient();
    await redis.ping();
  } catch (error) {
    checks.status = "degraded";
    Sentry.captureException(error);
  }

  return NextResponse.json(checks, {
    status: checks.status === "ok" ? 200 : 503,
  });
}
```

**Public Status Page:**

- Better Uptime provides free hosted status page
- URL: status.yourdomain.mn
- Shows: Current status, incident history, uptime %

---

### Performance Monitoring

**Vercel Analytics (Built-in):**

- Web Vitals (LCP, FID, CLS)
- Page load times
- Geographic distribution
- Free with Vercel Pro

**PostHog (User-level):**

- Session recordings
- Funnel analysis
- Feature flags
- Free tier: 1M events/month

**What to Monitor:**

| Metric                 | Target | Alert Threshold |
| ---------------------- | ------ | --------------- |
| Chat API latency (P95) | < 3s   | > 5s            |
| Page load (LCP)        | < 2.5s | > 4s            |
| Error rate             | < 1%   | > 2%            |
| Uptime                 | 99.9%  | < 99.5%         |

---

### Alerting & On-Call

**For Solo Developer (Simple Setup):**

| Severity | Channel        | Example                 |
| -------- | -------------- | ----------------------- |
| Critical | SMS + Phone    | Site down, 5xx spike    |
| High     | Slack + Email  | Error rate > 2%         |
| Medium   | Email only     | New error type          |
| Low      | Dashboard only | Performance degradation |

**Tools:**

- **Better Uptime** - Uptime alerts (free)
- **Sentry** - Error alerts (free)
- **Vercel** - Deploy alerts (free)

**NOT needed yet (overkill for solo):**

- PagerDuty ($20/user/month)
- Opsgenie ($9/user/month)

---

### Debugging in Production

**When Things Break:**

1. **Check Vercel Dashboard**
   - Deployment logs
   - Function logs
   - Real-time log tail

2. **Check Sentry**
   - Error details with stack trace
   - Session replay (see what user did)
   - Affected users count

3. **Check Convex Dashboard**
   - Function execution logs
   - Database queries
   - Real-time logs

4. **Check Upstash Dashboard**
   - Rate limit hits
   - Cache hit/miss ratio
   - Request latency

**Debugging Checklist:**

```
□ Check Sentry for error details
□ Check Vercel logs for request/response
□ Check Convex logs for DB issues
□ Check Upstash for rate limit issues
□ Check OpenRouter dashboard for LLM issues
□ Check Chimege dashboard for STT issues
```

---

### Testing Strategy

**Unit Tests (Jest/Vitest):**

```typescript
// __tests__/lib/llm-cache.test.ts
describe("LLM Cache", () => {
  it("should generate consistent cache keys", () => {
    const key1 = generateCacheKey({
      subject: "math",
      grade: 10,
      question: "what is pi",
    });
    const key2 = generateCacheKey({
      subject: "math",
      grade: 10,
      question: "What is Pi?",
    });
    expect(key1).toBe(key2); // Should normalize
  });
});
```

**Integration Tests (Playwright):**

```typescript
// e2e/chat.spec.ts
test("should send and receive chat message", async ({ page }) => {
  await page.goto("/chat");
  await page.fill('[data-testid="chat-input"]', "Hello");
  await page.click('[data-testid="send-button"]');
  await expect(page.locator('[data-testid="message-assistant"]')).toBeVisible();
});
```

**Run Before Deploy:**

```yaml
# In CI
- run: bun run test # Unit tests
- run: bun run test:e2e # Integration tests (optional)
```

**Cost:** Free (all open source tools)

---

### Documentation & Runbooks

**What to Document:**

1. **README.md** - Setup, env vars, commands
2. **RUNBOOK.md** - Incident response procedures
3. **ARCHITECTURE.md** - System design (the plan file!)

**Runbook Template:**

```markdown
# Incident: Site is Down

## Detection

- Better Uptime alert
- User reports

## Diagnosis

1. Check Vercel status (vercel.com/status)
2. Check Convex status (convex.dev/status)
3. Check Sentry for errors
4. Check Vercel deployment logs

## Resolution

- If Vercel down: Wait for recovery
- If Convex down: Wait for recovery
- If code bug: Rollback via Vercel dashboard
- If rate limit: Increase limits in Upstash

## Post-Incident

- Update status page
- Write postmortem
- Fix root cause
```

---

### Complete DevOps Cost Summary

| Tool             | Purpose           | Cost                        |
| ---------------- | ----------------- | --------------------------- |
| GitHub           | Code hosting      | Free                        |
| GitHub Actions   | CI/CD             | Free                        |
| Vercel           | Hosting + Preview | $20/mo                      |
| Sentry           | Error tracking    | Free (5K errors/mo)         |
| PostHog          | Analytics         | Free (1M events/mo)         |
| Better Uptime    | Status monitoring | Free (10 monitors)          |
| CodeRabbit       | AI code review    | Free (open source) / $15/mo |
| SonarCloud       | Code quality      | Free (open source)          |
| **Total DevOps** |                   | **$20-35/month**            |

Everything else is included in Vercel Pro or free!

---

## Summary

This architecture is designed for:

- ✅ **1M total users** - WorkOS free tier covers it
- ✅ **200K DAU** - Convex + caching handles it
- ✅ **~$5,500/month at scale** - $0.028/user
- ✅ **Minimal ops** - All serverless, auto-scaling
- ✅ **Fast launch** - 2-3 weeks to production-ready
- ✅ **Single developer** - No infrastructure management needed
