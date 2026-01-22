import { z } from "zod";

export const textbookFormSchema = z.object({
  subjectName: z.string().min(1, "validation.subjectRequired"),
  grade: z.string().min(1, "validation.gradeRequired"),
  year: z.string().min(1, "validation.yearRequired"),
  isValid: z.string().min(1, "validation.statusRequired"),
  type: z.string().min(1, "validation.typeRequired"),
  notes: z.string().optional(),
});

export type TextbookFormData = z.infer<typeof textbookFormSchema>;

// File validation constants
export const FILE_LIMITS = {
  pdf: {
    maxSize: 50 * 1024 * 1024, // 50MB
    accept: ".pdf",
    mimeTypes: ["application/pdf"],
  },
  thumbnail: {
    maxSize: 200 * 1024, // 200KB
    accept: "image/*",
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
} as const;

// Subject options
export const SUBJECT_OPTIONS = [
  { value: "math", label: "subjects.math" },
  { value: "physics", label: "subjects.physics" },
  { value: "mongolian", label: "subjects.mongolian" },
  { value: "english", label: "subjects.english" },
  { value: "history", label: "subjects.history" },
  { value: "geography", label: "subjects.geography" },
  { value: "biology", label: "subjects.biology" },
  { value: "chemistry", label: "subjects.chemistry" },
  { value: "informatics", label: "subjects.informatics" },
] as const;

// Type options
export const TYPE_OPTIONS = [
  { value: "basic", label: "types.basic" },
  { value: "exercise", label: "types.exercise" },
  { value: "workbook", label: "types.workbook" },
] as const;

// Status options
export const STATUS_OPTIONS = [
  { value: "true", label: "valid" },
  { value: "false", label: "invalid" },
] as const;

// Year options (current year - 5 to current year + 1)
export const getYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = currentYear + 1; year >= currentYear - 5; year--) {
    years.push({ value: year.toString(), label: year.toString() });
  }
  return years;
};

// Grade options (1-12)
export const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: (i + 1).toString(),
  label: `${i + 1}-р анги`,
}));
