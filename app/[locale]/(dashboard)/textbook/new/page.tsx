"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useMutation } from "convex/react";
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
import { FileUpload } from "@/components/textbook";
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

export default function AddTextbookPage() {
  const t = useTranslations("textbooks");
  const tForm = useTranslations("textbookForm");
  const locale = useLocale();
  const router = useRouter();

  const [formData, setFormData] = useState<Partial<TextbookFormData>>({});
  const [pdfFileId, setPdfFileId] = useState<Id<"_storage"> | null>(null);
  const [thumbnailId, setThumbnailId] = useState<Id<"_storage"> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const createTextbook = useMutation(api.textbooks.create);
  const deleteFile = useMutation(api.textbooks.deleteFile);

  const yearOptions = getYearOptions();

  const handleFieldChange = (field: keyof TextbookFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field changes
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

    // Validate files
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
      await createTextbook({
        subjectName: formData.subjectName!,
        grade: parseInt(formData.grade!),
        year: parseInt(formData.year!),
        type: formData.type!,
        isValid: formData.isValid === "true",
        pdfFileId: pdfFileId!,
        thumbnailId: thumbnailId!,
        notes: formData.notes || undefined,
      });

      toast.success(tForm("success"));
      router.push(`/${locale}/textbook`);
    } catch (error) {
      console.error("Error creating textbook:", error);
      toast.error(tForm("error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePdfRemove = async () => {
    if (pdfFileId) {
      try {
        await deleteFile({ storageId: pdfFileId });
      } catch (error) {
        console.error("Error deleting PDF:", error);
      }
    }
    setPdfFileId(null);
  };

  const handleThumbnailRemove = async () => {
    if (thumbnailId) {
      try {
        await deleteFile({ storageId: thumbnailId });
      } catch (error) {
        console.error("Error deleting thumbnail:", error);
      }
    }
    setThumbnailId(null);
  };

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
          <h1 className="text-2xl font-bold">{tForm("title")}</h1>
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
              onUpload={setPdfFileId}
              onRemove={handlePdfRemove}
              label={tForm("pdfFile")}
              hint={tForm("uploadHint")}
              maxSizeLabel={tForm("maxSize", { size: "50MB" })}
              error={errors.pdf}
              variant="pdf"
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
              onUpload={setThumbnailId}
              onRemove={handleThumbnailRemove}
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
