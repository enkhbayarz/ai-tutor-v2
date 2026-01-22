import { z } from "zod";

// Shared validation schema for person entities (teachers, students)
// Can be extended or customized per entity if needed
export const personFormSchema = z.object({
  lastName: z
    .string()
    .min(2, "validation.lastNameMin")
    .max(20, "validation.lastNameMax"),
  firstName: z
    .string()
    .min(2, "validation.firstNameMin")
    .max(20, "validation.firstNameMax"),
  grade: z.string().min(1, "validation.gradeRequired"),
  group: z.string().min(1, "validation.groupRequired"),
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

export type PersonFormData = z.infer<typeof personFormSchema>;

export const VALIDATION_LIMITS = {
  lastName: { min: 2, max: 20 },
  firstName: { min: 2, max: 20 },
  phone: { length: 8 },
} as const;
