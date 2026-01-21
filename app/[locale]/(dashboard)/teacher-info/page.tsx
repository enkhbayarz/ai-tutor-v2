"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { TeacherFilters } from "@/components/teachers/teacher-filters";
import { TeacherTable, Teacher } from "@/components/teachers/teacher-table";
import { TeacherEmptyState } from "@/components/teachers/teacher-empty-state";
import { AddTeacherDialog } from "@/components/teachers/add-teacher-dialog";
import { EditTeacherDialog } from "@/components/teachers/edit-teacher-dialog";
import { DeleteConfirmDialog } from "@/components/teachers/delete-confirm-dialog";

// Extended teacher type that includes Convex data
interface ConvexTeacher {
  _id: Id<"teachers">;
  lastName: string;
  firstName: string;
  grade: number;
  group: string;
  phone1: string;
  phone2?: string;
}

export default function TeacherInfoPage() {
  const t = useTranslations("teachers");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(
    t("allTeachers")
  );
  const [currentPage, setCurrentPage] = useState(1);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [teacherToEdit, setTeacherToEdit] = useState<ConvexTeacher | null>(
    null
  );

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<ConvexTeacher | null>(
    null
  );

  // Fetch teachers from Convex
  const convexTeachers = useQuery(api.teachers.list);

  // Transform Convex data to match Teacher interface for table display
  const teachers: Teacher[] = (convexTeachers || []).map((teacher) => ({
    id: teacher._id,
    name: `${teacher.lastName} ${teacher.firstName}`,
    phone: teacher.phone1,
    username: teacher.firstName.toLowerCase(),
    className: `${teacher.grade}${teacher.group}`,
    password: "********",
  }));

  const filteredTeachers = teachers.filter(
    (teacher) =>
      teacher.name.toLowerCase().includes(search.toLowerCase()) ||
      teacher.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (teacher: Teacher) => {
    // Find the full Convex teacher data
    const convexTeacher = convexTeachers?.find((t) => t._id === teacher.id);
    if (convexTeacher) {
      setTeacherToEdit(convexTeacher);
      setEditDialogOpen(true);
    }
  };

  const handleDelete = (teacher: Teacher) => {
    // Find the full Convex teacher data
    const convexTeacher = convexTeachers?.find((t) => t._id === teacher.id);
    if (convexTeacher) {
      setTeacherToDelete(convexTeacher);
      setDeleteDialogOpen(true);
    }
  };

  const handleExport = () => {
    // TODO: Export to Excel
    console.log("Export to Excel");
  };

  // Loading state
  if (convexTeachers === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full px-4"
            onClick={handleExport}
          >
            <Download className="w-4 h-4 mr-2" />
            {t("exportExcel")}
          </Button>
          <AddTeacherDialog />
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-gray-200" />

      {/* Filters */}
      <TeacherFilters
        searchValue={search}
        onSearchChange={setSearch}
        activeFilter={activeFilter}
        onClearFilter={() => setActiveFilter(null)}
      />

      {/* Content */}
      {filteredTeachers.length > 0 ? (
        <TeacherTable
          teachers={filteredTeachers}
          currentPage={currentPage}
          totalPages={Math.ceil(filteredTeachers.length / 10) || 1}
          onPageChange={setCurrentPage}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ) : (
        <TeacherEmptyState />
      )}

      {/* Edit Teacher Dialog */}
      <EditTeacherDialog
        teacher={teacherToEdit}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        teacher={teacherToDelete}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </div>
  );
}
