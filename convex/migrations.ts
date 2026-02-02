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

// One-time migration to remove grade and group fields from teachers
// Teachers should not have grade/group - only students should have them
// Run this via Convex Dashboard, then remove optional grade/group from schema
export const removeGradeGroupFromTeachers = mutation({
  handler: async (ctx) => {
    const teachers = await ctx.db.query("teachers").collect();

    let updatedCount = 0;
    for (const teacher of teachers) {
      // Check if teacher has grade or group fields
      const hasGrade = "grade" in teacher;
      const hasGroup = "group" in teacher;

      if (hasGrade || hasGroup) {
        // Create new document without grade/group
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { grade, group, _id, _creationTime, ...cleanedTeacher } =
          teacher as typeof teacher & { grade?: number; group?: string };

        // Replace the document (removes unwanted fields)
        await ctx.db.replace(teacher._id, cleanedTeacher);
        updatedCount++;
      }
    }

    return { updatedCount, totalTeachers: teachers.length };
  },
});

