import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireRole } from "./lib/auth";
import { rateLimiter } from "./rateLimits";

// List active textbooks (all authenticated users)
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    const textbooks = await ctx.db
      .query("textbooks")
      .filter((q) => q.neq(q.field("status"), "deleted"))
      .collect();

    // Get file URLs for each textbook
    const textbooksWithUrls = await Promise.all(
      textbooks.map(async (textbook) => {
        const pdfUrl = await ctx.storage.getUrl(textbook.pdfFileId);
        const thumbnailUrl = await ctx.storage.getUrl(textbook.thumbnailId);
        return {
          ...textbook,
          pdfUrl,
          thumbnailUrl,
        };
      })
    );

    return textbooksWithUrls;
  },
});

// List active textbooks with optional grade/subject filters (for chat panel)
export const listActive = query({
  args: {
    grade: v.optional(v.number()),
    subject: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    let textbooks;

    if (args.grade) {
      textbooks = await ctx.db
        .query("textbooks")
        .withIndex("by_grade", (q) => q.eq("grade", args.grade!))
        .collect();
    } else {
      textbooks = await ctx.db.query("textbooks").collect();
    }

    // Filter out deleted and apply subject filter
    textbooks = textbooks.filter((t) => {
      if (t.status === "deleted") return false;
      if (args.subject && t.subjectName !== args.subject) return false;
      return true;
    });

    // Get thumbnail URLs
    const results = await Promise.all(
      textbooks.map(async (t) => {
        const thumbnailUrl = await ctx.storage.getUrl(t.thumbnailId);
        return {
          _id: t._id,
          subjectName: t.subjectName,
          grade: t.grade,
          thumbnailUrl,
        };
      })
    );

    return results;
  },
});

// Get single textbook by ID (all authenticated users)
export const getById = query({
  args: { id: v.id("textbooks") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const textbook = await ctx.db.get(args.id);
    if (!textbook || textbook.status === "deleted") {
      return null;
    }

    const pdfUrl = await ctx.storage.getUrl(textbook.pdfFileId);
    const thumbnailUrl = await ctx.storage.getUrl(textbook.thumbnailId);

    return {
      ...textbook,
      pdfUrl,
      thumbnailUrl,
    };
  },
});

// Generate upload URL for files (admin/teacher only)
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin", "teacher"]);
    return await ctx.storage.generateUploadUrl();
  },
});

// Get file URL
export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Create textbook (admin/teacher only)
export const create = mutation({
  args: {
    subjectName: v.string(),
    grade: v.number(),
    year: v.number(),
    type: v.string(),
    isValid: v.boolean(),
    pdfFileId: v.id("_storage"),
    thumbnailId: v.id("_storage"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const textbookId = await ctx.db.insert("textbooks", {
      ...args,
      status: "active",
      createdAt: Date.now(),
    });
    return textbookId;
  },
});

// Update textbook (admin/teacher only)
export const update = mutation({
  args: {
    id: v.id("textbooks"),
    subjectName: v.string(),
    grade: v.number(),
    year: v.number(),
    type: v.string(),
    isValid: v.boolean(),
    pdfFileId: v.id("_storage"),
    thumbnailId: v.id("_storage"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const { id, ...data } = args;

    // Get existing textbook to check for file changes
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Textbook not found");
    }

    // Delete old files if they changed
    if (existing.pdfFileId !== data.pdfFileId) {
      await ctx.storage.delete(existing.pdfFileId);
    }
    if (existing.thumbnailId !== data.thumbnailId) {
      await ctx.storage.delete(existing.thumbnailId);
    }

    await ctx.db.patch(id, {
      ...data,
      updatedAt: Date.now(),
    });
  },
});

// Soft delete textbook (admin/teacher only)
export const softDelete = mutation({
  args: { id: v.id("textbooks") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const textbook = await ctx.db.get(args.id);
    if (!textbook) {
      throw new Error("Textbook not found");
    }

    // Delete associated files
    await ctx.storage.delete(textbook.pdfFileId);
    await ctx.storage.delete(textbook.thumbnailId);

    await ctx.db.patch(args.id, {
      status: "deleted",
      updatedAt: Date.now(),
    });
  },
});

// Delete file from storage (admin/teacher only)
export const deleteFile = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    await ctx.storage.delete(args.storageId);
  },
});

