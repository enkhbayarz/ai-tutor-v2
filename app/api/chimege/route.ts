import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const CHIMEGE_STT_URL = "https://api.chimege.com/v1.2/transcribe";
const CHIMEGE_TTS_URL = "https://api.chimege.com/v1.2/synthesize";

/**
 * Split text into chunks at natural boundaries (sentence, comma, space)
 * 200 chars max leaves buffer for normalization expansion (numbers → words)
 */
function chunkText(text: string, maxLength = 200): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining.trim());
      break;
    }

    // Find best break point within maxLength
    let breakPoint = maxLength;
    const slice = remaining.slice(0, maxLength);

    // Priority: sentence end > comma > space
    const sentenceEnd = Math.max(
      slice.lastIndexOf(". "),
      slice.lastIndexOf("! "),
      slice.lastIndexOf("? ")
    );
    if (sentenceEnd > maxLength * 0.5) {
      breakPoint = sentenceEnd + 2;
    } else {
      const comma = slice.lastIndexOf(", ");
      if (comma > maxLength * 0.5) {
        breakPoint = comma + 2;
      } else {
        const space = slice.lastIndexOf(" ");
        if (space > 0) breakPoint = space + 1;
      }
    }

    chunks.push(remaining.slice(0, breakPoint).trim());
    remaining = remaining.slice(breakPoint);
  }

  return chunks.filter((c) => c.length > 0);
}

/**
 * Concatenate multiple WAV audio buffers into one
 * WAV header is 44 bytes - keep first header, skip rest, update sizes
 */
function concatenateWavBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  if (buffers.length === 0) return new ArrayBuffer(0);
  if (buffers.length === 1) return buffers[0];

  const headerSize = 44;
  const totalDataSize =
    buffers.reduce((sum, buf) => sum + buf.byteLength - headerSize, 0) +
    headerSize;

  const result = new Uint8Array(totalDataSize);

  // Copy first buffer with header
  result.set(new Uint8Array(buffers[0]), 0);
  let offset = buffers[0].byteLength;

  // Append data from remaining buffers (skip their headers)
  for (let i = 1; i < buffers.length; i++) {
    const data = new Uint8Array(buffers[i]).slice(headerSize);
    result.set(data, offset);
    offset += data.byteLength;
  }

  // Update file size in header (bytes 4-7) and data size (bytes 40-43)
  const view = new DataView(result.buffer);
  view.setUint32(4, totalDataSize - 8, true); // File size - 8
  view.setUint32(40, totalDataSize - 44, true); // Data size

  return result.buffer;
}

async function normalizeText(
  text: string,
  ttsToken: string,
): Promise<string | null> {
  try {
    console.log("[NORMALIZE] Normalizing text:", text.substring(0, 200));

    const response = await fetch(
      "https://api.chimege.com/v1.2/normalize-text",
      {
        method: "POST",
        headers: {
          "Content-Type": "plain/text",
          Token: ttsToken,
        },
        body: text,
      },
    );

    if (!response.ok) {
      console.error("[NORMALIZE ERROR] API returned status", response.status);
      console.error("[NORMALIZE ERROR] Response:", await response.text());
      return null;
    }

    const normalized = await response.text();
    console.log(
      "[NORMALIZE SUCCESS] Normalized:",
      normalized.substring(0, 200),
    );
    return normalized;
  } catch (error) {
    console.error("[NORMALIZE ERROR] Exception:", error);
    return null;
  }
}

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

  return NextResponse.json(
    { error: "Invalid type. Use ?type=stt or ?type=tts" },
    { status: 400 },
  );
}

async function handleSTT(request: NextRequest) {
  const apiKey = process.env.CHIMEGE_STT_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "CHIMEGE_STT_KEY not configured" },
      { status: 500 },
    );
  }

  try {
    const audioBytes = await request.arrayBuffer();

    const response = await fetch("https://api.chimege.com/v1.2/transcribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        Punctuate: "true",
        Token: apiKey,
      },
      body: audioBytes,
    });

    console.log(`response: ${JSON.stringify(response, null, 2)}`);

    if (!response.ok) {
      console.error("[STT ERROR] API returned status", response.status);
      console.error("[STT ERROR] Response:", await response.text());
      return NextResponse.json(
        { error: "STT API request failed", status: response.status },
        { status: response.status },
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Chimege STT error:", response.status, errorText);
      return NextResponse.json(
        { error: `STT failed: ${response.status}` },
        { status: response.status },
      );
    }
    const text = await response.text();

    // const data = await response.json();

    // Track STT usage (non-blocking)
    convex
      .mutation(api.usageEvents.recordEvent, {
        eventType: "stt_request",
      })
      .catch(() => {});

    return NextResponse.json({ text });
  } catch (error) {
    console.error("STT error:", error);
    return NextResponse.json({ error: "STT request failed" }, { status: 500 });
  }
}

async function handleTTS(request: NextRequest) {
  const apiKey = process.env.CHIMEGE_TTS_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "CHIMEGE_TTS_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const { text } = await request.json();
    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // Split into chunks (200 chars max, leaving buffer for normalization)
    const chunks = chunkText(text, 200);
    console.log(`[TTS] Processing ${chunks.length} chunks from ${text.length} chars`);

    const audioBuffers: ArrayBuffer[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[TTS] Chunk ${i + 1}/${chunks.length}: ${chunk.length} chars`);

      // Normalize
      const normalized = await normalizeText(chunk, apiKey);
      if (!normalized) {
        console.error(`[TTS] Normalization failed for chunk ${i + 1}`);
        continue;
      }

      console.log(`[TTS] Chunk ${i + 1} normalized: ${normalized.length} chars`);

      // Synthesize
      const response = await fetch("https://api.chimege.com/v1.2/synthesize", {
        method: "POST",
        headers: { "Content-Type": "plain/text", Token: apiKey },
        body: normalized,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[TTS] Synthesis failed for chunk ${i + 1}:`,
          response.status,
          errorText
        );
        continue;
      }

      audioBuffers.push(await response.arrayBuffer());
    }

    if (audioBuffers.length === 0) {
      return NextResponse.json(
        { error: "TTS failed for all chunks" },
        { status: 500 }
      );
    }

    // Concatenate all WAV buffers
    const combined = concatenateWavBuffers(audioBuffers);
    console.log(
      `[TTS] Combined ${audioBuffers.length} audio chunks into ${combined.byteLength} bytes`
    );

    return new Response(combined, {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-cache" },
    });
  } catch (error) {
    console.error("TTS error:", error);
    return NextResponse.json({ error: "TTS request failed" }, { status: 500 });
  }
}
