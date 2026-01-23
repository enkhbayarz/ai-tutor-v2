import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const addRecent = mutation({
  args: {
    clerkUserId: v.string(),
    textbookId: v.id("textbooks"),
  },
  handler: async (ctx, args) => {
    // Check if this textbook is already in recents
    const existing = await ctx.db
      .query("recentTextbooks")
      .withIndex("by_user_textbook", (q) =>
        q.eq("clerkUserId", args.clerkUserId).eq("textbookId", args.textbookId)
      )
      .first();

    if (existing) {
      // Update viewedAt
      await ctx.db.patch(existing._id, { viewedAt: Date.now() });
      return;
    }

    // Get all user's recent entries sorted by viewedAt ascending (oldest first)
    const userRecents = await ctx.db
      .query("recentTextbooks")
      .withIndex("by_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .collect();

    // If at max (3), delete the oldest
    if (userRecents.length >= 3) {
      const sorted = userRecents.sort((a, b) => a.viewedAt - b.viewedAt);
      await ctx.db.delete(sorted[0]._id);
    }

    // Insert new entry
    await ctx.db.insert("recentTextbooks", {
      clerkUserId: args.clerkUserId,
      textbookId: args.textbookId,
      viewedAt: Date.now(),
    });
  },
});

export const listRecent = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const recents = await ctx.db
      .query("recentTextbooks")
      .withIndex("by_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .collect();

    // Sort by viewedAt descending (most recent first)
    const sorted = recents.sort((a, b) => b.viewedAt - a.viewedAt);

    // Join with textbooks table
    const results = await Promise.all(
      sorted.map(async (entry) => {
        const textbook = await ctx.db.get(entry.textbookId);
        if (!textbook || textbook.status === "deleted") return null;

        const thumbnailUrl = textbook.thumbnailId
          ? await ctx.storage.getUrl(textbook.thumbnailId)
          : null;

        return {
          _id: textbook._id,
          subjectName: textbook.subjectName,
          grade: textbook.grade,
          thumbnailUrl,
        };
      })
    );

    return results.filter(
      (r): r is NonNullable<typeof r> => r !== null
    );
  },
});
