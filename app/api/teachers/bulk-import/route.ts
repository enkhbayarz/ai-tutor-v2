import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  generateStudentUsername,
  generateStudentPassword,
} from "@/lib/student-credentials/generate-credentials";
import { type TeacherBulkImportRow } from "@/lib/validations/teacher-bulk-import";
import { Id } from "@/convex/_generated/dataModel";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

interface ImportResult {
  rowIndex: number;
  success: boolean;
  lastName?: string;
  firstName?: string;
  username?: string;
  tempPassword?: string;
  clerkId?: string;
  teacherId?: string;
  error?: string;
}

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1000;

async function processRow(
  row: TeacherBulkImportRow,
  rowIndex: number,
  username: string,
  tempPassword: string,
  convex: ConvexHttpClient,
): Promise<ImportResult> {
  let clerkUserId: string | null = null;
  let teacherId: Id<"teachers"> | null = null;

  try {
    // Create Clerk user with username and password only (no email)
    const clerkUser = await clerkClient.users.createUser({
      username,
      password: tempPassword,
      skipPasswordChecks: true,
      publicMetadata: {
        requirePasswordChange: true,
        role: "teacher",
      },
    });

    clerkUserId = clerkUser.id;

    // Create Convex teacher record linked to Clerk user
    teacherId = await convex.mutation(api.teachers.createWithClerk, {
      lastName: row.lastName,
      firstName: row.firstName,
      phone1: row.phone1,
      phone2: row.phone2,
      clerkId: clerkUser.id,
      username,
    });

    // Also create user record with role for role-based UI
    await convex.mutation(api.users.createFromAdmin, {
      clerkId: clerkUser.id,
      displayName: `${row.lastName} ${row.firstName}`.trim(),
      username,
      role: "teacher",
    });

    return {
      rowIndex,
      success: true,
      lastName: row.lastName,
      firstName: row.firstName,
      username,
      tempPassword,
      clerkId: clerkUser.id,
      teacherId: teacherId,
    };
  } catch (error) {
    // Rollback: Soft delete teacher record if it was created
    if (teacherId) {
      try {
        await convex.mutation(api.teachers.softDelete, { id: teacherId });
      } catch (rollbackError) {
        console.error("Rollback failed - orphaned teacher record:", teacherId);
      }
    }

    // Rollback: Delete Clerk user if it was created
    if (clerkUserId) {
      try {
        await clerkClient.users.deleteUser(clerkUserId);
      } catch (rollbackError) {
        console.error("Rollback failed - orphaned Clerk user:", clerkUserId);
      }
    }

    // Log detailed error for debugging
    console.error("Bulk import error for row:", rowIndex, {
      username,
      error: error instanceof Error ? error.message : error,
      // @ts-expect-error - Clerk errors have additional properties
      clerkErrors: error?.errors,
    });

    return {
      rowIndex,
      success: false,
      lastName: row.lastName,
      firstName: row.firstName,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Create Convex client per-request to avoid race conditions
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
    }
    const convex = new ConvexHttpClient(convexUrl);

    // Set Convex auth token from Clerk
    const token = await getToken({ template: "convex" });
    if (token) {
      convex.setAuth(token);
    }

    // Verify admin role
    const currentUser = await convex.query(api.users.getCurrentUser);
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    // Parse request body
    const { rows } = (await request.json()) as { rows: TeacherBulkImportRow[] };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid rows to process" },
        { status: 400 },
      );
    }

    // Get existing usernames from Convex for duplicate checking
    const existingUsernames = await convex.query(api.teachers.getAllUsernames);
    const usernameSet = new Set(existingUsernames || []);

    // Also get existing Clerk usernames (paginate through all users)
    let offset = 0;
    const pageSize = 500;
    while (true) {
      const clerkUsers = await clerkClient.users.getUserList({
        limit: pageSize,
        offset,
      });
      for (const user of clerkUsers.data) {
        if (user.username) {
          usernameSet.add(user.username);
        }
      }
      if (clerkUsers.data.length < pageSize) break;
      offset += pageSize;
    }

    // Pre-generate credentials for all rows using the new format
    // Username: {firstName}{lastNameInitial} → "baatare"
    // Password: {phone}{initials}{special} → "99123456BE$"
    const credentials = rows.map((row) => ({
      username: generateStudentUsername(row.firstName, row.lastName, usernameSet),
      tempPassword: generateStudentPassword(row.phone1, row.firstName, row.lastName),
    }));

    // Process in batches to respect rate limits
    const results: ImportResult[] = [];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batchRows = rows.slice(i, i + BATCH_SIZE);
      const batchCredentials = credentials.slice(i, i + BATCH_SIZE);

      // Process batch in parallel
      const batchPromises = batchRows.map((row, batchIndex) =>
        processRow(
          row,
          i + batchIndex,
          batchCredentials[batchIndex].username,
          batchCredentials[batchIndex].tempPassword,
          convex,
        ),
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Delay before next batch (except for last batch)
      if (i + BATCH_SIZE < rows.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: rows.length,
        success: successCount,
        failed: failureCount,
      },
    });
  } catch (error) {
    console.error("Bulk import error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
