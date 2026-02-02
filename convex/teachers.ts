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

// Get all existing usernames for duplicate checking (admin only)
export const getAllUsernames = query({
  handler: async (ctx) => {
    await requireRole(ctx, ["admin"]);
    const teachers = await ctx.db.query("teachers").collect();
    return teachers
      .filter((t) => t.username && t.status !== "deleted")
      .map((t) => t.username as string);
  },
});

// Create a teacher with Clerk link (admin only, for bulk import)
export const createWithClerk = mutation({
  args: {
    lastName: v.string(),
    firstName: v.string(),
    grade: v.number(),
    group: v.string(),
    phone1: v.string(),
    phone2: v.optional(v.string()),
    clerkId: v.string(),
    username: v.string(),
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

// Check for duplicate phone numbers (admin only, for bulk import validation)
export const checkDuplicatePhones = query({
  args: {
    phones: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    const teachers = await ctx.db.query("teachers").collect();
    const existingPhones = new Set(
      teachers.filter((t) => t.status !== "deleted").map((t) => t.phone1)
    );
    return args.phones.map((phone) => existingPhones.has(phone));
  },
});
