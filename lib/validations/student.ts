// Student validation - uses shared person schema
// Can be extended with student-specific fields if needed
export {
  personFormSchema as studentFormSchema,
  type PersonFormData as StudentFormData,
  VALIDATION_LIMITS,
} from "./person";
