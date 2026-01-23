import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const CHIMEGE_STT_URL = "https://api.chimege.com/v1.2/read";
const CHIMEGE_TTS_URL = "https://api.chimege.com/v1.2/speak";

export async function POST(request: NextRequest) {
  // Auth check
  const { userId, getToken } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Set Convex auth token
  const token = await getToken({ template: "convex" });
  if (token) {
    convex.setAuth(token);
  }

  const type = request.nextUrl.searchParams.get("type");

  if (type === "stt") {
    return handleSTT(request);
  } else if (type === "tts") {
    return handleTTS(request);
  }

  return NextResponse.json({ error: "Invalid type. Use ?type=stt or ?type=tts" }, { status: 400 });
}

async function handleSTT(request: NextRequest) {
  const apiKey = process.env.CHIMEGE_STT_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "CHIMEGE_STT_KEY not configured" }, { status: 500 });
  }

  try {
    const audioBuffer = await request.arrayBuffer();

    const response = await fetch(CHIMEGE_STT_URL, {
      method: "POST",
      headers: {
        token: apiKey,
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Chimege STT error:", response.status, errorText);
      return NextResponse.json(
        { error: `STT failed: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Track STT usage (non-blocking)
    convex.mutation(api.usageEvents.recordEvent, {
      eventType: "stt_request",
    }).catch(() => {});

    return NextResponse.json({ text: data.output || "" });
  } catch (error) {
    console.error("STT error:", error);
    return NextResponse.json({ error: "STT request failed" }, { status: 500 });
  }
}

async function handleTTS(request: NextRequest) {
  const apiKey = process.env.CHIMEGE_TTS_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "CHIMEGE_TTS_KEY not configured" }, { status: 500 });
  }

  try {
    const { text } = await request.json();
    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // Chimege TTS has a character limit
    const truncated = text.slice(0, 300);

    const response = await fetch(CHIMEGE_TTS_URL, {
      method: "POST",
      headers: {
        token: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: truncated }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Chimege TTS error:", response.status, errorText);
      return NextResponse.json(
        { error: `TTS failed: ${response.status}` },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("TTS error:", error);
    return NextResponse.json({ error: "TTS request failed" }, { status: 500 });
  }
}
