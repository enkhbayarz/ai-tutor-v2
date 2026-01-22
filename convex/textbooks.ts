import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// List active textbooks
export const list = query({
  args: {},
  handler: async (ctx) => {
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

// Get single textbook by ID
export const getById = query({
  args: { id: v.id("textbooks") },
  handler: async (ctx, args) => {
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

// Generate upload URL for files
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
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

// Create textbook
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
    const textbookId = await ctx.db.insert("textbooks", {
      ...args,
      status: "active",
      createdAt: Date.now(),
    });
    return textbookId;
  },
});

// Update textbook
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

// Soft delete textbook
export const softDelete = mutation({
  args: { id: v.id("textbooks") },
  handler: async (ctx, args) => {
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

// Delete file from storage
export const deleteFile = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await ctx.storage.delete(args.storageId);
  },
});
