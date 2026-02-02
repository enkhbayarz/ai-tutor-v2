"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BulkImportRow, ValidationError } from "@/lib/validations/bulk-import";
import type { ParsedRow } from "@/lib/bulk-import/parse-file";

interface BulkImportPreviewProps {
  rows: ParsedRow[];
  validRows: BulkImportRow[];
  errors: ValidationError[];
  validIndices: number[];
  labels: {
    rowNumber: string;
    lastName: string;
    firstName: string;
    grade: string;
    group: string;
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
  const errorsByRow = new Map<number, ValidationError[]>();
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
              {labels.grade}
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
              {labels.group}
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
                    errorFields.has("grade") &&
                      "text-red-600 dark:text-red-400 font-medium"
                  )}
                >
                  {row.grade || "-"}
                </td>
                <td
                  className={cn(
                    "px-3 py-2",
                    errorFields.has("group") &&
                      "text-red-600 dark:text-red-400 font-medium"
                  )}
                >
                  {row.group || "-"}
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
