import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// List all active teachers (excludes deleted)
// Teachers without status field are treated as active (for backward compatibility)
export const list = query({
  handler: async (ctx) => {
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

// Create a teacher
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
    return await ctx.db.insert("teachers", {
      ...args,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

// Update a teacher
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
    const { id, ...data } = args;
    return await ctx.db.patch(id, {
      ...data,
      updatedAt: Date.now(),
    });
  },
});

// Soft delete a teacher (set status to deleted)
export const softDelete = mutation({
  args: { id: v.id("teachers") },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.id, {
      status: "deleted",
      updatedAt: Date.now(),
    });
  },
});
