"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeacherBulkImportRow, TeacherValidationError } from "@/lib/validations/teacher-bulk-import";
import type { TeacherParsedRow } from "@/lib/bulk-import/teacher-parse-file";

interface BulkImportPreviewProps {
  rows: TeacherParsedRow[];
  validRows: TeacherBulkImportRow[];
  errors: TeacherValidationError[];
  validIndices: number[];
  labels: {
    rowNumber: string;
    lastName: string;
    firstName: string;
    phone1: string;
    phone2: string;
    status: string;
    valid: string;
    invalid: string;
  };
}

export function BulkImportPreview({
  rows,
  errors,
  validIndices,
  labels,
}: BulkImportPreviewProps) {
  // Group errors by row index
  const errorsByRow = new Map<number, TeacherValidationError[]>();
  errors.forEach((error) => {
    if (!errorsByRow.has(error.rowIndex)) {
      errorsByRow.set(error.rowIndex, []);
    }
    errorsByRow.get(error.rowIndex)!.push(error);
  });

  const validIndexSet = new Set(validIndices);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
              {labels.rowNumber}
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
              {labels.lastName}
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
              {labels.firstName}
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
              {labels.phone1}
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 hidden md:table-cell">
              {labels.phone2}
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
              {labels.status}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {rows.map((row, index) => {
            const isValid = validIndexSet.has(index);
            const rowErrors = errorsByRow.get(index) || [];
            const errorFields = new Set(rowErrors.map((e) => e.field));

            return (
              <tr
                key={index}
                className={cn(
                  "transition-colors",
                  !isValid && "bg-red-50 dark:bg-red-900/20"
                )}
              >
                <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                  {index + 1}
                </td>
                <td
                  className={cn(
                    "px-3 py-2",
                    errorFields.has("lastName") &&
                      "text-red-600 dark:text-red-400 font-medium"
                  )}
                >
                  {row.lastName || "-"}
                </td>
                <td
                  className={cn(
                    "px-3 py-2",
                    errorFields.has("firstName") &&
                      "text-red-600 dark:text-red-400 font-medium"
                  )}
                >
                  {row.firstName || "-"}
                </td>
                <td
                  className={cn(
                    "px-3 py-2",
                    errorFields.has("phone1") &&
                      "text-red-600 dark:text-red-400 font-medium"
                  )}
                >
                  {row.phone1 || "-"}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 hidden md:table-cell",
                    errorFields.has("phone2") &&
                      "text-red-600 dark:text-red-400 font-medium"
                  )}
                >
                  {row.phone2 || "-"}
                </td>
                <td className="px-3 py-2">
                  {isValid ? (
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs">{labels.valid}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                      <XCircle className="w-4 h-4" />
                      <span className="text-xs">{labels.invalid}</span>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
