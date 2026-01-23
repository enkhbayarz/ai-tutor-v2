import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { rateLimiter } from "./rateLimits";

// List conversations for the authenticated user, ordered by most recent
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    return await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("clerkUserId", identity.subject))
      .order("desc")
      .collect();
  },
});

// Get a single conversation (with ownership check)
export const get = query({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const conversation = await ctx.db.get(args.id);
    if (!conversation || conversation.clerkUserId !== identity.subject) {
      return null;
    }
    return conversation;
  },
});

// Create a new conversation
export const create = mutation({
  args: {
    title: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = identity.subject;

    // Rate limit
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "sendMessage", {
      key: userId,
    });
    if (!ok) {
      throw new Error(
        `Rate limited. Try again in ${Math.ceil((retryAfter ?? 0) / 1000)}s.`
      );
    }

    const now = Date.now();
    return await ctx.db.insert("conversations", {
      clerkUserId: userId,
      title: args.title,
      model: args.model,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update conversation title (with ownership check)
export const updateTitle = mutation({
  args: {
    id: v.id("conversations"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const conversation = await ctx.db.get(args.id);
    if (!conversation || conversation.clerkUserId !== identity.subject) {
      throw new Error("Conversation not found");
    }
    await ctx.db.patch(args.id, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

// Touch updatedAt (with ownership check)
export const touch = mutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const conversation = await ctx.db.get(args.id);
    if (!conversation || conversation.clerkUserId !== identity.subject) {
      throw new Error("Conversation not found");
    }
    await ctx.db.patch(args.id, { updatedAt: Date.now() });
  },
});

// Delete conversation and all its messages (with ownership check)
export const remove = mutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const conversation = await ctx.db.get(args.id);
    if (!conversation || conversation.clerkUserId !== identity.subject) {
      throw new Error("Conversation not found");
    }

    // Delete all messages in this conversation
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.id)
      )
      .collect();

    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }

    // Delete the conversation
    await ctx.db.delete(args.id);
  },
});
