import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  teachers: defineTable({
    lastName: v.string(),
    firstName: v.string(),
    grade: v.number(), // 1-12
    group: v.string(), // А, Б, В, Г, Д, etc.
    phone1: v.string(),
    phone2: v.optional(v.string()),
    // Optional for backward compatibility with existing data
    // Run migrations.addStatusToTeachers to populate existing records
    status: v.optional(v.union(v.literal("active"), v.literal("deleted"))),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }),
});
