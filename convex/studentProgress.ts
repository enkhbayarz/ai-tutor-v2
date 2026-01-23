import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAuth, requireRole } from "./lib/auth";

// Get progress for the authenticated student
export const getProgress = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    return await ctx.db
      .query("studentProgress")
      .withIndex("by_user", (q) => q.eq("clerkUserId", identity.subject))
      .first();
  },
});

// Get all student progress (teacher/admin only)
export const getClassProgress = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin", "teacher"]);
    return await ctx.db.query("studentProgress").collect();
  },
});

// Get students falling behind (teacher/admin only)
// Low accuracy (< 50%) or inactive > 7 days
export const getStudentsBehind = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const allProgress = await ctx.db.query("studentProgress").collect();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return allProgress.filter(
      (p) => p.averageAccuracy < 0.5 || p.lastActiveAt < sevenDaysAgo
    );
  },
});

// Get progress for a specific student (teacher/admin only)
export const getStudentProgress = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    return await ctx.db
      .query("studentProgress")
      .withIndex("by_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
  },
});
