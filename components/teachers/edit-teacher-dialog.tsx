"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  teacherFormSchema,
  TeacherFormData,
  VALIDATION_LIMITS,
} from "@/lib/validations/teacher";

interface TeacherData {
  _id: Id<"teachers">;
  lastName: string;
  firstName: string;
  grade: number;
  group: string;
  phone1: string;
  phone2?: string;
}

interface EditTeacherDialogProps {
  teacher: TeacherData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FormErrors = Partial<Record<keyof TeacherFormData, string>>;

export function EditTeacherDialog({
  teacher,
  open,
  onOpenChange,
}: EditTeacherDialogProps) {
  const t = useTranslations("teacherForm");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isFormValid, setIsFormValid] = useState(false);

  const [formData, setFormData] = useState<TeacherFormData>({
    lastName: "",
    firstName: "",
    grade: "",
    group: "",
    phone1: "",
    phone2: "",
  });

  const updateTeacher = useMutation(api.teachers.update);

  // Populate form when teacher changes
  useEffect(() => {
    if (teacher) {
      setFormData({
        lastName: teacher.lastName,
        firstName: teacher.firstName,
        grade: teacher.grade.toString(),
        group: teacher.group,
        phone1: teacher.phone1,
        phone2: teacher.phone2 || "",
      });
      setErrors({});
    }
  }, [teacher]);

  // Validate entire form and update button state
  const validateForm = useCallback(() => {
    const result = teacherFormSchema.safeParse(formData);
    setIsFormValid(result.success);
    return result;
  }, [formData]);

  // Run validation whenever form data changes
  useEffect(() => {
    validateForm();
  }, [validateForm]);

  const validateField = (
    field: keyof TeacherFormData,
    value: string
  ): string | undefined => {
    const testData = { ...formData, [field]: value };
    const result = teacherFormSchema.safeParse(testData);

    if (!result.success) {
      const fieldError = result.error.issues.find(
        (issue) => issue.path[0] === field
      );
      if (fieldError) {
        const message = fieldError.message;
        if (message.includes("Min") || message.includes("max")) {
          return t(message, VALIDATION_LIMITS[field as "lastName" | "firstName"] || {});
        }
        if (message.includes("phoneLength")) {
          return t(message, { length: VALIDATION_LIMITS.phone.length });
        }
        return t(message);
      }
    }
    return undefined;
  };

  const handleFieldChange = (field: keyof TeacherFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleFieldBlur = (field: keyof TeacherFormData) => {
    const error = validateField(field, formData[field] ?? "");
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!teacher) return;

    const result = validateForm();
    if (!result.success) {
      const newErrors: FormErrors = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof TeacherFormData;
        const message = issue.message;
        if (message.includes("Min") || message.includes("max")) {
          newErrors[field] = t(message, VALIDATION_LIMITS[field as "lastName" | "firstName"] || {});
        } else if (message.includes("phoneLength")) {
          newErrors[field] = t(message, { length: VALIDATION_LIMITS.phone.length });
        } else {
          newErrors[field] = t(message);
        }
      });
      setErrors(newErrors);
      toast.error(t("validation.fixErrors"));
      return;
    }

    setIsLoading(true);
    try {
      await updateTeacher({
        id: teacher._id,
        lastName: formData.lastName.trim(),
        firstName: formData.firstName.trim(),
        grade: parseInt(formData.grade),
        group: formData.group,
        phone1: formData.phone1.trim(),
        phone2: formData.phone2?.trim() || undefined,
      });

      toast.success(t("updateSuccess"));
      onOpenChange(false);
    } catch {
      toast.error(t("error"));
    } finally {
      setIsLoading(false);
    }
  };

  const grades = Array.from({ length: 12 }, (_, i) => i + 1);
  const groups = ["А", "Б", "В", "Г", "Д"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Last Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-lastName">
              {t("lastName")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="edit-lastName"
              placeholder={t("lastNamePlaceholder")}
              value={formData.lastName}
              onChange={(e) => handleFieldChange("lastName", e.target.value)}
              onBlur={() => handleFieldBlur("lastName")}
              className={errors.lastName ? "border-red-500" : ""}
              maxLength={VALIDATION_LIMITS.lastName.max}
            />
            {errors.lastName && (
              <p className="text-sm text-red-500">{errors.lastName}</p>
            )}
          </div>

          {/* First Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-firstName">
              {t("firstName")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="edit-firstName"
              placeholder={t("firstNamePlaceholder")}
              value={formData.firstName}
              onChange={(e) => handleFieldChange("firstName", e.target.value)}
              onBlur={() => handleFieldBlur("firstName")}
              className={errors.firstName ? "border-red-500" : ""}
              maxLength={VALIDATION_LIMITS.firstName.max}
            />
            {errors.firstName && (
              <p className="text-sm text-red-500">{errors.firstName}</p>
            )}
          </div>

          {/* Grade and Group Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Grade */}
            <div className="space-y-2">
              <Label>
                {t("grade")} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.grade}
                onValueChange={(value) => handleFieldChange("grade", value)}
              >
                <SelectTrigger
                  className={`w-full ${errors.grade ? "border-red-500" : ""}`}
                >
                  <SelectValue placeholder={t("selectGrade")} />
                </SelectTrigger>
                <SelectContent>
                  {grades.map((grade) => (
                    <SelectItem key={grade} value={grade.toString()}>
                      {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.grade && (
                <p className="text-sm text-red-500">{errors.grade}</p>
              )}
            </div>

            {/* Group */}
            <div className="space-y-2">
              <Label>
                {t("group")} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.group}
                onValueChange={(value) => handleFieldChange("group", value)}
              >
                <SelectTrigger
                  className={`w-full ${errors.group ? "border-red-500" : ""}`}
                >
                  <SelectValue placeholder={t("selectGroup")} />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group} value={group}>
                      {group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.group && (
                <p className="text-sm text-red-500">{errors.group}</p>
              )}
            </div>
          </div>

          {/* Phone 1 */}
          <div className="space-y-2">
            <Label htmlFor="edit-phone1">
              {t("phone1")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="edit-phone1"
              type="tel"
              placeholder={t("phonePlaceholder")}
              value={formData.phone1}
              onChange={(e) => handleFieldChange("phone1", e.target.value)}
              onBlur={() => handleFieldBlur("phone1")}
              className={errors.phone1 ? "border-red-500" : ""}
              maxLength={VALIDATION_LIMITS.phone.length}
            />
            {errors.phone1 && (
              <p className="text-sm text-red-500">{errors.phone1}</p>
            )}
          </div>

          {/* Phone 2 */}
          <div className="space-y-2">
            <Label htmlFor="edit-phone2">{t("phone2")}</Label>
            <Input
              id="edit-phone2"
              type="tel"
              placeholder={t("phonePlaceholder")}
              value={formData.phone2}
              onChange={(e) => handleFieldChange("phone2", e.target.value)}
              onBlur={() => handleFieldBlur("phone2")}
              className={errors.phone2 ? "border-red-500" : ""}
              maxLength={VALIDATION_LIMITS.phone.length}
            />
            {errors.phone2 && (
              <p className="text-sm text-red-500">{errors.phone2}</p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            disabled={!isFormValid || isLoading}
          >
            {isLoading ? t("saving") : t("update")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
