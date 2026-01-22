import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

// Get current authenticated user
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
  },
});

// Get user by Clerk ID
export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

// Store/update current user (called on login or settings open)
export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (user) {
      // Update existing user if name changed
      if (user.displayName !== identity.name) {
        await ctx.db.patch(user._id, {
          displayName: identity.name || user.displayName,
          imageUrl: identity.pictureUrl,
          updatedAt: Date.now(),
        });
      }
      return user._id;
    }

    // Create new user
    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      email: identity.email!,
      displayName: identity.name || "User",
      imageUrl: identity.pictureUrl,
      createdAt: Date.now(),
    });
  },
});

// Update profile settings
export const updateProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
    username: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      ...(args.displayName && { displayName: args.displayName }),
      ...(args.username !== undefined && { username: args.username }),
      updatedAt: Date.now(),
    });
  },
});

// Internal mutation for webhook (optional)
export const upsertFromClerk = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    displayName: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (user) {
      await ctx.db.patch(user._id, {
        email: args.email,
        displayName: args.displayName,
        imageUrl: args.imageUrl,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("users", {
        ...args,
        createdAt: Date.now(),
      });
    }
  },
});
