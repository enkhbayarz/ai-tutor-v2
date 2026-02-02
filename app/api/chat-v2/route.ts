import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { SignJWT } from "jose";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const AI_BACKEND_URL = process.env.AI_BACKEND_URL;
const AI_BACKEND_SECRET =
  process.env.AI_BACKEND_SECRET || "my-super-secret-key-12345";

// Default values for testing - school_id and class_id are still hardcoded
const DEFAULT_USER_ID = "2e7fe617-25b8-4ca3-ab86-1a348eb658e4";
const DEFAULT_SCHOOL_ID = "5036e963-d286-449c-8c08-f69fd7549a07";
const DEFAULT_CLASS_ID = "2728a8a1-eab6-4502-afd1-79ca351e6199";

// Initialize Convex client
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface ChatV2Request {
  message: string;
  classId?: string;
  sessionId?: string;
  imageBase64?: string;
  includeVision?: boolean;
}

interface TokenParams {
  userId: string;
  role: string;
  name: string;
}

async function generateBackendToken(params: TokenParams): Promise<string> {
  const secret = new TextEncoder().encode(AI_BACKEND_SECRET);

  const token = await new SignJWT({
    user_id: params.userId,
    school_id: DEFAULT_SCHOOL_ID,
    class_ids: [DEFAULT_CLASS_ID],
    role: params.role,
    name: params.name,
    iss: "main-backend",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(secret);

  return token;
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body: ChatV2Request = await request.json();

    console.log(`body: ${JSON.stringify(body)}`);

    const { message, sessionId, imageBase64, includeVision } = body;

    if (!message) {
      return new Response("Missing message", { status: 400 });
    }

    // Get user from Convex with externalUserId (generates if missing)
    const convexUser = await convex.mutation(api.users.ensureExternalUserId, {
      clerkId: clerkUserId,
    });

    // Use dynamic values from Convex user, fallback to defaults
    const externalUserId = convexUser?.externalUserId || DEFAULT_USER_ID;
    const role = convexUser?.role || "student";
    const displayName = convexUser?.displayName || "User";

    // Generate JWT for backend with dynamic user context
    const backendToken = await generateBackendToken({
      userId: externalUserId,
      role: role,
      name: displayName,
    });

    // Call external AI backend
    const response = await fetch(
      `${AI_BACKEND_URL}/api/chain/chat/v2/message/stream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${backendToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message,
          class_id: DEFAULT_CLASS_ID,
          session_id: sessionId,
          image_base64: imageBase64 || null,
          include_vision: includeVision || false,
        }),
      },
    );

    if (!response.ok) {
      console.error("Backend API error:", response.status, response.statusText);
      return new Response(`Backend error: ${response.statusText}`, {
        status: response.status,
      });
    }

    if (!response.body) {
      return new Response("No response body from backend", { status: 500 });
    }

    // Stream the response back to client
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const readable = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              controller.close();
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            // Process complete lines
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.content) {
                    controller.enqueue(encoder.encode(data.content));
                  }
                  if (data.done) {
                    controller.close();
                    return;
                  }
                } catch {
                  // Ignore JSON parse errors for malformed lines
                }
              }
            }
          }
        } catch (error) {
          console.error("Stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat V2 API error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
