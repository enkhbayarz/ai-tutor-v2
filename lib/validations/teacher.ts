// Teacher validation - uses shared person schema
// Can be extended with teacher-specific fields if needed
export {
  personFormSchema as teacherFormSchema,
  type PersonFormData as TeacherFormData,
  VALIDATION_LIMITS,
} from "./person";
