import { PDFDocument } from "pdf-lib";

/**
 * Extracts the first N pages from a PDF file.
 * This runs client-side in the browser to reduce upload size.
 *
 * @param file - The original PDF file
 * @param pageCount - Number of pages to extract (default: 6)
 * @returns The extracted PDF as a new File and the total page count
 */
export async function extractFirstPages(
  file: File,
  pageCount: number = 6
): Promise<{ file: File; totalPages: number; extractedPages: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const totalPages = pdfDoc.getPageCount();

  const newPdf = await PDFDocument.create();
  const pagesToCopy = Math.min(pageCount, totalPages);

  const pages = await newPdf.copyPages(
    pdfDoc,
    Array.from({ length: pagesToCopy }, (_, i) => i)
  );
  pages.forEach((page) => newPdf.addPage(page));

  const pdfBytes = await newPdf.save();

  // Create a new file with a descriptive name
  // Create a proper ArrayBuffer copy to avoid SharedArrayBuffer type issues
  const baseName = file.name.replace(/\.pdf$/i, "");
  const outputBuffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(outputBuffer).set(pdfBytes);
  const extractedFile = new File(
    [outputBuffer],
    `${baseName}-toc.pdf`,
    { type: "application/pdf" }
  );

  return {
    file: extractedFile,
    totalPages,
    extractedPages: pagesToCopy,
  };
}
