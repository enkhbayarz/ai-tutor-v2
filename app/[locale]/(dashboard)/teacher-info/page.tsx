"use client";

import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { TeacherFilters } from "@/components/teachers/teacher-filters";
import { TeacherTable, Teacher } from "@/components/teachers/teacher-table";
import { TeacherTableSkeleton } from "@/components/teachers/teacher-table-skeleton";
import { TeacherEmptyState } from "@/components/teachers/teacher-empty-state";
import { AddTeacherDialog } from "@/components/teachers/add-teacher-dialog";
import { EditTeacherDialog } from "@/components/teachers/edit-teacher-dialog";
import { DeleteConfirmDialog } from "@/components/teachers/delete-confirm-dialog";

const ITEMS_PER_PAGE = 10;

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
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
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

  // Filter on original Convex data (using arrays for multi-select - like SQL IN operator)
  const filteredConvexTeachers = (convexTeachers || []).filter((teacher) => {
    // Search filter
    const fullName = `${teacher.lastName} ${teacher.firstName}`.toLowerCase();
    const matchesSearch =
      fullName.includes(search.toLowerCase()) ||
      teacher.firstName.toLowerCase().includes(search.toLowerCase());

    // Grade filter - check if grade is in selected grades array (like SQL IN)
    const matchesGrade =
      selectedGrades.length === 0 ||
      selectedGrades.includes(teacher.grade.toString());

    // Group filter - check if group is in selected groups array (like SQL IN)
    const matchesGroup =
      selectedGroups.length === 0 || selectedGroups.includes(teacher.group);

    return matchesSearch && matchesGrade && matchesGroup;
  });

  // Transform filtered Convex data to Teacher interface for table display
  const filteredTeachers: Teacher[] = filteredConvexTeachers.map((teacher) => ({
    id: teacher._id,
    name: `${teacher.lastName} ${teacher.firstName}`,
    phone: teacher.phone1,
    username: teacher.firstName.toLowerCase(),
    className: `${teacher.grade}${teacher.group}`,
    password: "********",
  }));

  // Paginate filtered teachers
  const totalPages = Math.ceil(filteredTeachers.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTeachers = filteredTeachers.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedGrades, selectedGroups]);

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
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full px-4"
              disabled
            >
              <Download className="w-4 h-4 mr-2" />
              {t("exportExcel")}
            </Button>
            <Button
              size="sm"
              className="bg-blue-500 hover:bg-blue-600 rounded-full px-4"
              disabled
            >
              {t("addTeacher")}
            </Button>
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-gray-200" />

        {/* Skeleton Table */}
        <TeacherTableSkeleton />
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
        selectedGrades={selectedGrades}
        selectedGroups={selectedGroups}
        onGradesChange={setSelectedGrades}
        onGroupsChange={setSelectedGroups}
      />

      {/* Content */}
      {filteredTeachers.length > 0 ? (
        <TeacherTable
          teachers={paginatedTeachers}
          currentPage={currentPage}
          totalPages={totalPages}
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
