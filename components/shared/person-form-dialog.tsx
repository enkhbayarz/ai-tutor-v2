"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
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
import { toast } from "sonner";
import { ZodSchema } from "zod";

export interface PersonFormData {
  lastName: string;
  firstName: string;
  grade?: string;
  group?: string;
  phone1: string;
  phone2: string;
}

type FormErrors = Partial<Record<keyof PersonFormData, string>>;

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
const GROUPS = ["А", "Б", "В", "Г", "Д"];

const initialFormData: PersonFormData = {
  lastName: "",
  firstName: "",
  grade: "",
  group: "",
  phone1: "",
  phone2: "",
};

interface PersonFormDialogProps {
  mode: "add" | "edit";
  entityType: "teacher" | "student";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  initialData?: Partial<PersonFormData>;
  onSubmit: (data: PersonFormData) => Promise<void>;
  validationSchema: ZodSchema;
  validationLimits: {
    lastName: { min: number; max: number };
    firstName: { min: number; max: number };
    phone: { length: number };
  };
  labels: {
    title: string;
    lastName: string;
    lastNamePlaceholder: string;
    firstName: string;
    firstNamePlaceholder: string;
    grade?: string;
    selectGrade?: string;
    group?: string;
    selectGroup?: string;
    phone1: string;
    phone2: string;
    phonePlaceholder: string;
    save: string;
    saving: string;
    success: string;
    error: string;
    fixErrors: string;
  };
  translateValidation: (key: string, params?: Record<string, unknown>) => string;
}

