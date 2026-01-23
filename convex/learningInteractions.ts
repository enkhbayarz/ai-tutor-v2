import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireRole } from "./lib/auth";

// Record a learning interaction and update mastery
export const record = mutation({
  args: {
    textbookId: v.optional(v.id("textbooks")),
    chapterId: v.optional(v.string()),
    topicId: v.optional(v.string()),
    subjectName: v.string(),
    grade: v.number(),
    topicTitle: v.string(),
    interactionType: v.union(
      v.literal("question"),
      v.literal("quiz_attempt"),
      v.literal("explanation_request"),
      v.literal("problem_solving")
    ),
    isCorrect: v.optional(v.boolean()),
    conversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = identity.subject;

    // Insert learning interaction
    await ctx.db.insert("learningInteractions", {
      clerkUserId: userId,
      ...args,
      timestamp: Date.now(),
    });

    // Update topic mastery
    const existingMastery = await ctx.db
      .query("topicMastery")
      .withIndex("by_user_subject", (q) =>
        q.eq("clerkUserId", userId).eq("subjectName", args.subjectName)
      )
      .collect();

    const topicMastery = existingMastery.find(
      (m) => m.topicTitle === args.topicTitle
    );

    if (topicMastery) {
      const newTotal = topicMastery.totalInteractions + 1;
      const newCorrect =
        topicMastery.correctAnswers + (args.isCorrect ? 1 : 0);
      const newQuizAttempts =
        topicMastery.totalQuizAttempts +
        (args.interactionType === "quiz_attempt" ? 1 : 0);
      const accuracy = newTotal > 0 ? newCorrect / newTotal : 0;

      let masteryLevel: "not_started" | "beginner" | "intermediate" | "advanced" | "mastered" = "beginner";
      if (accuracy >= 0.9 && newTotal >= 10) masteryLevel = "mastered";
      else if (accuracy >= 0.75 && newTotal >= 7) masteryLevel = "advanced";
      else if (accuracy >= 0.5 && newTotal >= 4) masteryLevel = "intermediate";
      else if (newTotal >= 1) masteryLevel = "beginner";

      await ctx.db.patch(topicMastery._id, {
        totalInteractions: newTotal,
        correctAnswers: newCorrect,
        totalQuizAttempts: newQuizAttempts,
        masteryLevel,
        lastInteractionAt: Date.now(),
      });
    } else {
      await ctx.db.insert("topicMastery", {
        clerkUserId: userId,
        subjectName: args.subjectName,
        grade: args.grade,
        topicTitle: args.topicTitle,
        masteryLevel: "beginner",
        totalInteractions: 1,
        correctAnswers: args.isCorrect ? 1 : 0,
        totalQuizAttempts: args.interactionType === "quiz_attempt" ? 1 : 0,
        lastInteractionAt: Date.now(),
      });
    }

    // Update overall student progress
    const progress = await ctx.db
      .query("studentProgress")
      .withIndex("by_user", (q) => q.eq("clerkUserId", userId))
      .first();

    const allMastery = await ctx.db
      .query("topicMastery")
      .withIndex("by_user", (q) => q.eq("clerkUserId", userId))
      .collect();

    const totalInteractions = allMastery.reduce(
      (sum, m) => sum + m.totalInteractions,
      0
    );
    const totalCorrect = allMastery.reduce(
      (sum, m) => sum + m.correctAnswers,
      0
    );
    const averageAccuracy =
      totalInteractions > 0 ? totalCorrect / totalInteractions : 0;
    const topicsMastered = allMastery.filter(
      (m) => m.masteryLevel === "mastered"
    ).length;

    let currentLevel: "beginner" | "intermediate" | "advanced" = "beginner";
    if (averageAccuracy >= 0.8 && topicsMastered >= 5)
      currentLevel = "advanced";
    else if (averageAccuracy >= 0.6 && topicsMastered >= 2)
      currentLevel = "intermediate";

    if (progress) {
      await ctx.db.patch(progress._id, {
        totalInteractions,
        averageAccuracy,
        currentLevel,
        topicsMastered,
        lastActiveAt: Date.now(),
      });
    } else {
      await ctx.db.insert("studentProgress", {
        clerkUserId: userId,
        totalInteractions,
        averageAccuracy,
        currentLevel,
        topicsMastered,
        currentStreak: 1,
        lastActiveAt: Date.now(),
      });
    }
  },
});

// Get recent interactions for the authenticated student
export const getByUser = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("learningInteractions")
      .withIndex("by_user", (q) => q.eq("clerkUserId", identity.subject))
      .order("desc")
      .take(limit);
  },
});

// Get interactions by subject for the authenticated student
export const getBySubject = query({
  args: {
    subjectName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    return await ctx.db
      .query("learningInteractions")
      .withIndex("by_user_subject", (q) =>
        q.eq("clerkUserId", identity.subject).eq("subjectName", args.subjectName)
      )
      .order("desc")
      .collect();
  },
});

// Get interactions for a specific student (teacher/admin only)
export const getByStudent = query({
  args: {
    clerkUserId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("learningInteractions")
      .withIndex("by_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .order("desc")
      .take(limit);
  },
});
