import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List conversations for a user, ordered by most recent
export const list = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .order("desc")
      .collect();
  },
});

// Get a single conversation
export const get = query({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create a new conversation
export const create = mutation({
  args: {
    clerkUserId: v.string(),
    title: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("conversations", {
      clerkUserId: args.clerkUserId,
      title: args.title,
      model: args.model,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update conversation title
export const updateTitle = mutation({
  args: {
    id: v.id("conversations"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

// Touch updatedAt (e.g., when a new message is added)
export const touch = mutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { updatedAt: Date.now() });
  },
});

// Delete conversation and all its messages
export const remove = mutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
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
