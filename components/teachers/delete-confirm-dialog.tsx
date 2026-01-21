"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TeacherData {
  _id: Id<"teachers">;
  lastName: string;
  firstName: string;
}

interface DeleteConfirmDialogProps {
  teacher: TeacherData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteConfirmDialog({
  teacher,
  open,
  onOpenChange,
}: DeleteConfirmDialogProps) {
  const t = useTranslations("teacherForm");
  const [isLoading, setIsLoading] = useState(false);

  const softDeleteTeacher = useMutation(api.teachers.softDelete);

  const handleDelete = async () => {
    if (!teacher) return;

    setIsLoading(true);
    try {
      await softDeleteTeacher({ id: teacher._id });
      toast.success(t("deleteSuccess"));
      onOpenChange(false);
    } catch {
      toast.error(t("error"));
    } finally {
      setIsLoading(false);
    }
  };

  const teacherName = teacher
    ? `${teacher.lastName} ${teacher.firstName}`
    : "";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteConfirmation", { name: teacherName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isLoading}
            className="bg-red-500 hover:bg-red-600"
          >
            {isLoading ? t("deleting") : t("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
