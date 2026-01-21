"use client";

import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeacherFilters } from "@/components/teachers/teacher-filters";
import { TeacherTable, Teacher } from "@/components/teachers/teacher-table";
import { TeacherEmptyState } from "@/components/teachers/teacher-empty-state";

// Mock data for testing
const mockTeachers: Teacher[] = [
  {
    id: "1",
    name: "Лхамсүрэн Долгорсүрэн",
    phone: "99XXXXXX",
    username: "Bernard",
    className: "5А",
    password: "********",
  },
  {
    id: "2",
    name: "Батбаяр Хонгорзул",
    phone: "99XXXXXX",
    avatar: "",
    username: "Soham",
    className: "5Б",
    password: "********",
  },
  {
    id: "3",
    name: "Долгор Лхамсүрэн",
    phone: "99XXXXXX",
    username: "Dwight",
    className: "4Б",
    password: "********",
  },
  {
    id: "4",
    name: "Батсайхан Батбаяр",
    phone: "99XXXXXX",
    username: "Leslie",
    className: "3Г",
    password: "********",
  },
  {
    id: "5",
    name: "Батэрдэнэ Анужин",
    phone: "99XXXXXX",
    username: "Mitchell",
    className: "2А",
    password: "********",
  },
];

export default function TeacherInfoPage() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>("Бүх анши");
  const [currentPage, setCurrentPage] = useState(1);

  // Toggle between empty state and data for demo
  const [showData, setShowData] = useState(true);

  const filteredTeachers = mockTeachers.filter(
    (teacher) =>
      teacher.name.toLowerCase().includes(search.toLowerCase()) ||
      teacher.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddNew = () => {
    // TODO: Open add teacher modal
    console.log("Add new teacher");
  };

  const handleEdit = (teacher: Teacher) => {
    // TODO: Open edit teacher modal
    console.log("Edit teacher:", teacher);
  };

  const handleDelete = (teacher: Teacher) => {
    // TODO: Confirm and delete teacher
    console.log("Delete teacher:", teacher);
  };

  const handleExport = () => {
    // TODO: Export to Excel
    console.log("Export to Excel");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Багшийн бүртгэл</h1>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full px-4"
            onClick={handleExport}
          >
            <Download className="w-4 h-4 mr-2" />
            Excel татах
          </Button>
          <Button
            size="sm"
            className="bg-blue-500 hover:bg-blue-600 rounded-full px-4"
            onClick={handleAddNew}
          >
            <Plus className="w-4 h-4 mr-2" />
            Шинэ багш нэмэх
          </Button>
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
      {showData && filteredTeachers.length > 0 ? (
        <TeacherTable
          teachers={filteredTeachers}
          currentPage={currentPage}
          totalPages={10}
          onPageChange={setCurrentPage}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ) : (
        <TeacherEmptyState onAddNew={handleAddNew} />
      )}
    </div>
  );
}
