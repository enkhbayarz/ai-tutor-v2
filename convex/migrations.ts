import { mutation } from "./_generated/server";

// One-time migration to add status field to existing teachers
export const addStatusToTeachers = mutation({
  handler: async (ctx) => {
    const teachers = await ctx.db.query("teachers").collect();

    let updatedCount = 0;
    for (const teacher of teachers) {
      // Check if status field is missing
      if (!("status" in teacher) || teacher.status === undefined) {
        await ctx.db.patch(teacher._id, {
          status: "active",
        });
        updatedCount++;
      }
    }

    return { updatedCount, totalTeachers: teachers.length };
  },
});
