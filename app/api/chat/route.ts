import { NextRequest } from "next/server";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT =
  "Та бол Монгол хэлээр заадаг AI багш туслах. Сурагчдад тусалж, асуултад тодорхой, товч хариулаарай. Хэрэв сурагч даалгавар эсвэл бодлого асуувал алхам алхмаар тайлбарлаж өгөөрэй.";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  model: "openai" | "gemini";
  textbookContext?: string;
  imageUrl?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { messages, model, textbookContext, imageUrl } = body;

    if (!messages || !model) {
      return new Response("Missing messages or model", { status: 400 });
    }

    const systemPrompt = textbookContext
      ? `${SYSTEM_PROMPT}\n\nСурагч дараах сурах бичгийн хичээлийг лавлаж байна:\n${textbookContext}\n\nЭнэ хичээлийн контекстод тохируулан хариулаарай.`
      : SYSTEM_PROMPT;

    const messagesWithSystem: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    console.log("messagesWithSystem", messagesWithSystem);

    if (model === "openai") {
      return streamOpenAI(messagesWithSystem, imageUrl);
    } else if (model === "gemini") {
      return streamGemini(messagesWithSystem, imageUrl);
    } else {
      return new Response("Invalid model. Use 'openai' or 'gemini'.", {
        status: 400,
      });
    }
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

async function streamOpenAI(messages: ChatMessage[], imageUrl?: string): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response("OPENAI_API_KEY not configured", { status: 500 });
  }

  const openai = new OpenAI({ apiKey });

  // Build messages, converting last user message to multimodal if image present
  type OpenAIMessage =
    | { role: "user" | "assistant" | "system"; content: string }
    | { role: "user"; content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "high" } }> };

  const openaiMessages: OpenAIMessage[] = messages.map((m, i) => {
    if (imageUrl && m.role === "user" && i === messages.length - 1) {
      return {
        role: "user" as const,
        content: [
          { type: "text" as const, text: m.content || "Энэ зургийг тайлбарлаж, бодлогыг алхам алхмаар бодож өгнө үү." },
          { type: "image_url" as const, image_url: { url: imageUrl, detail: "high" as const } },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });

  console.log("openaiMessages", openaiMessages);

  const stream = await openai.chat.completions.create({
    model: imageUrl ? "gpt-4o" : "gpt-4o-mini",
    messages: openaiMessages,
    stream: true,
    temperature: 0,
    max_tokens: 4096,
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
        controller.close();
      } catch (error) {
        console.error("OpenAI stream error:", error);
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
}

async function imageUrlToBase64(url: string): Promise<{ mimeType: string; data: string }> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mimeType = response.headers.get("content-type") || "image/jpeg";
  return { mimeType, data: base64 };
}

async function streamGemini(messages: ChatMessage[], imageUrl?: string): Promise<Response> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return new Response("GOOGLE_AI_API_KEY not configured", { status: 500 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // Convert messages to Gemini format
  // Gemini doesn't support "system" role in contents, so we use systemInstruction
  const systemMessage = messages.find((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");

  const contents = await Promise.all(
    chatMessages.map(async (m, i) => {
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      const text = m.content || "Энэ зургийг тайлбарлаж, бодлогыг алхам алхмаар бодож өгнө үү.";
      parts.push({ text });

      // Add image to the last user message
      if (imageUrl && m.role === "user" && i === chatMessages.length - 1) {
        const imageData = await imageUrlToBase64(imageUrl);
        parts.push({ inlineData: imageData });
      }

      return {
        role: m.role === "assistant" ? "model" : "user",
        parts,
      };
    })
  );

  console.log("contents", contents);

  const result = await geminiModel.generateContentStream({
    contents,
    systemInstruction: systemMessage
      ? { role: "user", parts: [{ text: systemMessage.content }] }
      : undefined,
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      } catch (error) {
        console.error("Gemini stream error:", error);
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
}
