import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireAuth, requireRole } from "./lib/auth";

// Record a usage event (internal - called from other mutations)
export const record = internalMutation({
  args: {
    clerkUserId: v.string(),
    eventType: v.union(
      v.literal("chat_message"),
      v.literal("stt_request"),
      v.literal("pdf_extraction"),
      v.literal("file_upload"),
      v.literal("image_analysis")
    ),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("usageEvents", {
      clerkUserId: args.clerkUserId,
      eventType: args.eventType,
      model: args.model,
      timestamp: Date.now(),
    });
  },
});

// Record a usage event (authenticated - callable from API routes)
export const recordEvent = mutation({
  args: {
    eventType: v.union(
      v.literal("chat_message"),
      v.literal("stt_request"),
      v.literal("pdf_extraction"),
      v.literal("file_upload"),
      v.literal("image_analysis")
    ),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    await ctx.db.insert("usageEvents", {
      clerkUserId: identity.subject,
      eventType: args.eventType,
      model: args.model,
      timestamp: Date.now(),
    });
  },
});

// Get usage events for a specific user (admin only)
export const getByUser = query({
  args: {
    clerkUserId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("usageEvents")
      .withIndex("by_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .order("desc")
      .take(limit);
  },
});

// Get all recent usage events (admin only) - for dashboard
export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    const limit = args.limit ?? 200;
    return await ctx.db
      .query("usageEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});

// Get usage stats aggregated by user (admin only) - for dashboard
export const getUsageStats = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin"]);

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Get events from last 24 hours
    const recentEvents = await ctx.db
      .query("usageEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();

    const todayEvents = recentEvents.filter((e) => e.timestamp >= oneDayAgo);
    const weekEvents = recentEvents.filter((e) => e.timestamp >= oneWeekAgo);

    // Aggregate by user
    const userStats: Record<
      string,
      { total: number; today: number; week: number; lastActive: number }
    > = {};

    for (const event of recentEvents) {
      if (!userStats[event.clerkUserId]) {
        userStats[event.clerkUserId] = {
          total: 0,
          today: 0,
          week: 0,
          lastActive: 0,
        };
      }
      userStats[event.clerkUserId].total++;
      if (event.timestamp >= oneDayAgo) userStats[event.clerkUserId].today++;
      if (event.timestamp >= oneWeekAgo) userStats[event.clerkUserId].week++;
      if (event.timestamp > userStats[event.clerkUserId].lastActive) {
        userStats[event.clerkUserId].lastActive = event.timestamp;
      }
    }

    // Aggregate by event type
    const typeStats: Record<string, number> = {};
    for (const event of todayEvents) {
      typeStats[event.eventType] = (typeStats[event.eventType] || 0) + 1;
    }

    return {
      totalEventsToday: todayEvents.length,
      totalEventsWeek: weekEvents.length,
      totalEventsAllTime: recentEvents.length,
      userStats,
      typeStats,
    };
  },
});

// Check for anomalous usage (admin only) - users with > 100 events in last 5 min
export const checkAnomalies = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin"]);

    const fiveMinAgo = Date.now() - 5 * 60 * 1000;

    const recentEvents = await ctx.db
      .query("usageEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();

    const veryRecentEvents = recentEvents.filter(
      (e) => e.timestamp >= fiveMinAgo
    );

    // Count per user
    const userCounts: Record<string, number> = {};
    for (const event of veryRecentEvents) {
      userCounts[event.clerkUserId] =
        (userCounts[event.clerkUserId] || 0) + 1;
    }

    // Flag users with > 100 events in 5 minutes
    const anomalousUsers = Object.entries(userCounts)
      .filter(([, count]) => count > 100)
      .map(([userId, count]) => ({ userId, count }));

    return anomalousUsers;
  },
});
