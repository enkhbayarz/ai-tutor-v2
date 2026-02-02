"use client";

import { CheckCircle2, XCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportResults } from "@/lib/bulk-import/parse-file";

interface ImportResult {
  rowIndex: number;
  success: boolean;
  lastName?: string;
  firstName?: string;
  username?: string;
  tempPassword?: string;
  error?: string;
}

interface BulkImportResultsProps {
  results: ImportResult[];
  summary: {
    total: number;
    success: number;
    failed: number;
  };
  labels: {
    summary: string;
    total: string;
    success: string;
    failed: string;
    rowNumber: string;
    name: string;
    username: string;
    tempPassword: string;
    status: string;
    error: string;
    downloadResults: string;
    successStatus: string;
    failedStatus: string;
  };
}

export function BulkImportResults({
  results,
  summary,
  labels,
}: BulkImportResultsProps) {
  const handleDownload = () => {
    const blob = exportResults(results);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teacher_import_results_${new Date().toISOString().split("T")[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {summary.total}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {labels.total}
          </div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {summary.success}
          </div>
          <div className="text-sm text-green-600 dark:text-green-400">
            {labels.success}
          </div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {summary.failed}
          </div>
          <div className="text-sm text-red-600 dark:text-red-400">
            {labels.failed}
          </div>
        </div>
      </div>

      {/* Download Button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="w-4 h-4 mr-2" />
          {labels.downloadResults}
        </Button>
      </div>

      {/* Results Table */}
      <div className="overflow-x-auto max-h-80">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                {labels.rowNumber}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                {labels.name}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                {labels.username}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                {labels.tempPassword}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                {labels.status}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {results.map((result) => (
              <tr
                key={result.rowIndex}
                className={
                  !result.success ? "bg-red-50 dark:bg-red-900/20" : ""
                }
              >
                <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                  {result.rowIndex + 1}
                </td>
                <td className="px-3 py-2">
                  {result.lastName} {result.firstName}
                </td>
                <td className="px-3 py-2 font-mono text-sm">
                  {result.username || "-"}
                </td>
                <td className="px-3 py-2 font-mono text-sm">
                  {result.tempPassword || "-"}
                </td>
                <td className="px-3 py-2">
                  {result.success ? (
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs">{labels.successStatus}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                        <XCircle className="w-4 h-4" />
                        <span className="text-xs">{labels.failedStatus}</span>
                      </div>
                      {result.error && (
                        <span className="text-xs text-red-500 dark:text-red-400">
                          {result.error}
                        </span>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
