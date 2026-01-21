"use client";

import { X, SlidersHorizontal, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface TeacherFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  selectedGrade: string | null;
  selectedGroup: string | null;
  onGradeChange: (grade: string | null) => void;
  onGroupChange: (group: string | null) => void;
}

const grades = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
const groups = ["А", "Б", "В", "Г", "Д"];

export function TeacherFilters({
  searchValue,
  onSearchChange,
  selectedGrade,
  selectedGroup,
  onGradeChange,
  onGroupChange,
}: TeacherFiltersProps) {
  const t = useTranslations("teachers");

  const hasFilters = selectedGrade || selectedGroup;

  const clearFilters = () => {
    onGradeChange(null);
    onGroupChange(null);
  };

  const getFilterLabel = () => {
    const parts = [];
    if (selectedGrade) parts.push(`${selectedGrade}-р анги`);
    if (selectedGroup) parts.push(`${selectedGroup} бүлэг`);
    return parts.join(", ");
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Filter Pills */}
      <div className="flex items-center gap-2">
        {hasFilters && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full px-4 h-9 flex-1 sm:flex-none"
            onClick={clearFilters}
          >
            {getFilterLabel()}
            <X className="w-4 h-4 ml-2" />
          </Button>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full px-4 h-9 flex-1 sm:flex-none"
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              {t("filter")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("grade")}</Label>
                <Select
                  value={selectedGrade || ""}
                  onValueChange={(value) => onGradeChange(value || null)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("selectGrade")} />
                  </SelectTrigger>
                  <SelectContent>
                    {grades.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {grade}-р анги
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("group")}</Label>
                <Select
                  value={selectedGroup || ""}
                  onValueChange={(value) => onGroupChange(value || null)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("selectGroup")} />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group} value={group}>
                        {group} бүлэг
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={clearFilters}
                >
                  {t("clearFilters")}
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder={t("search")}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 rounded-full border-gray-200"
        />
      </div>
    </div>
  );
}
