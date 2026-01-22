"use client";

import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { BookOpen, Upload, X, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  accept: string;
  maxSize: number;
  mimeTypes: readonly string[];
  onUpload: (storageId: Id<"_storage">, fileName: string, previewUrl?: string) => void;
  onRemove?: () => void;
  existingUrl?: string | null;
  existingName?: string;
  label: string;
  hint: string;
  maxSizeLabel: string;
  error?: string;
  variant?: "pdf" | "image";
  // Controlled mode - restore from draft
  value?: {
    storageId: string | null;
    fileName: string | null;
    previewUrl: string | null;
  };
}

export function FileUpload({
  accept,
  maxSize,
  mimeTypes,
  onUpload,
  onRemove,
  existingUrl,
  existingName,
  label,
  hint,
  maxSizeLabel,
  error,
  variant = "pdf",
  value,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(existingName || null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl || null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Sync with controlled value prop (for draft restoration)
  const displayFileName = value?.fileName ?? fileName;
  const displayPreviewUrl = value?.previewUrl ?? previewUrl;

  const generateUploadUrl = useMutation(api.textbooks.generateUploadUrl);

  const validateFile = (file: File): string | null => {
    if (!mimeTypes.some((type) => file.type.match(type.replace("*", ".*")))) {
      return variant === "pdf" ? "validation.pdfInvalid" : "validation.imageInvalid";
    }
    if (file.size > maxSize) {
      return "validation.fileTooLarge";
    }
    return null;
  };

  const uploadFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setUploadError(validationError);
        return;
      }

      setIsUploading(true);
      setUploadError(null);
      setUploadProgress(0);

      try {
        // Get upload URL from Convex
        const uploadUrl = await generateUploadUrl();

        // Upload file using XMLHttpRequest for progress tracking
        const xhr = new XMLHttpRequest();

        await new Promise<void>((resolve, reject) => {
          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(progress);
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error("Upload failed"));
            }
          });

          xhr.addEventListener("error", () => reject(new Error("Upload failed")));

          xhr.open("POST", uploadUrl);
          xhr.send(file);
        });

        // Parse response to get storage ID
        const response = JSON.parse(xhr.responseText);
        const storageId = response.storageId as Id<"_storage">;

        // Set preview for images
        let imagePreviewUrl: string | undefined;
        if (variant === "image") {
          imagePreviewUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const result = e.target?.result as string;
              setPreviewUrl(result);
              resolve(result);
            };
            reader.readAsDataURL(file);
          });
        }

        setFileName(file.name);
        onUpload(storageId, file.name, imagePreviewUrl);
      } catch (err) {
        console.error("Upload error:", err);
        setUploadError("error");
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [generateUploadUrl, maxSize, mimeTypes, onUpload, variant]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        uploadFile(file);
      }
    },
    [uploadFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        uploadFile(file);
      }
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [uploadFile]
  );

  const handleRemove = () => {
    setFileName(null);
    setPreviewUrl(null);
    setUploadError(null);
    onRemove?.();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>

      {/* Upload area or preview */}
      {!displayFileName && !displayPreviewUrl ? (
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer",
            isDragging
              ? "border-blue-500 bg-blue-50"
              : error || uploadError
                ? "border-red-300 bg-red-50"
                : "border-gray-200 hover:border-gray-300"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById(`file-input-${variant}`)?.click()}
        >
          <input
            id={`file-input-${variant}`}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex flex-col items-center text-center">
            {isUploading ? (
              <>
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                <p className="text-sm text-gray-600">{uploadProgress}%</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mb-3">
                  {variant === "pdf" ? (
                    <BookOpen className="w-6 h-6 text-gray-400" />
                  ) : (
                    <Upload className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <p className="text-sm">
                  <span className="text-blue-500 font-medium">{hint}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">{maxSizeLabel}</p>
              </>
            )}
          </div>
        </div>
      ) : variant === "image" && displayPreviewUrl ? (
        // Image preview
        <div className="relative rounded-lg overflow-hidden border border-gray-200">
          <img
            src={displayPreviewUrl}
            alt="Thumbnail preview"
            className="w-full h-48 object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      ) : (
        // PDF file preview
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{displayFileName}</p>
            {isUploading && (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{uploadProgress}%</span>
              </div>
            )}
          </div>
          {!isUploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
      )}

      {/* Error message */}
      {(error || uploadError) && (
        <p className="text-sm text-red-500">{error || uploadError}</p>
      )}
    </div>
  );
}
