import { z } from "zod";

/**
 * Validation schema for teacher bulk import rows (no grade/group)
 */
export const teacherBulkImportRowSchema = z.object({
  lastName: z.string().min(2, "bulkImport.errors.lastName").max(20),
  firstName: z.string().min(2, "bulkImport.errors.firstName").max(20),
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

export type TeacherBulkImportRow = z.infer<typeof teacherBulkImportRowSchema>;

export interface TeacherValidationError {
  rowIndex: number;
  field: string;
  message: string;
}

export interface TeacherValidationResult {
  valid: TeacherBulkImportRow[];
  errors: TeacherValidationError[];
  validIndices: number[];
}

/**
 * Validate all rows from parsed teacher file
 */
export function validateTeacherRows(rows: unknown[]): TeacherValidationResult {
  const valid: TeacherBulkImportRow[] = [];
  const errors: TeacherValidationError[] = [];
  const validIndices: number[] = [];

  rows.forEach((row, index) => {
    const result = teacherBulkImportRowSchema.safeParse(row);
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
export function findTeacherDuplicatesInBatch(
  rows: TeacherBulkImportRow[]
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
