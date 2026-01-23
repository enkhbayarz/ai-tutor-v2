import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { rateLimiter } from "./rateLimits";

// List messages for a conversation (with ownership check)
export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    // Verify conversation ownership
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.clerkUserId !== identity.subject) {
      return [];
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();

    return Promise.all(
      messages.map(async (msg) => ({
        ...msg,
        imageUrl: msg.imageId
          ? await ctx.storage.getUrl(msg.imageId)
          : null,
      }))
    );
  },
});

// Send (create) a new message (with auth + rate limiting + ownership check)
export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system")
    ),
    content: v.string(),
    model: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    // Verify conversation ownership
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.clerkUserId !== identity.subject) {
      throw new Error("Conversation not found");
    }

    // Rate limit user messages only (not assistant responses)
    if (args.role === "user") {
      const { ok, retryAfter } = await rateLimiter.limit(ctx, "sendMessage", {
        key: identity.subject,
      });
      if (!ok) {
        throw new Error(
          `Rate limited. Try again in ${Math.ceil((retryAfter ?? 0) / 1000)}s.`
        );
      }
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: args.role,
      content: args.content,
      model: args.model,
      imageId: args.imageId,
      createdAt: Date.now(),
    });

    // Track usage for user messages
    if (args.role === "user") {
      await ctx.db.insert("usageEvents", {
        clerkUserId: identity.subject,
        eventType: args.imageId ? "image_analysis" : "chat_message",
        model: args.model,
        timestamp: Date.now(),
      });
    }

    return messageId;
  },
});

// Generate upload URL for image attachments (with auth + rate limiting)
export const generateUploadUrl = mutation(async (ctx) => {
  const identity = await requireAuth(ctx);

  // Rate limit file uploads
  const { ok, retryAfter } = await rateLimiter.limit(ctx, "fileUpload", {
    key: identity.subject,
  });
  if (!ok) {
    throw new Error(
      `Upload rate limited. Try again in ${Math.ceil((retryAfter ?? 0) / 1000)}s.`
    );
  }

  // Track file upload usage
  await ctx.db.insert("usageEvents", {
    clerkUserId: identity.subject,
    eventType: "file_upload",
    timestamp: Date.now(),
  });

  return await ctx.storage.generateUploadUrl();
});

// Get image URL from storage ID
export const getImageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.storage.getUrl(args.storageId);
  },
});
