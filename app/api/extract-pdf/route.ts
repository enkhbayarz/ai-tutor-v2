import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import PDFParser from "pdf2json";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { cleanMongolianText } from "@/lib/utils/clean-mongolian-text";

// Note: pdf-lib is now used client-side only for extracting first 6 pages before upload

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Types for TOC structure
interface Topic {
  id: string;
  order: number;
  title: string;
  page: number;
}

interface Chapter {
  id: string;
  order: number;
  title: string;
  description: string;
  topics: Topic[];
}

// LLM prompt for TOC extraction
const TOC_EXTRACTION_PROMPT = `You are extracting a Table of Contents from a Mongolian textbook.
Analyze the text and extract chapters and their topics with page numbers.

Return ONLY valid JSON in this exact format:
{
  "chapters": [
    {
      "order": 0,
      "title": "Бүлэг 1",
      "description": "CHAPTER DESCRIPTION IN CAPS",
      "topics": [
        { "order": 0, "title": "Topic name", "page": 5 },
        { "order": 1, "title": "Another topic", "page": 12 }
      ]
    }
  ]
}

Rules:
- Extract ALL chapters and topics found in the text
- Page numbers must be integers
- Order starts from 0
- Keep original Mongolian text for titles
- If no clear TOC structure found, return {"chapters": []}`;

// Extract TOC using Gemini (text-based)
async function extractTocWithLLM(tocText: string): Promise<Chapter[]> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: tocText }] }],
    systemInstruction: {
      role: "user",
      parts: [{ text: TOC_EXTRACTION_PROMPT }],
    },
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  console.log("=== LLM RESULT ===");
  console.log(result.response.text());
  console.log("=== END LLM RESULT ===");

  const content = result.response.text() || '{"chapters":[]}';
  const parsed = JSON.parse(content);

  // Add UUIDs to chapters and topics
  return (parsed.chapters || []).map(
    (ch: Omit<Chapter, "id" | "topics"> & { topics: Omit<Topic, "id">[] }) => ({
      id: crypto.randomUUID(),
      order: ch.order,
      title: ch.title,
      description: ch.description,
      topics: (ch.topics || []).map((t: Omit<Topic, "id">) => ({
        id: crypto.randomUUID(),
        order: t.order,
        title: t.title,
        page: t.page,
      })),
    })
  );
}

// Extract TOC using Gemini Vision (for scanned/image-based PDFs)
// Gemini can process PDF files directly
async function extractTocWithVision(pdfBuffer: Buffer): Promise<Chapter[]> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // Convert PDF buffer to base64
  const pdfBase64 = pdfBuffer.toString("base64");
  console.log(`=== VISION: Processing PDF (${(pdfBuffer.length / 1024).toFixed(0)} KB) ===`);

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: "Extract the Table of Contents from this Mongolian textbook PDF:" },
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64,
            },
          },
        ],
      },
    ],
    systemInstruction: {
      role: "user",
      parts: [{ text: TOC_EXTRACTION_PROMPT }],
    },
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  console.log("=== VISION RESULT ===");
  console.log(result.response.text());
  console.log("=== END VISION RESULT ===");

  const content = result.response.text() || '{"chapters":[]}';
  const parsed = JSON.parse(content);

  // Add UUIDs to chapters and topics
  return (parsed.chapters || []).map(
    (ch: Omit<Chapter, "id" | "topics"> & { topics: Omit<Topic, "id">[] }) => ({
      id: crypto.randomUUID(),
      order: ch.order,
      title: ch.title,
      description: ch.description,
      topics: (ch.topics || []).map((t: Omit<Topic, "id">) => ({
        id: crypto.randomUUID(),
        order: t.order,
        title: t.title,
        page: t.page,
      })),
    })
  );
}

