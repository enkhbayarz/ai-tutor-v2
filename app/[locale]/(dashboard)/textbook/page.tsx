"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, FileText, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  EmptyState,
  TableSkeleton,
  DeleteDialog,
} from "@/components/shared";
import { TextbookFilters } from "@/components/textbook";
import {
  SUBJECT_OPTIONS,
  TYPE_OPTIONS,
  STATUS_OPTIONS,
  GRADE_OPTIONS,
} from "@/lib/validations/textbook";
import { cn } from "@/lib/utils";

const ITEMS_PER_PAGE = 10;

export default function TextbookPage() {
  const t = useTranslations("textbooks");
  const tForm = useTranslations("textbookForm");
  const locale = useLocale();

  const [search, setSearch] = useState("");
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [textbookToDelete, setTextbookToDelete] = useState<{
    id: Id<"textbooks">;
    name: string;
  } | null>(null);

  // Convex
  const textbooks = useQuery(api.textbooks.list);
  const softDeleteTextbook = useMutation(api.textbooks.softDelete);

  // Filter textbooks
  const filteredTextbooks = (textbooks || []).filter((textbook) => {
    const matchesSearch = textbook.subjectName
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesGrade =
      selectedGrades.length === 0 ||
      selectedGrades.includes(textbook.grade.toString());
    const matchesSubject =
      selectedSubjects.length === 0 ||
      selectedSubjects.includes(textbook.subjectName);
    const matchesType =
      selectedTypes.length === 0 || selectedTypes.includes(textbook.type);
    const matchesStatus =
      selectedStatuses.length === 0 ||
      selectedStatuses.includes(textbook.isValid.toString());
    return (
      matchesSearch &&
      matchesGrade &&
      matchesSubject &&
      matchesType &&
      matchesStatus
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredTextbooks.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTextbooks = filteredTextbooks.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedGrades, selectedSubjects, selectedTypes, selectedStatuses]);

  // Translate options
  const gradeOptions = GRADE_OPTIONS;
  const subjectOptions = SUBJECT_OPTIONS.map((opt) => ({
    value: opt.value,
    label: t(opt.label),
  }));
  const typeOptions = TYPE_OPTIONS.map((opt) => ({
    value: opt.value,
    label: t(opt.label),
  }));
  const statusOptions = STATUS_OPTIONS.map((opt) => ({
    value: opt.value,
    label: t(opt.label),
  }));

  const handleDelete = (id: Id<"textbooks">, name: string) => {
    setTextbookToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!textbookToDelete) return;
    await softDeleteTextbook({ id: textbookToDelete.id });
    toast.success(tForm("deleteSuccess"));
  };

  // Loading state
  if (textbooks === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <Button size="sm" className="bg-blue-500 rounded-full px-4" disabled>
            <Plus className="w-4 h-4 mr-2" />
            {t("addTextbook")}
          </Button>
        </div>
        <div className="border-t border-gray-200" />
        <TableSkeleton
          columns={[
            { label: t("subjectName") },
            { label: t("grade") },
            { label: t("year") },
            { label: t("type") },
            { label: t("status") },
            { label: t("file") },
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
        <Link href={`/${locale}/textbook/new`}>
          <Button
            size="sm"
            className="bg-blue-500 hover:bg-blue-600 rounded-full px-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("addTextbook")}
          </Button>
        </Link>
      </div>

      <div className="border-t border-gray-200" />

      {/* Filters */}
      <TextbookFilters
        searchValue={search}
        onSearchChange={setSearch}
        selectedGrades={selectedGrades}
        selectedSubjects={selectedSubjects}
        selectedTypes={selectedTypes}
        selectedStatuses={selectedStatuses}
        onGradesChange={setSelectedGrades}
        onSubjectsChange={setSelectedSubjects}
        onTypesChange={setSelectedTypes}
        onStatusesChange={setSelectedStatuses}
        gradeOptions={gradeOptions}
        subjectOptions={subjectOptions}
        typeOptions={typeOptions}
        statusOptions={statusOptions}
        labels={{
          search: t("search"),
          grade: t("grade"),
          subject: t("subjectName"),
          type: t("type"),
          status: t("status"),
          clearFilters: t("clearFilters"),
        }}
      />

      {/* Content */}
      {filteredTextbooks.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-sm font-medium text-gray-500 px-6 py-3">
                    {t("subjectName")}
                  </th>
                  <th className="text-left text-sm font-medium text-gray-500 px-4 py-3">
                    {t("grade")}
                  </th>
                  <th className="text-left text-sm font-medium text-gray-500 px-4 py-3 hidden md:table-cell">
                    {t("year")}
                  </th>
                  <th className="text-left text-sm font-medium text-gray-500 px-4 py-3 hidden md:table-cell">
                    {t("type")}
                  </th>
                  <th className="text-left text-sm font-medium text-gray-500 px-4 py-3">
                    {t("status")}
                  </th>
                  <th className="text-left text-sm font-medium text-gray-500 px-4 py-3 hidden lg:table-cell">
                    {t("file")}
                  </th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {paginatedTextbooks.map((textbook) => (
                  <tr
                    key={textbook._id}
                    className="border-b border-gray-50 hover:bg-gray-50"
                  >
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">
                        {t(`subjects.${textbook.subjectName}`) || textbook.subjectName}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      {textbook.grade}-р анги
                    </td>
                    <td className="px-4 py-4 text-gray-600 hidden md:table-cell">
                      {textbook.year}
                    </td>
                    <td className="px-4 py-4 text-gray-600 hidden md:table-cell">
                      {t(`types.${textbook.type}`) || textbook.type}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                          textbook.isValid
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        )}
                      >
                        {textbook.isValid ? t("valid") : t("invalid")}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <a
                        href={textbook.pdfUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-gray-600 hover:text-blue-600"
                      >
                        <FileText className="w-5 h-5 text-red-500" />
                        <span className="text-sm truncate max-w-[150px]">
                          {t(`subjects.${textbook.subjectName}`)} {textbook.grade}
                        </span>
                      </a>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            handleDelete(
                              textbook._id,
                              `${t(`subjects.${textbook.subjectName}`)} ${textbook.grade}`
                            )
                          }
                        >
                          <Trash2 className="w-4 h-4 text-gray-400" />
                        </Button>
                        <Link href={`/${locale}/textbook/${textbook._id}/edit`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Pencil className="w-4 h-4 text-gray-400" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              {t("page")} {currentPage} {t("of")} {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                {t("previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                {t("next")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          message={t("noTextbooks")}
          action={
            <Link href={`/${locale}/textbook/new`}>
              <Button className="bg-blue-500 hover:bg-blue-600 rounded-full px-6">
                <Plus className="w-4 h-4 mr-2" />
                {t("addFirstTextbook")}
              </Button>
            </Link>
          }
        />
      )}

      {/* Delete Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={tForm("deleteTitle")}
        description={tForm("deleteConfirmation", {
          name: textbookToDelete?.name || "",
        })}
        onConfirm={handleDeleteConfirm}
        labels={{
          cancel: tForm("cancel"),
          delete: tForm("delete"),
          deleting: tForm("deleting"),
        }}
      />
    </div>
  );
}
