import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "./lib/auth";

// List all active students (all authenticated users)
export const list = query({
  handler: async (ctx) => {
    await requireAuth(ctx);
    const students = await ctx.db.query("students").order("desc").collect();
    return students.filter(
      (student) => student.status === "active" || student.status === undefined
    );
  },
});

// Get a single student by ID
export const getById = query({
  args: { id: v.id("students") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create a student (admin only)
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
    return await ctx.db.insert("students", {
      ...args,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

// Update a student (admin only)
export const update = mutation({
  args: {
    id: v.id("students"),
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

// Soft delete a student (admin only)
export const softDelete = mutation({
  args: { id: v.id("students") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    return await ctx.db.patch(args.id, {
      status: "deleted",
      updatedAt: Date.now(),
    });
  },
});
