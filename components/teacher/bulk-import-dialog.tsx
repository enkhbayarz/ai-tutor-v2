"use client";

import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, Download, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { parseFile, generateTemplate, type ParsedRow } from "@/lib/bulk-import/parse-file";
import {
  validateRows,
  findDuplicatesInBatch,
  type BulkImportRow,
  type ValidationError,
} from "@/lib/validations/bulk-import";
import { BulkImportPreview } from "./bulk-import-preview";
import { BulkImportResults } from "./bulk-import-results";

type Step = "upload" | "preview" | "processing" | "results";

interface ImportResult {
  rowIndex: number;
  success: boolean;
  lastName?: string;
  firstName?: string;
  username?: string;
  tempPassword?: string;
  error?: string;
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
  labels: {
    title: string;
    uploadStep: string;
    previewStep: string;
    processStep: string;
    resultsStep: string;
    dragDrop: string;
    orClick: string;
    supportedFormats: string;
    downloadTemplate: string;
    rowCount: (count: number) => string;
    validRows: (count: number) => string;
    invalidRows: (count: number) => string;
    fixErrors: string;
    process: string;
    processing: string;
    back: string;
    close: string;
    // Preview labels
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
    // Results labels
    summary: string;
    total: string;
    success: string;
    failed: string;
    name: string;
    username: string;
    tempPassword: string;
    error: string;
    downloadResults: string;
    successStatus: string;
    failedStatus: string;
  };
}

export function BulkImportDialog({
  open,
  onOpenChange,
  onComplete,
  labels,
}: BulkImportDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [validRows, setValidRows] = useState<BulkImportRow[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [validIndices, setValidIndices] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [summary, setSummary] = useState({ total: 0, success: 0, failed: 0 });
  const [uploadError, setUploadError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setStep("upload");
    setFile(null);
    setParsedRows([]);
    setValidRows([]);
    setErrors([]);
    setValidIndices([]);
    setIsProcessing(false);
    setResults([]);
    setSummary({ total: 0, success: 0, failed: 0 });
    setUploadError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
    if (step === "results" && summary.success > 0) {
      onComplete?.();
    }
  }, [resetState, onOpenChange, step, summary.success, onComplete]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setUploadError(null);

    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];

    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      setUploadError("Invalid file type. Please upload CSV or XLSX file.");
      return;
    }

    setFile(selectedFile);

    try {
      const rows = await parseFile(selectedFile);
      setParsedRows(rows);

      // Validate rows
      const { valid, errors: validationErrors, validIndices: validIdx } = validateRows(rows);

      // Check for duplicates within batch
      const duplicates = findDuplicatesInBatch(valid);
      duplicates.forEach((message, index) => {
        validationErrors.push({
          rowIndex: validIdx[index],
          field: "phone1",
          message,
        });
      });

      setValidRows(valid);
      setErrors(validationErrors);
      setValidIndices(validIdx.filter((_, i) => !duplicates.has(i)));
      setStep("preview");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to parse file");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDownloadTemplate = useCallback(() => {
    const blob = generateTemplate();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "teacher_import_template.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleProcess = useCallback(async () => {
    if (validRows.length === 0) return;

    setIsProcessing(true);
    setStep("processing");

    try {
      const response = await fetch("/api/teachers/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: validRows }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Import failed");
      }

      setResults(data.results);
      setSummary(data.summary);
      setStep("results");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    } finally {
      setIsProcessing(false);
    }
  }, [validRows]);

  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: labels.uploadStep },
    { key: "preview", label: labels.previewStep },
    { key: "processing", label: labels.processStep },
    { key: "results", label: labels.resultsStep },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-4">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                  i <= currentStepIndex
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                )}
              >
                {i + 1}
              </div>
              <span
                className={cn(
                  "ml-2 text-sm hidden sm:inline",
                  i <= currentStepIndex
                    ? "text-blue-500 font-medium"
                    : "text-gray-500"
                )}
              >
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "w-8 h-0.5 mx-2",
                    i < currentStepIndex
                      ? "bg-blue-500"
                      : "bg-gray-200 dark:bg-gray-700"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {uploadError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}

          {step === "upload" && (
            <div className="space-y-4">
              {/* Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                onClick={() => document.getElementById("teacher-file-input")?.click()}
              >
                <input
                  id="teacher-file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                  {labels.dragDrop}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {labels.orClick}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  {labels.supportedFormats}
                </p>
              </div>

              {/* Download Template */}
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {labels.downloadTemplate}
                </Button>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              {/* File Info */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <FileSpreadsheet className="w-8 h-8 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium">{file?.name}</p>
                  <p className="text-sm text-gray-500">
                    {labels.rowCount(parsedRows.length)}
                  </p>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-600">
                    {labels.validRows(validIndices.length)}
                  </span>
                  <span className="text-red-600">
                    {labels.invalidRows(parsedRows.length - validIndices.length)}
                  </span>
                </div>
              </div>

              {/* Preview Table */}
              <BulkImportPreview
                rows={parsedRows}
                validRows={validRows}
                errors={errors}
                validIndices={validIndices}
                labels={{
                  rowNumber: labels.rowNumber,
                  lastName: labels.lastName,
                  firstName: labels.firstName,
                  grade: labels.grade,
                  group: labels.group,
                  phone1: labels.phone1,
                  phone2: labels.phone2,
                  status: labels.status,
                  valid: labels.valid,
                  invalid: labels.invalid,
                }}
              />

              {errors.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{labels.fixErrors}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {step === "processing" && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <p className="text-lg font-medium">{labels.processing}</p>
              <p className="text-sm text-gray-500">
                {validRows.length} teachers being processed...
              </p>
            </div>
          )}

          {step === "results" && (
            <BulkImportResults
              results={results}
              summary={summary}
              labels={{
                summary: labels.summary,
                total: labels.total,
                success: labels.success,
                failed: labels.failed,
                rowNumber: labels.rowNumber,
                name: labels.name,
                username: labels.username,
                tempPassword: labels.tempPassword,
                status: labels.status,
                error: labels.error,
                downloadResults: labels.downloadResults,
                successStatus: labels.successStatus,
                failedStatus: labels.failedStatus,
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between pt-4 border-t">
          <div>
            {step === "preview" && (
              <Button variant="outline" onClick={resetState}>
                {labels.back}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step === "preview" && validIndices.length > 0 && (
              <Button
                onClick={handleProcess}
                disabled={isProcessing}
                className="bg-blue-500 hover:bg-blue-600"
              >
                {labels.process}
              </Button>
            )}
            {step === "results" && (
              <Button onClick={handleClose}>{labels.close}</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