export function PersonFormDialog({
  mode,
  entityType,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
  initialData,
  onSubmit,
  validationSchema,
  validationLimits,
  labels,
  translateValidation,
}: PersonFormDialogProps) {
  const showGradeGroup = entityType === "student";
  const [internalOpen, setInternalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isFormValid, setIsFormValid] = useState(false);
  const [formData, setFormData] = useState<PersonFormData>(initialFormData);

  // Use controlled or uncontrolled mode
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled
    ? controlledOnOpenChange || (() => {})
    : setInternalOpen;

  // Populate form when initialData changes (edit mode)
  useEffect(() => {
    if (initialData && mode === "edit") {
      setFormData({
        lastName: initialData.lastName || "",
        firstName: initialData.firstName || "",
        grade: initialData.grade || "",
        group: initialData.group || "",
        phone1: initialData.phone1 || "",
        phone2: initialData.phone2 || "",
      });
      setErrors({});
    }
  }, [initialData, mode]);

  // Validate entire form
  const validateForm = useCallback(() => {
    const result = validationSchema.safeParse(formData);
    setIsFormValid(result.success);
    return result;
  }, [formData, validationSchema]);

  useEffect(() => {
    validateForm();
  }, [validateForm]);

  const translateError = (message: string, field: keyof PersonFormData) => {
    if (message.includes("Min") || message.includes("max")) {
      const limits = validationLimits[field as "lastName" | "firstName"];
      return translateValidation(message, limits || {});
    }
    if (message.includes("phoneLength")) {
      return translateValidation(message, { length: validationLimits.phone.length });
    }
    return translateValidation(message);
  };

  const validateField = (
    field: keyof PersonFormData,
    value: string
  ): string | undefined => {
    const testData = { ...formData, [field]: value };
    const result = validationSchema.safeParse(testData);

    if (!result.success) {
      const fieldError = result.error.issues.find(
        (issue) => issue.path[0] === field
      );
      if (fieldError) {
        return translateError(fieldError.message, field);
      }
    }
    return undefined;
  };

  const handleFieldChange = (field: keyof PersonFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleFieldBlur = (field: keyof PersonFormData) => {
    const error = validateField(field, formData[field] ?? "");
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = validateForm();
    if (!result.success) {
      const newErrors: FormErrors = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof PersonFormData;
        newErrors[field] = translateError(issue.message, field);
      });
      setErrors(newErrors);
      toast.error(labels.fixErrors);
      return;
    }

    setIsLoading(true);
    try {
      await onSubmit(formData);
      toast.success(labels.success);
      setOpen(false);
      if (mode === "add") {
        setFormData(initialFormData);
        setErrors({});
      }
    } catch {
      toast.error(labels.error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen && mode === "add") {
      setFormData(initialFormData);
      setErrors({});
    }
  };

  const content = (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>{labels.title}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        {/* Last Name */}
        <div className="space-y-2">
          <Label htmlFor={`${mode}-lastName`}>
            {labels.lastName} <span className="text-red-500">*</span>
          </Label>
          <Input
            id={`${mode}-lastName`}
            placeholder={labels.lastNamePlaceholder}
            value={formData.lastName}
            onChange={(e) => handleFieldChange("lastName", e.target.value)}
            onBlur={() => handleFieldBlur("lastName")}
            className={errors.lastName ? "border-red-500" : ""}
            maxLength={validationLimits.lastName.max}
          />
          {errors.lastName && (
            <p className="text-sm text-red-500">{errors.lastName}</p>
          )}
        </div>

        {/* First Name */}
        <div className="space-y-2">
          <Label htmlFor={`${mode}-firstName`}>
            {labels.firstName} <span className="text-red-500">*</span>
          </Label>
          <Input
            id={`${mode}-firstName`}
            placeholder={labels.firstNamePlaceholder}
            value={formData.firstName}
            onChange={(e) => handleFieldChange("firstName", e.target.value)}
            onBlur={() => handleFieldBlur("firstName")}
            className={errors.firstName ? "border-red-500" : ""}
            maxLength={validationLimits.firstName.max}
          />
          {errors.firstName && (
            <p className="text-sm text-red-500">{errors.firstName}</p>
          )}
        </div>

        {/* Grade and Group Row - Only shown for students */}
        {showGradeGroup && (
          <div className="grid grid-cols-2 gap-4">
            {/* Grade */}
            <div className="space-y-2">
              <Label>
                {labels.grade} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.grade || ""}
                onValueChange={(value) => handleFieldChange("grade", value)}
              >
                <SelectTrigger
                  className={`w-full ${errors.grade ? "border-red-500" : ""}`}
                >
                  <SelectValue placeholder={labels.selectGrade} />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((grade) => (
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
                {labels.group} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.group || ""}
                onValueChange={(value) => handleFieldChange("group", value)}
              >
                <SelectTrigger
                  className={`w-full ${errors.group ? "border-red-500" : ""}`}
                >
                  <SelectValue placeholder={labels.selectGroup} />
                </SelectTrigger>
                <SelectContent>
                  {GROUPS.map((group) => (
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
        )}

        {/* Phone 1 */}
        <div className="space-y-2">
          <Label htmlFor={`${mode}-phone1`}>
            {labels.phone1} <span className="text-red-500">*</span>
          </Label>
          <Input
            id={`${mode}-phone1`}
            type="tel"
            placeholder={labels.phonePlaceholder}
            value={formData.phone1}
            onChange={(e) => handleFieldChange("phone1", e.target.value)}
            onBlur={() => handleFieldBlur("phone1")}
            className={errors.phone1 ? "border-red-500" : ""}
            maxLength={validationLimits.phone.length}
          />
          {errors.phone1 && (
            <p className="text-sm text-red-500">{errors.phone1}</p>
          )}
        </div>

        {/* Phone 2 */}
        <div className="space-y-2">
          <Label htmlFor={`${mode}-phone2`}>{labels.phone2}</Label>
          <Input
            id={`${mode}-phone2`}
            type="tel"
            placeholder={labels.phonePlaceholder}
            value={formData.phone2}
            onChange={(e) => handleFieldChange("phone2", e.target.value)}
            onBlur={() => handleFieldBlur("phone2")}
            className={errors.phone2 ? "border-red-500" : ""}
            maxLength={validationLimits.phone.length}
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
          {isLoading ? labels.saving : labels.save}
        </Button>
      </form>
    </DialogContent>
  );

  // If trigger provided, render with trigger
  if (trigger && mode === "add") {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        {content}
      </Dialog>
    );
  }

  // Default trigger for add mode
  if (mode === "add" && !trigger && !isControlled) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            className="bg-blue-500 hover:bg-blue-600 rounded-full px-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            {labels.title}
          </Button>
        </DialogTrigger>
        {content}
      </Dialog>
    );
  }

  // Controlled mode (for edit)
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {content}
    </Dialog>
  );
}