async function extractTextFromPdf(
  pdfBuffer: Buffer,
  maxPages?: number
): Promise<{ text: string; pageCount: number }> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on(
      "pdfParser_dataError",
      (errData: Error | { parserError: Error }) => {
        if (errData instanceof Error) {
          reject(errData);
        } else {
          reject(errData.parserError);
        }
      }
    );

    pdfParser.on(
      "pdfParser_dataReady",
      (pdfData: {
        Pages: Array<{ Texts: Array<{ R: Array<{ T: string }> }> }>;
      }) => {
        const pages = pdfData.Pages || [];
        const pagesToProcess = maxPages ? pages.slice(0, maxPages) : pages;
        const textParts: string[] = [];

        for (const page of pagesToProcess) {
          const pageTexts: string[] = [];
          for (const textItem of page.Texts || []) {
            for (const run of textItem.R || []) {
              // Safe decode - fallback to raw text if URI malformed
              let text: string;
              try {
                text = decodeURIComponent(run.T || "");
              } catch {
                text = run.T || "";
              }
              pageTexts.push(text);
            }
          }
          textParts.push(pageTexts.join(" "));
        }

        resolve({
          text: textParts.join("\n\n"),
          pageCount: pages.length,
        });
      }
    );

    pdfParser.parseBuffer(pdfBuffer);
  });
}

export async function POST(request: NextRequest) {
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

    const { textbookId } = await request.json();

    if (!textbookId) {
      return NextResponse.json(
        { success: false, error: "textbookId is required" },
        { status: 400 }
      );
    }

    // 1. Set status to pending
    await convex.mutation(api.textbooks.updateExtractedText, {
      id: textbookId as Id<"textbooks">,
      status: "pending",
    });

    // 2. Get textbook with PDF URL
    const textbook = await convex.query(api.textbooks.getByIdInternal, {
      id: textbookId as Id<"textbooks">,
    });

    if (!textbook || !textbook.pdfUrl) {
      await convex.mutation(api.textbooks.updateExtractedText, {
        id: textbookId as Id<"textbooks">,
        status: "failed",
        error: "Textbook or PDF not found",
      });
      return NextResponse.json(
        { success: false, error: "Textbook or PDF not found" },
        { status: 404 }
      );
    }

    // 3. Fetch PDF content (already preprocessed to first 6 pages by client)
    const response = await fetch(textbook.pdfUrl);
    const pdfBuffer = Buffer.from(await response.arrayBuffer());
    console.log(`=== PDF size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB (should be small, pre-extracted by client) ===`);

    // 4. Try text extraction first
    const { text: tocText, pageCount } = await extractTextFromPdf(pdfBuffer);
    const cleanedTocText = cleanMongolianText(tocText);
    console.log("=== CLEANED TOC TEXT ===");
    console.log(cleanedTocText);
    console.log(`=== Text length: ${cleanedTocText.trim().length} chars ===`);

    // 5. Extract TOC - use vision fallback if text extraction failed
    let tableOfContents: Chapter[];
    if (cleanedTocText.trim().length < 100) {
      console.log("=== Text extraction failed, using Gemini Vision ===");
      tableOfContents = await extractTocWithVision(pdfBuffer);
    } else {
      console.log("=== Using text-based LLM extraction ===");
      tableOfContents = await extractTocWithLLM(cleanedTocText);
    }
    console.log("=== EXTRACTED TOC ===");
    console.log(JSON.stringify(tableOfContents, null, 2));
    console.log("=== END EXTRACTED TOC ===");

    // 6. Use cleaned text as extracted text
    const cleanedText = cleanMongolianText(tocText);

    // 6. Save extracted text and TOC
    await convex.mutation(api.textbooks.updateExtractedText, {
      id: textbookId as Id<"textbooks">,
      extractedText: cleanedText,
      tableOfContents: tableOfContents,
      status: "completed",
    });

    // Track usage
    await convex.mutation(api.usageEvents.recordEvent, {
      eventType: "pdf_extraction",
    });

    return NextResponse.json({
      success: true,
      textLength: cleanedText.length,
      pageCount,
      chaptersFound: tableOfContents.length,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("PDF extraction error:", error);

    // Try to update status to failed if we have a textbookId
    try {
      const body = await request.clone().json();
      if (body.textbookId) {
        await convex.mutation(api.textbooks.updateExtractedText, {
          id: body.textbookId as Id<"textbooks">,
          status: "failed",
          error: errorMessage,
        });
      }
    } catch {
      // Ignore errors when trying to update status
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// Ensure this route runs in Node.js runtime (not Edge)
// export const runtime = "nodejs";
