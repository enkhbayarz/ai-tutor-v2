"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus } from "lucide-react";
import {
  teacherFormSchema,
  TeacherFormData,
  VALIDATION_LIMITS,
} from "@/lib/validations/teacher";

interface AddTeacherDialogProps {
  trigger?: React.ReactNode;
}

type FormErrors = Partial<Record<keyof TeacherFormData, string>>;

const initialFormData: TeacherFormData = {
  lastName: "",
  firstName: "",
  grade: "",
  group: "",
  phone1: "",
  phone2: "",
};

export function AddTeacherDialog({ trigger }: AddTeacherDialogProps) {
  const t = useTranslations("teacherForm");
  const tCommon = useTranslations("teachers");
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isFormValid, setIsFormValid] = useState(false);
  const [formData, setFormData] = useState<TeacherFormData>(initialFormData);

  const createTeacher = useMutation(api.teachers.create);

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
        // Return translation key with parameters
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

    // Clear error when user starts typing
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

    const result = validateForm();
    if (!result.success) {
      // Show all errors
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
      await createTeacher({
        lastName: formData.lastName.trim(),
        firstName: formData.firstName.trim(),
        grade: parseInt(formData.grade),
        group: formData.group,
        phone1: formData.phone1.trim(),
        phone2: formData.phone2?.trim() || undefined,
      });

      toast.success(t("success"));
      setOpen(false);
      setFormData(initialFormData);
      setErrors({});
    } catch {
      toast.error(t("error"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setFormData(initialFormData);
      setErrors({});
    }
  };

  const grades = Array.from({ length: 12 }, (_, i) => i + 1);
  const groups = ["А", "Б", "В", "Г", "Д"];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            size="sm"
            className="bg-blue-500 hover:bg-blue-600 rounded-full px-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            {tCommon("addTeacher")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Last Name */}
          <div className="space-y-2">
            <Label htmlFor="lastName">
              {t("lastName")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="lastName"
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
            <Label htmlFor="firstName">
              {t("firstName")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="firstName"
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
            <Label htmlFor="phone1">
              {t("phone1")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="phone1"
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
            <Label htmlFor="phone2">{t("phone2")}</Label>
            <Input
              id="phone2"
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
            {isLoading ? t("saving") : t("save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
