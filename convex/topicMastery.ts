import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAuth, requireRole } from "./lib/auth";

// Get all mastery records for the authenticated user
export const getByUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    return await ctx.db
      .query("topicMastery")
      .withIndex("by_user", (q) => q.eq("clerkUserId", identity.subject))
      .collect();
  },
});

// Get weak topics (accuracy < 50%) for the authenticated user
export const getWeakTopics = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    const allMastery = await ctx.db
      .query("topicMastery")
      .withIndex("by_user", (q) => q.eq("clerkUserId", identity.subject))
      .collect();

    return allMastery
      .filter((m) => {
        const accuracy =
          m.totalInteractions > 0
            ? m.correctAnswers / m.totalInteractions
            : 0;
        return accuracy < 0.5 && m.totalInteractions >= 2;
      })
      .sort((a, b) => {
        const accA =
          a.totalInteractions > 0
            ? a.correctAnswers / a.totalInteractions
            : 0;
        const accB =
          b.totalInteractions > 0
            ? b.correctAnswers / b.totalInteractions
            : 0;
        return accA - accB;
      });
  },
});

// Get strong topics (mastered) for the authenticated user
export const getStrongTopics = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    return await ctx.db
      .query("topicMastery")
      .withIndex("by_mastery", (q) =>
        q.eq("clerkUserId", identity.subject).eq("masteryLevel", "mastered")
      )
      .collect();
  },
});

// Get mastery by subject for the authenticated user
export const getBySubject = query({
  args: {
    subjectName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    return await ctx.db
      .query("topicMastery")
      .withIndex("by_user_subject", (q) =>
        q.eq("clerkUserId", identity.subject).eq("subjectName", args.subjectName)
      )
      .collect();
  },
});

// Get mastery for a specific student (teacher/admin only)
export const getByStudent = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    return await ctx.db
      .query("topicMastery")
      .withIndex("by_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .collect();
  },
});