// ============================================
// PDF Text Extraction for RAG
// ============================================

// Internal query to get textbook by ID with PDF URL (used by action)
export const getByIdInternal = query({
  args: { id: v.id("textbooks") },
  handler: async (ctx, args) => {
    const textbook = await ctx.db.get(args.id);
    if (!textbook) return null;

    const pdfUrl = await ctx.storage.getUrl(textbook.pdfFileId);
    return {
      ...textbook,
      pdfUrl,
    };
  },
});

// TOC Chapter/Topic type validators for reuse
const tocTopicValidator = v.object({
  id: v.string(),
  order: v.number(),
  title: v.string(),
  page: v.number(),
});

const tocChapterValidator = v.object({
  id: v.string(),
  order: v.number(),
  title: v.string(), // "Бүлэг 1", "Бүлэг 2", etc.
  description: v.string(), // Chapter content name
  topics: v.array(tocTopicValidator),
});

// Update extracted text and status (admin/teacher only)
export const updateExtractedText = mutation({
  args: {
    id: v.id("textbooks"),
    extractedText: v.optional(v.string()),
    tableOfContents: v.optional(v.array(tocChapterValidator)),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const updateData: Record<string, unknown> = {
      extractedText: args.extractedText,
      textExtractionStatus: args.status,
      textExtractionError: args.error,
      updatedAt: Date.now(),
    };

    if (args.tableOfContents !== undefined) {
      updateData.tableOfContents = args.tableOfContents;
      updateData.tocExtractionStatus = args.status;
    }

    await ctx.db.patch(args.id, updateData);
  },
});

// ============================================
// Table of Contents CRUD Operations
// ============================================

// Update entire TOC (admin/teacher only)
export const updateTableOfContents = mutation({
  args: {
    id: v.id("textbooks"),
    tableOfContents: v.array(tocChapterValidator),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    await ctx.db.patch(args.id, {
      tableOfContents: args.tableOfContents,
      tocExtractionStatus: "manual",
      updatedAt: Date.now(),
    });
  },
});

