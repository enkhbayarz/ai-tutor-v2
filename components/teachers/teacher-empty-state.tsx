"use client";

import { Package, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AddTeacherDialog } from "./add-teacher-dialog";

export function TeacherEmptyState() {
  const t = useTranslations("teachers");

  return (
    <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border">
      <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6">
        <Package className="w-12 h-12 text-blue-200" />
      </div>
      <p className="text-gray-500 mb-6">{t("noTeachers")}</p>
      <AddTeacherDialog
        trigger={
          <Button className="bg-blue-500 hover:bg-blue-600 rounded-full px-6">
            <Plus className="w-4 h-4 mr-2" />
            {t("addFirstTeacher")}
          </Button>
        }
      />
    </div>
  );
}
