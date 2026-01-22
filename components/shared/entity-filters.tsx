"use client";

import { X, SlidersHorizontal, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const GRADES = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
const GROUPS = ["А", "Б", "В", "Г", "Д"];

interface EntityFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  selectedGrades: string[];
  selectedGroups: string[];
  onGradesChange: (grades: string[]) => void;
  onGroupsChange: (groups: string[]) => void;
  labels: {
    search: string;
    filter: string;
    grade: string;
    group: string;
    clearFilters: string;
  };
}

export function EntityFilters({
  searchValue,
  onSearchChange,
  selectedGrades,
  selectedGroups,
  onGradesChange,
  onGroupsChange,
  labels,
}: EntityFiltersProps) {
  const hasFilters = selectedGrades.length > 0 || selectedGroups.length > 0;

  const clearFilters = () => {
    onGradesChange([]);
    onGroupsChange([]);
  };

  const toggleGrade = (grade: string) => {
    if (selectedGrades.includes(grade)) {
      onGradesChange(selectedGrades.filter((g) => g !== grade));
    } else {
      onGradesChange([...selectedGrades, grade]);
    }
  };

  const toggleGroup = (group: string) => {
    if (selectedGroups.includes(group)) {
      onGroupsChange(selectedGroups.filter((g) => g !== group));
    } else {
      onGroupsChange([...selectedGroups, group]);
    }
  };

  const getFilterLabel = () => {
    const parts = [];
    if (selectedGrades.length > 0) {
      parts.push(`${selectedGrades.join(", ")}-р анги`);
    }
    if (selectedGroups.length > 0) {
      parts.push(`${selectedGroups.join(", ")} бүлэг`);
    }
    return parts.join(" | ");
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
              {labels.filter}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="start">
            <div className="space-y-4">
              {/* Grade Multi-Select */}
              <div className="space-y-2">
                <Label>{labels.grade}</Label>
                <div className="grid grid-cols-4 gap-2">
                  {GRADES.map((grade) => (
                    <div key={grade} className="flex items-center space-x-2">
                      <Checkbox
                        id={`grade-${grade}`}
                        checked={selectedGrades.includes(grade)}
                        onCheckedChange={() => toggleGrade(grade)}
                      />
                      <label
                        htmlFor={`grade-${grade}`}
                        className="text-sm cursor-pointer"
                      >
                        {grade}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Group Multi-Select */}
              <div className="space-y-2">
                <Label>{labels.group}</Label>
                <div className="flex flex-wrap gap-3">
                  {GROUPS.map((group) => (
                    <div key={group} className="flex items-center space-x-2">
                      <Checkbox
                        id={`group-${group}`}
                        checked={selectedGroups.includes(group)}
                        onCheckedChange={() => toggleGroup(group)}
                      />
                      <label
                        htmlFor={`group-${group}`}
                        className="text-sm cursor-pointer"
                      >
                        {group}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={clearFilters}
                >
                  {labels.clearFilters}
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
          placeholder={labels.search}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 rounded-full border-gray-200"
        />
      </div>
    </div>
  );
}
