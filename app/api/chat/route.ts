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
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { messages, model } = body;

    if (!messages || !model) {
      return new Response("Missing messages or model", { status: 400 });
    }

    const messagesWithSystem: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    if (model === "openai") {
      return streamOpenAI(messagesWithSystem);
    } else if (model === "gemini") {
      return streamGemini(messagesWithSystem);
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

async function streamOpenAI(messages: ChatMessage[]): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response("OPENAI_API_KEY not configured", { status: 500 });
  }

  const openai = new OpenAI({ apiKey });

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
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

async function streamGemini(messages: ChatMessage[]): Promise<Response> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return new Response("GOOGLE_AI_API_KEY not configured", { status: 500 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // Convert messages to Gemini format
  // Gemini doesn't support "system" role in contents, so we use systemInstruction
  const systemMessage = messages.find((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");

  const contents = chatMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const result = await model.generateContentStream({
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
