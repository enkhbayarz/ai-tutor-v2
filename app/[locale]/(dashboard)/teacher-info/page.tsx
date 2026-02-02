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
import { teacherFormSchema, VALIDATION_LIMITS } from "@/lib/validations/teacher";
import { exportToExcel } from "@/lib/export-excel";
import { BulkImportDialog, TeacherCredentialsDialog } from "@/components/teacher";

const ITEMS_PER_PAGE = 10;

interface ConvexTeacher {
  _id: Id<"teachers">;
  lastName: string;
  firstName: string;
  grade: number;
  group: string;
  phone1: string;
  phone2?: string;
}

interface TableTeacher {
  id: string;
  name: string;
  phone: string;
  username: string;
  className: string;
  password: string;
}

export default function TeacherInfoPage() {
  const t = useTranslations("teachers");
  const tForm = useTranslations("teacherForm");
  const tBulkImport = useTranslations("bulkImport");
  const [search, setSearch] = useState("");
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // Add dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [teacherToEdit, setTeacherToEdit] = useState<ConvexTeacher | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<ConvexTeacher | null>(null);

  // Bulk import dialog state
  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false);

  // Credentials dialog state (shown after successful teacher creation)
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<{
    firstName: string;
    lastName: string;
    username: string;
    password: string;
  } | null>(null);

  // Convex queries/mutations
  const convexTeachers = useQuery(api.teachers.list);
  const createTeacher = useMutation(api.teachers.create);
  const updateTeacher = useMutation(api.teachers.update);
  const softDeleteTeacher = useMutation(api.teachers.softDelete);

  // Filter teachers
  const filteredConvexTeachers = (convexTeachers || []).filter((teacher) => {
    const fullName = `${teacher.lastName} ${teacher.firstName}`.toLowerCase();
    const matchesSearch =
      fullName.includes(search.toLowerCase()) ||
      teacher.firstName.toLowerCase().includes(search.toLowerCase());
    const matchesGrade =
      selectedGrades.length === 0 ||
      selectedGrades.includes(teacher.grade.toString());
    const matchesGroup =
      selectedGroups.length === 0 || selectedGroups.includes(teacher.group);
    return matchesSearch && matchesGrade && matchesGroup;
  });

  // Transform to table format
  const filteredTeachers: TableTeacher[] = filteredConvexTeachers.map((teacher) => ({
    id: teacher._id,
    name: `${teacher.lastName} ${teacher.firstName}`,
    phone: teacher.phone1,
    username: teacher.firstName.toLowerCase(),
    className: `${teacher.grade}${teacher.group}`,
    password: "********",
  }));

  // Pagination
  const totalPages = Math.ceil(filteredTeachers.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTeachers = filteredTeachers.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedGrades, selectedGroups]);

  // Table columns
  const columns: Column<TableTeacher>[] = [
    {
      key: "name",
      label: t("teacher"),
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

  const handleEdit = (teacher: TableTeacher) => {
    const convexTeacher = convexTeachers?.find((t) => t._id === teacher.id);
    if (convexTeacher) {
      setTeacherToEdit(convexTeacher);
      setEditDialogOpen(true);
    }
  };

  const handleDelete = (teacher: TableTeacher) => {
    const convexTeacher = convexTeachers?.find((t) => t._id === teacher.id);
    if (convexTeacher) {
      setTeacherToDelete(convexTeacher);
      setDeleteDialogOpen(true);
    }
  };

  const handleAddSubmit = async (data: PersonFormData) => {
    const response = await fetch("/api/teachers/create-with-clerk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lastName: data.lastName.trim(),
        firstName: data.firstName.trim(),
        grade: parseInt(data.grade),
        group: data.group,
        phone1: data.phone1.trim(),
        phone2: data.phone2?.trim() || undefined,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Failed to create teacher");
    }

    // Show credentials dialog with the generated username/password
    setGeneratedCredentials({
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      username: result.username,
      password: result.tempPassword,
    });
    setCredentialsDialogOpen(true);
  };

  const handleEditSubmit = async (data: PersonFormData) => {
    if (!teacherToEdit) return;
    await updateTeacher({
      id: teacherToEdit._id,
      lastName: data.lastName.trim(),
      firstName: data.firstName.trim(),
      grade: parseInt(data.grade),
      group: data.group,
      phone1: data.phone1.trim(),
      phone2: data.phone2?.trim() || undefined,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!teacherToDelete) return;
    await softDeleteTeacher({ id: teacherToDelete._id });
    toast.success(tForm("deleteSuccess"));
  };

  const handleExport = () => {
    const exportData = filteredConvexTeachers.map((teacher) => ({
      Овог: teacher.lastName,
      Нэр: teacher.firstName,
      Анги: teacher.grade,
      Бүлэг: teacher.group,
      "Утас 1": teacher.phone1,
      "Утас 2": teacher.phone2 || "",
    }));
    exportToExcel(exportData, "Багшийн_жагсаалт", "Багш нар");
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
  if (convexTeachers === undefined) {
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
              {t("addTeacher")}
            </Button>
          </div>
        </div>
        <div className="border-t border-gray-200" />
        <TableSkeleton
          columns={[
            { label: t("teacher"), className: "pl-6" },
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
            {t("addTeacher")}
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
      {filteredTeachers.length > 0 ? (
        <DataTable
          data={paginatedTeachers}
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
          message={t("noTeachers")}
          action={
            <Button
              className="bg-blue-500 hover:bg-blue-600 rounded-full px-6"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("addFirstTeacher")}
            </Button>
          }
        />
      )}

      {/* Add Teacher Dialog */}
      <PersonFormDialog
        mode="add"
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleAddSubmit}
        validationSchema={teacherFormSchema}
        validationLimits={VALIDATION_LIMITS}
        labels={formLabels}
        translateValidation={(key, params) => tForm(key, params as Record<string, string | number | Date> | undefined)}
      />

      {/* Edit Teacher Dialog */}
      <PersonFormDialog
        mode="edit"
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        initialData={
          teacherToEdit
            ? {
                lastName: teacherToEdit.lastName,
                firstName: teacherToEdit.firstName,
                grade: teacherToEdit.grade.toString(),
                group: teacherToEdit.group,
                phone1: teacherToEdit.phone1,
                phone2: teacherToEdit.phone2 || "",
              }
            : undefined
        }
        onSubmit={handleEditSubmit}
        validationSchema={teacherFormSchema}
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
          name: teacherToDelete
            ? `${teacherToDelete.lastName} ${teacherToDelete.firstName}`
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

      {/* Teacher Credentials Dialog (shown after successful creation) */}
      <TeacherCredentialsDialog
        open={credentialsDialogOpen}
        onOpenChange={setCredentialsDialogOpen}
        credentials={generatedCredentials}
      />
    </div>
  );
}
