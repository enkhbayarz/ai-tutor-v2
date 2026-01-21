"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslations } from "next-intl";

export function TeacherTableSkeleton() {
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
          {Array.from({ length: 5 }).map((_, index) => (
            <TableRow
              key={index}
              className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
            >
              <TableCell className="pl-6">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Skeleton className="h-4 w-12" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between px-4 py-3 border-t">
        <Skeleton className="h-4 w-24" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}
