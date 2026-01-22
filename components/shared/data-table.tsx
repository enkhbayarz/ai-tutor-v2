"use client";

import { ReactNode } from "react";
import { Trash2, Pencil } from "lucide-react";
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

export interface Column<T> {
  key: string;
  label: string;
  render: (item: T) => ReactNode;
  className?: string;
  hideOnMobile?: boolean;
}

interface DataTableProps<T extends { id: string }> {
  data: T[];
  columns: Column<T>[];
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  pagination: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    labels: {
      page: string;
      of: string;
      previous: string;
      next: string;
    };
  };
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  onEdit,
  onDelete,
  pagination,
}: DataTableProps<T>) {
  const { currentPage, totalPages, onPageChange, labels } = pagination;

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 hover:bg-gray-50">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={`text-gray-500 font-normal ${col.className || ""} ${
                  col.hideOnMobile ? "hidden md:table-cell" : ""
                }`}
              >
                {col.label}
              </TableHead>
            ))}
            {(onEdit || onDelete) && (
              <TableHead className="w-24 hidden md:table-cell"></TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, index) => (
            <TableRow
              key={item.id}
              className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={col.hideOnMobile ? "hidden md:table-cell" : ""}
                >
                  {col.render(item)}
                </TableCell>
              ))}
              {(onEdit || onDelete) && (
                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    {onDelete && (
                      <button
                        onClick={() => onDelete(item)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {onEdit && (
                      <button
                        onClick={() => onEdit(item)}
                        className="p-2 text-gray-400 hover:text-blue-500 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t">
        <p className="text-sm text-gray-500">
          {labels.page} {currentPage} {labels.of} {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full px-4"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            {labels.previous}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full px-4"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            {labels.next}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Helper component for avatar cell (common pattern)
interface AvatarCellProps {
  name: string;
  subtitle: string;
  avatar?: string;
}

export function AvatarCell({ name, subtitle, avatar }: AvatarCellProps) {
  return (
    <div className="flex items-center gap-3 pl-2">
      <Avatar className="w-10 h-10">
        <AvatarImage src={avatar} alt={name} />
        <AvatarFallback className="bg-gray-100 text-gray-600">
          {name.charAt(0)}
        </AvatarFallback>
      </Avatar>
      <div>
        <p className="font-medium text-gray-900">{name}</p>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}
