import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import PDFParser from "pdf2json";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

async function extractTextFromPdf(pdfBuffer: Buffer): Promise<{ text: string; pageCount: number }> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataError", (errData: Error | { parserError: Error }) => {
      if (errData instanceof Error) {
        reject(errData);
      } else {
        reject(errData.parserError);
      }
    });

    pdfParser.on("pdfParser_dataReady", (pdfData: { Pages: Array<{ Texts: Array<{ R: Array<{ T: string }> }> }> }) => {
      const pages = pdfData.Pages || [];
      const textParts: string[] = [];

      for (const page of pages) {
        const pageTexts: string[] = [];
        for (const textItem of page.Texts || []) {
          for (const run of textItem.R || []) {
            // Decode URI-encoded text
            const text = decodeURIComponent(run.T || "");
            pageTexts.push(text);
          }
        }
        textParts.push(pageTexts.join(" "));
      }

      resolve({
        text: textParts.join("\n\n"),
        pageCount: pages.length,
      });
    });

    pdfParser.parseBuffer(pdfBuffer);
  });
}

export async function POST(request: NextRequest) {
  try {
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

    // 3. Fetch PDF content
    const response = await fetch(textbook.pdfUrl);
    const pdfBuffer = Buffer.from(await response.arrayBuffer());

    // 4. Extract text using pdf2json
    const { text, pageCount } = await extractTextFromPdf(pdfBuffer);

    // 5. Save extracted text
    await convex.mutation(api.textbooks.updateExtractedText, {
      id: textbookId as Id<"textbooks">,
      extractedText: text,
      status: "completed",
    });

    return NextResponse.json({
      success: true,
      textLength: text.length,
      pageCount,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
export const runtime = "nodejs";
