import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  generateStudentUsername,
  generateStudentPassword,
} from "@/lib/student-credentials/generate-credentials";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

interface CreateTeacherRequest {
  lastName: string;
  firstName: string;
  grade: number;
  group: string;
  phone1: string;
  phone2?: string;
}

interface CreateTeacherResponse {
  success: boolean;
  username?: string;
  tempPassword?: string;
  clerkId?: string;
  teacherId?: string;
  error?: string;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateTeacherResponse>> {
  let clerkUserId: string | null = null;

  try {
    // Auth check
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

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
        { status: 403 }
      );
    }

    // Parse request body
    const data: CreateTeacherRequest = await request.json();

    if (!data.lastName || !data.firstName || !data.grade || !data.group || !data.phone1) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get existing usernames from Convex for duplicate checking
    const existingUsernames = await convex.query(api.teachers.getAllUsernames);
    const usernameSet = new Set(existingUsernames || []);

    // Also get existing Clerk usernames
    const clerkUsers = await clerkClient.users.getUserList({ limit: 500 });
    for (const user of clerkUsers.data) {
      if (user.username) {
        usernameSet.add(user.username);
      }
    }

    // Generate credentials (same format as students)
    const username = generateStudentUsername(
      data.firstName,
      data.lastName,
      usernameSet
    );
    const tempPassword = generateStudentPassword(
      data.phone1,
      data.firstName,
      data.lastName
    );

    // Create Clerk user with username + password only (no email)
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
    const teacherId = await convex.mutation(api.teachers.createWithClerk, {
      lastName: data.lastName.trim(),
      firstName: data.firstName.trim(),
      grade: data.grade,
      group: data.group,
      phone1: data.phone1.trim(),
      phone2: data.phone2?.trim(),
      clerkId: clerkUser.id,
      username,
    });

    return NextResponse.json({
      success: true,
      username,
      tempPassword,
      clerkId: clerkUser.id,
      teacherId,
    });
  } catch (error) {
    // Rollback: If Clerk user was created but Convex failed, delete the Clerk user
    if (clerkUserId) {
      try {
        await clerkClient.users.deleteUser(clerkUserId);
      } catch (rollbackError) {
        console.error("Rollback failed - orphaned Clerk user:", clerkUserId);
      }
    }

    console.error("Create teacher with Clerk error:", {
      error: error instanceof Error ? error.message : error,
      // @ts-expect-error - Clerk errors have additional properties
      clerkErrors: error?.errors,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
