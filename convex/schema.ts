import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(), // Clerk user ID
    email: v.string(), // From Clerk
    imageUrl: v.optional(v.string()), // Profile image URL
    displayName: v.string(), // Editable display name
    username: v.optional(v.string()), // Editable username
    role: v.optional(
      v.union(v.literal("admin"), v.literal("teacher"), v.literal("student"))
    ),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  teachers: defineTable({
    lastName: v.string(),
    firstName: v.string(),
    grade: v.number(), // 1-12
    group: v.string(), // А, Б, В, Г, Д, etc.
    phone1: v.string(),
    phone2: v.optional(v.string()),
    // Optional for backward compatibility with existing data
    // Run migrations.addStatusToTeachers to populate existing records
    status: v.optional(v.union(v.literal("active"), v.literal("deleted"))),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_grade", ["grade"])
    .index("by_status", ["status"]),

  students: defineTable({
    lastName: v.string(),
    firstName: v.string(),
    grade: v.number(), // 1-12
    group: v.string(), // А, Б, В, Г, Д, etc.
    phone1: v.string(),
    phone2: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("deleted"))),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_grade", ["grade"])
    .index("by_status", ["status"]),

  textbooks: defineTable({
    subjectName: v.string(),
    grade: v.number(),
    year: v.number(),
    type: v.string(),
    isValid: v.boolean(),
    pdfFileId: v.id("_storage"),
    thumbnailId: v.id("_storage"),
    notes: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("deleted"))),
    // PDF text extraction for RAG
    extractedText: v.optional(v.string()),
    textExtractionStatus: v.optional(
      v.union(v.literal("pending"), v.literal("completed"), v.literal("failed"))
    ),
    textExtractionError: v.optional(v.string()),
    // Table of Contents
    tableOfContents: v.optional(
      v.array(
        v.object({
          id: v.string(),
          order: v.number(),
          title: v.string(), // "Бүлэг 1", "Бүлэг 2", etc.
          description: v.string(), // Chapter content name
          topics: v.array(
            v.object({
              id: v.string(),
              order: v.number(),
              title: v.string(),
              page: v.number(),
            })
          ),
        })
      )
    ),
    tocExtractionStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("manual")
      )
    ),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_grade", ["grade"])
    .index("by_subject", ["subjectName"])
    .index("by_status", ["status"]),

  // Chat conversations
  conversations: defineTable({
    clerkUserId: v.string(),
    title: v.string(),
    model: v.string(), // "openai" | "gemini"
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["clerkUserId"])
    .index("by_updated", ["updatedAt"]),

  // Chat messages
  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system")
    ),
    content: v.string(),
    model: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId"]),

  // Login history for security tab - populated by Clerk webhooks
  loginHistory: defineTable({
    clerkUserId: v.string(),
    sessionId: v.string(),
    event: v.union(v.literal("login"), v.literal("logout")),
    deviceType: v.optional(v.string()),
    browserName: v.optional(v.string()),
    browserVersion: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    isMobile: v.optional(v.boolean()),
    timestamp: v.number(),
  })
    .index("by_clerk_user", ["clerkUserId"])
    .index("by_session", ["sessionId"]),

  // Recently viewed textbooks per user (max 3, FIFO)
  recentTextbooks: defineTable({
    clerkUserId: v.string(),
    textbookId: v.id("textbooks"),
    viewedAt: v.number(),
  })
    .index("by_user", ["clerkUserId"])
    .index("by_user_textbook", ["clerkUserId", "textbookId"]),

  // Learning interactions for student progress tracking
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

  // Topic mastery aggregation
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
    lastInteractionAt: v.number(),
  })
    .index("by_user", ["clerkUserId"])
    .index("by_user_subject", ["clerkUserId", "subjectName"])
    .index("by_mastery", ["clerkUserId", "masteryLevel"]),

  // Overall student progress
  studentProgress: defineTable({
    clerkUserId: v.string(),
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
  }).index("by_user", ["clerkUserId"]),

  // Learning paths for personalization
  learningPaths: defineTable({
    clerkUserId: v.string(),
    subjectName: v.string(),
    grade: v.number(),
    currentLevel: v.string(),
    completedTopics: v.array(v.string()),
    currentTopicId: v.optional(v.string()),
    recommendedNextTopics: v.array(
      v.object({
        topicId: v.string(),
        topicTitle: v.string(),
        reason: v.string(),
        priority: v.number(),
      })
    ),
    updatedAt: v.number(),
  })
    .index("by_user", ["clerkUserId"])
    .index("by_user_subject", ["clerkUserId", "subjectName"]),

  // Usage events for monitoring and anomaly detection
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
});
