"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, BookOpen } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { FileUpload, TableOfContents, TOCChapter } from "@/components/textbook";
import {
  textbookFormSchema,
  TextbookFormData,
  FILE_LIMITS,
  SUBJECT_OPTIONS,
  TYPE_OPTIONS,
  STATUS_OPTIONS,
  GRADE_OPTIONS,
  getYearOptions,
} from "@/lib/validations/textbook";

export default function EditTextbookPage() {
  const t = useTranslations("textbooks");
  const tForm = useTranslations("textbookForm");
  const tToc = useTranslations("toc");
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const textbookId = params.id as Id<"textbooks">;

  const [formData, setFormData] = useState<Partial<TextbookFormData>>({});
  const [pdfFileId, setPdfFileId] = useState<Id<"_storage"> | null>(null);
  const [thumbnailId, setThumbnailId] = useState<Id<"_storage"> | null>(null);
  const [originalPdfId, setOriginalPdfId] = useState<Id<"_storage"> | null>(null);
  const [originalThumbnailId, setOriginalThumbnailId] = useState<Id<"_storage"> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const textbook = useQuery(api.textbooks.getById, { id: textbookId });
  const updateTextbook = useMutation(api.textbooks.update);
  const deleteFile = useMutation(api.textbooks.deleteFile);

  const yearOptions = getYearOptions();

  // Initialize form with existing data
  useEffect(() => {
    if (textbook && !isInitialized) {
      setFormData({
        subjectName: textbook.subjectName,
        grade: textbook.grade.toString(),
        year: textbook.year.toString(),
        type: textbook.type,
        isValid: textbook.isValid.toString(),
        notes: textbook.notes || "",
      });
      setPdfFileId(textbook.pdfFileId);
      setThumbnailId(textbook.thumbnailId);
      setOriginalPdfId(textbook.pdfFileId);
      setOriginalThumbnailId(textbook.thumbnailId);
      setIsInitialized(true);
    }
  }, [textbook, isInitialized]);

  const handleFieldChange = (field: keyof TextbookFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const result = textbookFormSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        const field = err.path[0] as string;
        fieldErrors[field] = tForm(err.message);
      });
      setErrors(fieldErrors);
      return false;
    }

    if (!pdfFileId) {
      setErrors((prev) => ({ ...prev, pdf: tForm("validation.pdfRequired") }));
      return false;
    }
    if (!thumbnailId) {
      setErrors((prev) => ({
        ...prev,
        thumbnail: tForm("validation.thumbnailRequired"),
      }));
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast.error(tForm("validation.fixErrors"));
      return;
    }

    setIsSaving(true);
    try {
      await updateTextbook({
        id: textbookId,
        subjectName: formData.subjectName!,
        grade: parseInt(formData.grade!),
        year: parseInt(formData.year!),
        type: formData.type!,
        isValid: formData.isValid === "true",
        pdfFileId: pdfFileId!,
        thumbnailId: thumbnailId!,
        notes: formData.notes || undefined,
      });

      // Re-trigger PDF text extraction if PDF was replaced
      if (pdfFileId !== originalPdfId) {
        fetch("/api/extract-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ textbookId }),
        }).catch((err) => {
          console.error("PDF extraction failed:", err);
        });
      }

      toast.success(tForm("updateSuccess"));
      router.push(`/${locale}/textbook`);
    } catch (error) {
      console.error("Error updating textbook:", error);
      toast.error(tForm("error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePdfRemove = async () => {
    // Only delete from storage if it's a new file (not the original)
    if (pdfFileId && pdfFileId !== originalPdfId) {
      try {
        await deleteFile({ storageId: pdfFileId });
      } catch (error) {
        console.error("Error deleting PDF:", error);
      }
    }
    setPdfFileId(null);
  };

  const handleThumbnailRemove = async () => {
    if (thumbnailId && thumbnailId !== originalThumbnailId) {
      try {
        await deleteFile({ storageId: thumbnailId });
      } catch (error) {
        console.error("Error deleting thumbnail:", error);
      }
    }
    setThumbnailId(null);
  };

  // Loading state
  if (textbook === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Not found
  if (textbook === null) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Textbook not found</p>
        <Link href={`/${locale}/textbook`}>
          <Button variant="link" className="mt-4">
            {tForm("back")}
          </Button>
        </Link>
      </div>
    );
  }

  const isFormValid =
    formData.subjectName &&
    formData.grade &&
    formData.year &&
    formData.type &&
    formData.isValid &&
    pdfFileId &&
    thumbnailId;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/${locale}/textbook`}>
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{tForm("editTitle")}</h1>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!isFormValid || isSaving}
          className="bg-blue-500 hover:bg-blue-600 rounded-full px-6"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? tForm("saving") : tForm("save")}
        </Button>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Form fields */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic info card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Subject */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {tForm("subjectName")}
                </label>
                <Select
                  value={formData.subjectName}
                  onValueChange={(v) => handleFieldChange("subjectName", v)}
                >
                  <SelectTrigger className={`w-full ${errors.subjectName ? "border-red-500" : ""}`}>
                    <SelectValue placeholder={tForm("selectSubject")} />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {t(opt.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.subjectName && (
                  <p className="text-sm text-red-500">{errors.subjectName}</p>
                )}
              </div>

              {/* Grade */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {tForm("grade")}
                </label>
                <Select
                  value={formData.grade}
                  onValueChange={(v) => handleFieldChange("grade", v)}
                >
                  <SelectTrigger className={`w-full ${errors.grade ? "border-red-500" : ""}`}>
                    <SelectValue placeholder={tForm("selectGrade")} />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.grade && (
                  <p className="text-sm text-red-500">{errors.grade}</p>
                )}
              </div>

              {/* Year */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {tForm("year")}
                </label>
                <Select
                  value={formData.year}
                  onValueChange={(v) => handleFieldChange("year", v)}
                >
                  <SelectTrigger className={`w-full ${errors.year ? "border-red-500" : ""}`}>
                    <SelectValue placeholder={tForm("selectYear")} />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.year && (
                  <p className="text-sm text-red-500">{errors.year}</p>
                )}
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {tForm("isValid")}
                </label>
                <Select
                  value={formData.isValid}
                  onValueChange={(v) => handleFieldChange("isValid", v)}
                >
                  <SelectTrigger className={`w-full ${errors.isValid ? "border-red-500" : ""}`}>
                    <SelectValue placeholder={tForm("selectStatus")} />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {t(opt.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.isValid && (
                  <p className="text-sm text-red-500">{errors.isValid}</p>
                )}
              </div>
            </div>

            {/* Type - full width */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                {tForm("type")}
              </label>
              <Select
                value={formData.type}
                onValueChange={(v) => handleFieldChange("type", v)}
              >
                <SelectTrigger className={`w-full ${errors.type ? "border-red-500" : ""}`}>
                  <SelectValue placeholder={tForm("selectType")} />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(opt.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-sm text-red-500">{errors.type}</p>
              )}
            </div>
          </div>

          {/* PDF upload card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <FileUpload
              accept={FILE_LIMITS.pdf.accept}
              maxSize={FILE_LIMITS.pdf.maxSize}
              mimeTypes={FILE_LIMITS.pdf.mimeTypes}
              onUpload={(id) => setPdfFileId(id)}
              onRemove={handlePdfRemove}
              existingUrl={textbook.pdfUrl}
              existingName={`${t(`subjects.${textbook.subjectName}`)} ${textbook.grade}.pdf`}
              label={tForm("pdfFile")}
              hint={tForm("uploadHint")}
              maxSizeLabel={tForm("maxSize", { size: "50MB" })}
              error={errors.pdf}
              variant="pdf"
            />
          </div>

          {/* Table of Contents card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                {tToc("title")}
              </h2>
            </div>

            <TableOfContents
              textbookId={textbookId}
              chapters={(textbook.tableOfContents || []) as TOCChapter[]}
              isEditing={true}
            />
          </div>
        </div>

        {/* Right column - Thumbnail & Notes */}
        <div className="space-y-6">
          {/* Thumbnail upload */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <FileUpload
              accept={FILE_LIMITS.thumbnail.accept}
              maxSize={FILE_LIMITS.thumbnail.maxSize}
              mimeTypes={FILE_LIMITS.thumbnail.mimeTypes}
              onUpload={(id) => setThumbnailId(id)}
              onRemove={handleThumbnailRemove}
              existingUrl={textbook.thumbnailUrl}
              label={tForm("thumbnail")}
              hint={tForm("uploadHint")}
              maxSizeLabel={tForm("maxSize", { size: "200KB" })}
              error={errors.thumbnail}
              variant="image"
            />
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                {tForm("notes")}
              </label>
              <Textarea
                value={formData.notes || ""}
                onChange={(e) => handleFieldChange("notes", e.target.value)}
                placeholder={tForm("notesPlaceholder")}
                rows={4}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
