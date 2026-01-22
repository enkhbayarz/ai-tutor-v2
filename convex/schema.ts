import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(), // Clerk user ID
    email: v.string(), // From Clerk
    imageUrl: v.optional(v.string()), // Profile image URL
    displayName: v.string(), // Editable display name
    username: v.optional(v.string()), // Editable username
    role: v.optional(
      v.union(v.literal("admin"), v.literal("teacher"), v.literal("student"))
    ),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

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
