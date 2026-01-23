import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "./lib/auth";

// List all active teachers (all authenticated users)
export const list = query({
  handler: async (ctx) => {
    await requireAuth(ctx);
    const teachers = await ctx.db.query("teachers").order("desc").collect();
    return teachers.filter(
      (teacher) => teacher.status === "active" || teacher.status === undefined
    );
  },
});

// Get a single teacher by ID
export const getById = query({
  args: { id: v.id("teachers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create a teacher (admin only)
export const create = mutation({
  args: {
    lastName: v.string(),
    firstName: v.string(),
    grade: v.number(),
    group: v.string(),
    phone1: v.string(),
    phone2: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    return await ctx.db.insert("teachers", {
      ...args,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

// Update a teacher (admin only)
export const update = mutation({
  args: {
    id: v.id("teachers"),
    lastName: v.string(),
    firstName: v.string(),
    grade: v.number(),
    group: v.string(),
    phone1: v.string(),
    phone2: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    const { id, ...data } = args;
    return await ctx.db.patch(id, {
      ...data,
      updatedAt: Date.now(),
    });
  },
});

// Soft delete a teacher (admin only)
export const softDelete = mutation({
  args: { id: v.id("teachers") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    return await ctx.db.patch(args.id, {
      status: "deleted",
      updatedAt: Date.now(),
    });
  },
});
