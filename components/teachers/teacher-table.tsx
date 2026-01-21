"use client";

import { Trash2, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export interface Teacher {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
  username: string;
  className: string;
  password: string;
}

interface TeacherTableProps {
  teachers: Teacher[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (teacher: Teacher) => void;
  onDelete: (teacher: Teacher) => void;
}

export function TeacherTable({
  teachers,
  currentPage,
  totalPages,
  onPageChange,
  onEdit,
  onDelete,
}: TeacherTableProps) {
  const t = useTranslations("teachers");

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 hover:bg-gray-50">
            <TableHead className="text-gray-500 font-normal pl-6">{t("teacher")}</TableHead>
            <TableHead className="text-gray-500 font-normal">
              {t("username")}
            </TableHead>
            <TableHead className="text-gray-500 font-normal hidden md:table-cell">
              {t("class")}
            </TableHead>
            <TableHead className="text-gray-500 font-normal hidden md:table-cell">
              {t("password")}
            </TableHead>
            <TableHead className="w-24 hidden md:table-cell"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teachers.map((teacher, index) => (
            <TableRow
              key={teacher.id}
              className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
            >
              <TableCell className="pl-6">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={teacher.avatar} alt={teacher.name} />
                    <AvatarFallback className="bg-gray-100 text-gray-600">
                      {teacher.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-gray-900">{teacher.name}</p>
                    <p className="text-sm text-gray-500">{teacher.phone}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-gray-600">{teacher.username}</TableCell>
              <TableCell className="text-gray-600 hidden md:table-cell">
                {teacher.className}
              </TableCell>
              <TableCell className="text-gray-600 hidden md:table-cell">
                ********
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onDelete(teacher)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onEdit(teacher)}
                    className="p-2 text-gray-400 hover:text-blue-500 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t">
        <p className="text-sm text-gray-500">
          {t("page")} {currentPage} {t("of")} {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full px-4"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            {t("previous")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full px-4"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            {t("next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
