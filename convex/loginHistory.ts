import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Record login event (called from webhook)
// Note: This is called from the Clerk webhook handler
export const recordLoginEvent = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("loginHistory", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

// Get user's login history
export const getLoginHistory = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("loginHistory")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .order("desc")
      .take(20);
  },
});
