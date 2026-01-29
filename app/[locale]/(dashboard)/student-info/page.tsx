"use client";

import { useState, useEffect } from "react";
import { Download, Plus, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  DataTable,
  AvatarCell,
  Column,
  EntityFilters,
  EmptyState,
  TableSkeleton,
  PersonFormDialog,
  PersonFormData,
  DeleteDialog,
} from "@/components/shared";
import { studentFormSchema, VALIDATION_LIMITS } from "@/lib/validations/student";
import { exportToExcel } from "@/lib/export-excel";
import { BulkImportDialog } from "@/components/student";

const ITEMS_PER_PAGE = 10;

interface ConvexStudent {
  _id: Id<"students">;
  lastName: string;
  firstName: string;
  grade: number;
  group: string;
  phone1: string;
  phone2?: string;
}

interface TableStudent {
  id: string;
  name: string;
  phone: string;
  username: string;
  className: string;
  password: string;
}

export default function StudentInfoPage() {
  const t = useTranslations("students");
  const tForm = useTranslations("studentForm");
  const tBulkImport = useTranslations("bulkImport");
  const [search, setSearch] = useState("");
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // Add dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Bulk import dialog state
  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<ConvexStudent | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<ConvexStudent | null>(null);

  // Convex queries/mutations
  const convexStudents = useQuery(api.students.list);
  const createStudent = useMutation(api.students.create);
  const updateStudent = useMutation(api.students.update);
  const softDeleteStudent = useMutation(api.students.softDelete);

  // Filter students
  const filteredConvexStudents = (convexStudents || []).filter((student) => {
    const fullName = `${student.lastName} ${student.firstName}`.toLowerCase();
    const matchesSearch =
      fullName.includes(search.toLowerCase()) ||
      student.firstName.toLowerCase().includes(search.toLowerCase());
    const matchesGrade =
      selectedGrades.length === 0 ||
      selectedGrades.includes(student.grade.toString());
    const matchesGroup =
      selectedGroups.length === 0 || selectedGroups.includes(student.group);
    return matchesSearch && matchesGrade && matchesGroup;
  });

  // Transform to table format
  const filteredStudents: TableStudent[] = filteredConvexStudents.map((student) => ({
    id: student._id,
    name: `${student.lastName} ${student.firstName}`,
    phone: student.phone1,
    username: student.firstName.toLowerCase(),
    className: `${student.grade}${student.group}`,
    password: "********",
  }));

  // Pagination
  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedStudents = filteredStudents.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedGrades, selectedGroups]);

  // Table columns
  const columns: Column<TableStudent>[] = [
    {
      key: "name",
      label: t("student"),
      render: (item) => (
        <AvatarCell name={item.name} subtitle={item.phone} />
      ),
      className: "pl-6",
    },
    {
      key: "username",
      label: t("username"),
      render: (item) => <span className="text-gray-600">{item.username}</span>,
    },
    {
      key: "class",
      label: t("class"),
      render: (item) => <span className="text-gray-600">{item.className}</span>,
      hideOnMobile: true,
    },
    {
      key: "password",
      label: t("password"),
      render: () => <span className="text-gray-600">********</span>,
      hideOnMobile: true,
    },
  ];

  const handleEdit = (student: TableStudent) => {
    const convexStudent = convexStudents?.find((s) => s._id === student.id);
    if (convexStudent) {
      setStudentToEdit(convexStudent);
      setEditDialogOpen(true);
    }
  };

  const handleDelete = (student: TableStudent) => {
    const convexStudent = convexStudents?.find((s) => s._id === student.id);
    if (convexStudent) {
      setStudentToDelete(convexStudent);
      setDeleteDialogOpen(true);
    }
  };

  const handleAddSubmit = async (data: PersonFormData) => {
    await createStudent({
      lastName: data.lastName.trim(),
      firstName: data.firstName.trim(),
      grade: parseInt(data.grade),
      group: data.group,
      phone1: data.phone1.trim(),
      phone2: data.phone2?.trim() || undefined,
    });
  };

  const handleEditSubmit = async (data: PersonFormData) => {
    if (!studentToEdit) return;
    await updateStudent({
      id: studentToEdit._id,
      lastName: data.lastName.trim(),
      firstName: data.firstName.trim(),
      grade: parseInt(data.grade),
      group: data.group,
      phone1: data.phone1.trim(),
      phone2: data.phone2?.trim() || undefined,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!studentToDelete) return;
    await softDeleteStudent({ id: studentToDelete._id });
    toast.success(tForm("deleteSuccess"));
  };

  const handleExport = () => {
    const exportData = filteredConvexStudents.map((student) => ({
      Овог: student.lastName,
      Нэр: student.firstName,
      Анги: student.grade,
      Бүлэг: student.group,
      "Утас 1": student.phone1,
      "Утас 2": student.phone2 || "",
    }));
    exportToExcel(exportData, "Сурагчийн_жагсаалт", "Сурагч нар");
  };

  // Form labels
  const formLabels = {
    title: tForm("title"),
    lastName: tForm("lastName"),
    lastNamePlaceholder: tForm("lastNamePlaceholder"),
    firstName: tForm("firstName"),
    firstNamePlaceholder: tForm("firstNamePlaceholder"),
    grade: tForm("grade"),
    selectGrade: tForm("selectGrade"),
    group: tForm("group"),
    selectGroup: tForm("selectGroup"),
    phone1: tForm("phone1"),
    phone2: tForm("phone2"),
    phonePlaceholder: tForm("phonePlaceholder"),
    save: tForm("save"),
    saving: tForm("saving"),
    success: tForm("success"),
    error: tForm("error"),
    fixErrors: tForm("validation.fixErrors"),
  };

  const editFormLabels = {
    ...formLabels,
    title: tForm("editTitle"),
    save: tForm("update"),
    success: tForm("updateSuccess"),
  };

  // Loading state
  if (convexStudents === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="outline" size="sm" className="rounded-full px-4" disabled>
              <Download className="w-4 h-4 mr-2" />
              {t("exportExcel")}
            </Button>
            <Button size="sm" className="bg-blue-500 rounded-full px-4" disabled>
              <Plus className="w-4 h-4 mr-2" />
              {t("addStudent")}
            </Button>
          </div>
        </div>
        <div className="border-t border-gray-200" />
        <TableSkeleton
          columns={[
            { label: t("student"), className: "pl-6" },
            { label: t("username") },
            { label: t("class") },
            { label: t("password") },
          ]}
        />
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
          <Button
            variant="outline"
            size="sm"
            className="rounded-full px-4"
            onClick={() => setBulkImportDialogOpen(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            {t("bulkImport")}
          </Button>
          <Button
            size="sm"
            className="bg-blue-500 hover:bg-blue-600 rounded-full px-4"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("addStudent")}
          </Button>
        </div>
      </div>

      <div className="border-t border-gray-200" />

      {/* Filters */}
      <EntityFilters
        searchValue={search}
        onSearchChange={setSearch}
        selectedGrades={selectedGrades}
        selectedGroups={selectedGroups}
        onGradesChange={setSelectedGrades}
        onGroupsChange={setSelectedGroups}
        labels={{
          search: t("search"),
          filter: t("filter"),
          grade: t("grade"),
          group: t("group"),
          clearFilters: t("clearFilters"),
        }}
      />

      {/* Content */}
      {filteredStudents.length > 0 ? (
        <DataTable
          data={paginatedStudents}
          columns={columns}
          onEdit={handleEdit}
          onDelete={handleDelete}
          pagination={{
            currentPage,
            totalPages,
            onPageChange: setCurrentPage,
            labels: {
              page: t("page"),
              of: t("of"),
              previous: t("previous"),
              next: t("next"),
            },
          }}
        />
      ) : (
        <EmptyState
          message={t("noStudents")}
          action={
            <Button
              className="bg-blue-500 hover:bg-blue-600 rounded-full px-6"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("addFirstStudent")}
            </Button>
          }
        />
      )}

      {/* Add Student Dialog */}
      <PersonFormDialog
        mode="add"
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleAddSubmit}
        validationSchema={studentFormSchema}
        validationLimits={VALIDATION_LIMITS}
        labels={formLabels}
        translateValidation={(key, params) => tForm(key, params as Record<string, string | number | Date> | undefined)}
      />

      {/* Edit Student Dialog */}
      <PersonFormDialog
        mode="edit"
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        initialData={
          studentToEdit
            ? {
                lastName: studentToEdit.lastName,
                firstName: studentToEdit.firstName,
                grade: studentToEdit.grade.toString(),
                group: studentToEdit.group,
                phone1: studentToEdit.phone1,
                phone2: studentToEdit.phone2 || "",
              }
            : undefined
        }
        onSubmit={handleEditSubmit}
        validationSchema={studentFormSchema}
        validationLimits={VALIDATION_LIMITS}
        labels={editFormLabels}
        translateValidation={(key, params) => tForm(key, params as Record<string, string | number | Date> | undefined)}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={tForm("deleteTitle")}
        description={tForm("deleteConfirmation", {
          name: studentToDelete
            ? `${studentToDelete.lastName} ${studentToDelete.firstName}`
            : "",
        })}
        onConfirm={handleDeleteConfirm}
        labels={{
          cancel: tForm("cancel"),
          delete: tForm("delete"),
          deleting: tForm("deleting"),
        }}
      />

      {/* Bulk Import Dialog */}
      <BulkImportDialog
        open={bulkImportDialogOpen}
        onOpenChange={setBulkImportDialogOpen}
        labels={{
          title: tBulkImport("title"),
          uploadStep: tBulkImport("uploadStep"),
          previewStep: tBulkImport("previewStep"),
          processStep: tBulkImport("processStep"),
          resultsStep: tBulkImport("resultsStep"),
          dragDrop: tBulkImport("dragDrop"),
          orClick: tBulkImport("orClick"),
          supportedFormats: tBulkImport("supportedFormats"),
          downloadTemplate: tBulkImport("downloadTemplate"),
          rowCount: (count: number) => tBulkImport("rowCount", { count }),
          validRows: (count: number) => tBulkImport("validRows", { count }),
          invalidRows: (count: number) => tBulkImport("invalidRows", { count }),
          fixErrors: tBulkImport("fixErrors"),
          process: tBulkImport("process"),
          processing: tBulkImport("processing"),
          back: tBulkImport("back"),
          close: tBulkImport("close"),
          rowNumber: tBulkImport("rowNumber"),
          lastName: tBulkImport("lastName"),
          firstName: tBulkImport("firstName"),
          grade: tBulkImport("grade"),
          group: tBulkImport("group"),
          phone1: tBulkImport("phone1"),
          phone2: tBulkImport("phone2"),
          status: tBulkImport("status"),
          valid: tBulkImport("valid"),
          invalid: tBulkImport("invalid"),
          summary: tBulkImport("summary"),
          total: tBulkImport("total"),
          success: tBulkImport("success"),
          failed: tBulkImport("failed"),
          name: tBulkImport("name"),
          username: tBulkImport("username"),
          tempPassword: tBulkImport("tempPassword"),
          error: tBulkImport("error"),
          downloadResults: tBulkImport("downloadResults"),
          successStatus: tBulkImport("successStatus"),
          failedStatus: tBulkImport("failedStatus"),
        }}
      />
    </div>
  );
}