// Add a new chapter (admin/teacher only)
export const addTOCChapter = mutation({
  args: {
    textbookId: v.id("textbooks"),
    chapter: v.object({
      title: v.string(),
      description: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const textbook = await ctx.db.get(args.textbookId);
    if (!textbook) throw new Error("Textbook not found");

    const currentTOC = textbook.tableOfContents || [];
    const newChapter = {
      id: crypto.randomUUID(),
      order: currentTOC.length,
      title: args.chapter.title,
      description: args.chapter.description,
      topics: [],
    };

    await ctx.db.patch(args.textbookId, {
      tableOfContents: [...currentTOC, newChapter],
      tocExtractionStatus: "manual",
      updatedAt: Date.now(),
    });

    return newChapter.id;
  },
});

// Update a chapter (admin/teacher only)
export const updateTOCChapter = mutation({
  args: {
    textbookId: v.id("textbooks"),
    chapterId: v.string(),
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const textbook = await ctx.db.get(args.textbookId);
    if (!textbook) throw new Error("Textbook not found");

    const updatedTOC = (textbook.tableOfContents || []).map((chapter) =>
      chapter.id === args.chapterId
        ? { ...chapter, title: args.title, description: args.description }
        : chapter
    );

    await ctx.db.patch(args.textbookId, {
      tableOfContents: updatedTOC,
      tocExtractionStatus: "manual",
      updatedAt: Date.now(),
    });
  },
});

// Save a chapter (add or update) with its topics (admin/teacher only)
export const saveTOCChapter = mutation({
  args: {
    textbookId: v.id("textbooks"),
    chapterId: v.optional(v.string()),
    title: v.string(),
    description: v.string(),
    topics: v.array(
      v.object({
        id: v.string(),
        order: v.number(),
        title: v.string(),
        page: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const textbook = await ctx.db.get(args.textbookId);
    if (!textbook) throw new Error("Textbook not found");

    const currentTOC = textbook.tableOfContents || [];

    let updatedTOC;
    if (args.chapterId) {
      // Update existing chapter
      updatedTOC = currentTOC.map((chapter) =>
        chapter.id === args.chapterId
          ? {
              ...chapter,
              title: args.title,
              description: args.description,
              topics: args.topics,
            }
          : chapter
      );
    } else {
      // Add new chapter
      const newChapter = {
        id: crypto.randomUUID(),
        order: currentTOC.length,
        title: args.title,
        description: args.description,
        topics: args.topics,
      };
      updatedTOC = [...currentTOC, newChapter];
    }

    await ctx.db.patch(args.textbookId, {
      tableOfContents: updatedTOC,
      tocExtractionStatus: "manual",
      updatedAt: Date.now(),
    });
  },
});

// Delete a chapter (admin/teacher only)
export const deleteTOCChapter = mutation({
  args: {
    textbookId: v.id("textbooks"),
    chapterId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const textbook = await ctx.db.get(args.textbookId);
    if (!textbook) throw new Error("Textbook not found");

    const updatedTOC = (textbook.tableOfContents || [])
      .filter((chapter) => chapter.id !== args.chapterId)
      .map((chapter, index) => ({ ...chapter, order: index }));

    await ctx.db.patch(args.textbookId, {
      tableOfContents: updatedTOC,
      tocExtractionStatus: "manual",
      updatedAt: Date.now(),
    });
  },
});

// Add a topic to a chapter (admin/teacher only)
export const addTOCTopic = mutation({
  args: {
    textbookId: v.id("textbooks"),
    chapterId: v.string(),
    topic: v.object({
      title: v.string(),
      page: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const textbook = await ctx.db.get(args.textbookId);
    if (!textbook) throw new Error("Textbook not found");

    const updatedTOC = (textbook.tableOfContents || []).map((chapter) => {
      if (chapter.id !== args.chapterId) return chapter;

      const newTopic = {
        id: crypto.randomUUID(),
        order: chapter.topics.length,
        title: args.topic.title,
        page: args.topic.page,
      };

      return {
        ...chapter,
        topics: [...chapter.topics, newTopic],
      };
    });

    await ctx.db.patch(args.textbookId, {
      tableOfContents: updatedTOC,
      tocExtractionStatus: "manual",
      updatedAt: Date.now(),
    });
  },
});

// Update a topic (admin/teacher only)
export const updateTOCTopic = mutation({
  args: {
    textbookId: v.id("textbooks"),
    chapterId: v.string(),
    topicId: v.string(),
    title: v.string(),
    page: v.number(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const textbook = await ctx.db.get(args.textbookId);
    if (!textbook) throw new Error("Textbook not found");

    const updatedTOC = (textbook.tableOfContents || []).map((chapter) => {
      if (chapter.id !== args.chapterId) return chapter;

      return {
        ...chapter,
        topics: chapter.topics.map((topic) =>
          topic.id === args.topicId
            ? {
                ...topic,
                title: args.title,
                page: args.page,
              }
            : topic
        ),
      };
    });

    await ctx.db.patch(args.textbookId, {
      tableOfContents: updatedTOC,
      tocExtractionStatus: "manual",
      updatedAt: Date.now(),
    });
  },
});

// Delete a topic (admin/teacher only)
export const deleteTOCTopic = mutation({
  args: {
    textbookId: v.id("textbooks"),
    chapterId: v.string(),
    topicId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const textbook = await ctx.db.get(args.textbookId);
    if (!textbook) throw new Error("Textbook not found");

    const updatedTOC = (textbook.tableOfContents || []).map((chapter) => {
      if (chapter.id !== args.chapterId) return chapter;

      return {
        ...chapter,
        topics: chapter.topics
          .filter((topic) => topic.id !== args.topicId)
          .map((topic, index) => ({ ...topic, order: index })),
      };
    });

    await ctx.db.patch(args.textbookId, {
      tableOfContents: updatedTOC,
      tocExtractionStatus: "manual",
      updatedAt: Date.now(),
    });
  },
});

