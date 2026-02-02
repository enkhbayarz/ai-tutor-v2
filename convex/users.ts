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

    // Get username from Clerk identity (for username-only users like students)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clerkUsername = (identity as any).preferred_username || (identity as any).username;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (user) {
      // Update existing user if name or username changed
      const updates: Record<string, unknown> = {};
      if (user.displayName !== identity.name && identity.name) {
        updates.displayName = identity.name;
      }
      if (identity.pictureUrl) {
        updates.imageUrl = identity.pictureUrl;
      }
      if (clerkUsername && user.username !== clerkUsername) {
        updates.username = clerkUsername;
      }
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = Date.now();
        await ctx.db.patch(user._id, updates);
      }
      return user._id;
    }

    // Create new user (email is optional for username-only users like students)
    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      email: identity.email || undefined,
      displayName: identity.name || clerkUsername || "User",
      username: clerkUsername,
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

// Set user role (admin bootstrap: if no admins exist, first caller becomes admin)
export const setRole = mutation({
  args: {
    role: v.union(v.literal("admin"), v.literal("teacher"), v.literal("student")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser) throw new Error("User not found");

    // If setting admin role, check if any admin exists
    if (args.role === "admin") {
      const allUsers = await ctx.db.query("users").collect();
      const existingAdmin = allUsers.find((u) => u.role === "admin");
      // Only allow if no admin exists (bootstrap) or caller is already admin
      if (existingAdmin && existingAdmin._id !== currentUser._id) {
        if (currentUser.role !== "admin") {
          throw new Error("Only admins can assign admin role");
        }
      }
    } else {
      // Non-admin roles can only be set by admins
      if (currentUser.role !== "admin" && currentUser._id !== currentUser._id) {
        throw new Error("Only admins can set roles");
      }
    }

    await ctx.db.patch(currentUser._id, {
      role: args.role,
      updatedAt: Date.now(),
    });
  },
});

// Create user from admin (when creating teachers/students with Clerk)
export const createFromAdmin = mutation({
  args: {
    clerkId: v.string(),
    displayName: v.string(),
    username: v.optional(v.string()),
    role: v.union(v.literal("teacher"), v.literal("student")),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) {
      // Update role if not set
      if (!existing.role) {
        await ctx.db.patch(existing._id, {
          role: args.role,
          updatedAt: Date.now(),
        });
      }
      return existing._id;
    }

    // Create new user with role
    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      displayName: args.displayName,
      username: args.username,
      role: args.role,
      createdAt: Date.now(),
    });
  },
});

// Internal mutation for webhook (optional)
export const upsertFromClerk = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    displayName: v.string(),
    username: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (user) {
      await ctx.db.patch(user._id, {
        ...(args.email && { email: args.email }),
        displayName: args.displayName,
        ...(args.username && { username: args.username }),
        imageUrl: args.imageUrl,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("users", {
        clerkId: args.clerkId,
        email: args.email,
        displayName: args.displayName,
        username: args.username,
        imageUrl: args.imageUrl,
        createdAt: Date.now(),
      });
    }
  },
});
