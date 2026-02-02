import * as XLSX from "xlsx";

export interface TeacherParsedRow {
  lastName?: string;
  firstName?: string;
  phone1?: string;
  phone2?: string;
}

/**
 * Parse CSV or XLSX file and extract teacher data (no grade/group)
 * Expects columns: Овог, Нэр, Утас 1, Утас 2
 */
export function parseTeacherFile(file: File): Promise<TeacherParsedRow[]> {
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

        // Map Mongolian headers to our schema (no grade/group for teachers)
        const rows: TeacherParsedRow[] = rawRows.map((row) => {
          return {
            lastName: String(row["Овог"] ?? row["lastName"] ?? "").trim(),
            firstName: String(row["Нэр"] ?? row["firstName"] ?? "").trim(),
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
 * Generate downloadable teacher template file (no grade/group)
 */
export function generateTeacherTemplate(): Blob {
  const template = [
    ["Овог", "Нэр", "Утас 1", "Утас 2"],
    ["Батболд", "Эрдэнэ", "99119911", "99229922"],
    ["Дорж", "Сарангэрэл", "88118811", ""],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(template);

  // Set column widths
  worksheet["!cols"] = [
    { wch: 15 }, // Овог
    { wch: 15 }, // Нэр
    { wch: 12 }, // Утас 1
    { wch: 12 }, // Утас 2
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Багш нар");

  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
