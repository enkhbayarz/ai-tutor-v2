import { z } from "zod";

/**
 * Validation schema for bulk import rows
 * More lenient than form validation to handle Excel data variations
 */
export const bulkImportRowSchema = z.object({
  lastName: z.string().min(2, "bulkImport.errors.lastName").max(20),
  firstName: z.string().min(2, "bulkImport.errors.firstName").max(20),
  grade: z.coerce.number().int().min(1).max(12, "bulkImport.errors.grade"),
  group: z
    .string()
    .min(1)
    .max(2)
    .regex(/^[А-Яа-яA-Za-z]+$/, "bulkImport.errors.group"),
  phone1: z
    .string()
    .length(8, "bulkImport.errors.phone1")
    .regex(/^\d+$/, "bulkImport.errors.phone1"),
  phone2: z
    .string()
    .refine((val) => val === "" || (val.length === 8 && /^\d+$/.test(val)), {
      message: "bulkImport.errors.phone2",
    })
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
});

export type BulkImportRow = z.infer<typeof bulkImportRowSchema>;

export interface ValidationError {
  rowIndex: number;
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: BulkImportRow[];
  errors: ValidationError[];
  validIndices: number[];
}

/**
 * Validate all rows from parsed file
 * @param rows - Parsed rows from Excel/CSV
 * @returns Validation result with valid rows and errors
 */
export function validateRows(rows: unknown[]): ValidationResult {
  const valid: BulkImportRow[] = [];
  const errors: ValidationError[] = [];
  const validIndices: number[] = [];

  rows.forEach((row, index) => {
    const result = bulkImportRowSchema.safeParse(row);
    if (result.success) {
      valid.push(result.data);
      validIndices.push(index);
    } else {
      result.error.issues.forEach((issue) => {
        errors.push({
          rowIndex: index,
          field: issue.path.join(".") || "unknown",
          message: issue.message,
        });
      });
    }
  });

  return { valid, errors, validIndices };
}

/**
 * Check for duplicate phone numbers within the import batch
 */
export function findDuplicatesInBatch(
  rows: BulkImportRow[]
): Map<number, string> {
  const phoneToIndex = new Map<string, number>();
  const duplicates = new Map<number, string>();

  rows.forEach((row, index) => {
    const phone = row.phone1;
    if (phoneToIndex.has(phone)) {
      duplicates.set(index, `Duplicate phone: ${phone}`);
    } else {
      phoneToIndex.set(phone, index);
    }
  });

  return duplicates;
}
