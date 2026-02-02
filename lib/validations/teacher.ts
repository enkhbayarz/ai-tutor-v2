import { z } from "zod";

// Teacher-specific validation schema (no grade/group)
export const teacherFormSchema = z.object({
  lastName: z
    .string()
    .min(2, "validation.lastNameMin")
    .max(20, "validation.lastNameMax"),
  firstName: z
    .string()
    .min(2, "validation.firstNameMin")
    .max(20, "validation.firstNameMax"),
  phone1: z
    .string()
    .min(1, "validation.phone1Required")
    .regex(/^\d+$/, "validation.phoneDigitsOnly")
    .length(8, "validation.phoneLength"),
  phone2: z
    .string()
    .regex(/^\d*$/, "validation.phoneDigitsOnly")
    .refine((val) => val === "" || val.length === 8, {
      message: "validation.phoneLength",
    })
    .optional()
    .or(z.literal("")),
});

export type TeacherFormData = z.infer<typeof teacherFormSchema>;

export const VALIDATION_LIMITS = {
  lastName: { min: 2, max: 20 },
  firstName: { min: 2, max: 20 },
  phone: { length: 8 },
} as const;
