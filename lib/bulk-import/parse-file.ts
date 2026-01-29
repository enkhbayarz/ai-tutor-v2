import * as XLSX from "xlsx";

export interface ParsedRow {
  lastName?: string;
  firstName?: string;
  grade?: string | number;
  group?: string;
  phone1?: string;
  phone2?: string;
}

/**
 * Parse CSV or XLSX file and extract student data
 * Expects columns: Овог, Нэр, Анги, Бүлэг, Утас 1, Утас 2
 */
export function parseFile(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Parse with Mongolian headers
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          worksheet,
          { defval: "" }
        );

        // Map Mongolian headers to our schema
        const rows: ParsedRow[] = rawRows.map((row) => {
          const gradeValue = row["Анги"] ?? row["grade"];
          return {
            lastName: String(row["Овог"] ?? row["lastName"] ?? "").trim(),
            firstName: String(row["Нэр"] ?? row["firstName"] ?? "").trim(),
            grade: typeof gradeValue === "number" ? gradeValue : String(gradeValue ?? ""),
            group: String(row["Бүлэг"] ?? row["group"] ?? "").trim(),
            phone1: String(row["Утас 1"] ?? row["phone1"] ?? "").trim(),
            phone2: String(row["Утас 2"] ?? row["phone2"] ?? "").trim() || undefined,
          };
        });

        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsBinaryString(file);
  });
}

/**
 * Generate downloadable template file
 */
export function generateTemplate(): Blob {
  const template = [
    ["Овог", "Нэр", "Анги", "Бүлэг", "Утас 1", "Утас 2"],
    ["Батболд", "Эрдэнэ", 10, "А", "99119911", "99229922"],
    ["Дорж", "Сарангэрэл", 10, "Б", "88118811", ""],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(template);

  // Set column widths
  worksheet["!cols"] = [
    { wch: 15 }, // Овог
    { wch: 15 }, // Нэр
    { wch: 8 }, // Анги
    { wch: 8 }, // Бүлэг
    { wch: 12 }, // Утас 1
    { wch: 12 }, // Утас 2
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Сурагчид");

  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Export import results to Excel file
 */
export function exportResults(
  results: Array<{
    rowIndex: number;
    success: boolean;
    lastName?: string;
    firstName?: string;
    username?: string;
    tempPassword?: string;
    error?: string;
  }>
): Blob {
  const data = results.map((r) => ({
    "№": r.rowIndex + 1,
    Овог: r.lastName ?? "",
    Нэр: r.firstName ?? "",
    "Нэвтрэх нэр": r.username ?? "",
    "Түр нууц үг": r.tempPassword ?? "",
    Төлөв: r.success ? "Амжилттай" : "Алдаатай",
    Алдаа: r.error ?? "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column widths
  worksheet["!cols"] = [
    { wch: 5 }, // №
    { wch: 15 }, // Овог
    { wch: 15 }, // Нэр
    { wch: 20 }, // Нэвтрэх нэр
    { wch: 15 }, // Түр нууц үг
    { wch: 12 }, // Төлөв
    { wch: 30 }, // Алдаа
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Үр дүн");

  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
