import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// List all active students (excludes deleted)
export const list = query({
  handler: async (ctx) => {
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

// Create a student
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
    return await ctx.db.insert("students", {
      ...args,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

// Update a student
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
    const { id, ...data } = args;
    return await ctx.db.patch(id, {
      ...data,
      updatedAt: Date.now(),
    });
  },
});

// Soft delete a student (set status to deleted)
export const softDelete = mutation({
  args: { id: v.id("students") },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.id, {
      status: "deleted",
      updatedAt: Date.now(),
    });
  },
});
