"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface FilterOption {
  value: string;
  label: string;
}

interface TextbookFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  selectedGrades: string[];
  selectedSubjects: string[];
  selectedTypes: string[];
  selectedStatuses: string[];
  onGradesChange: (values: string[]) => void;
  onSubjectsChange: (values: string[]) => void;
  onTypesChange: (values: string[]) => void;
  onStatusesChange: (values: string[]) => void;
  gradeOptions: FilterOption[];
  subjectOptions: FilterOption[];
  typeOptions: FilterOption[];
  statusOptions: FilterOption[];
  labels: {
    search: string;
    grade: string;
    subject: string;
    type: string;
    status: string;
    clearFilters: string;
  };
}

function FilterPopover({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "rounded-full gap-1 h-9",
            selected.length > 0 && "bg-blue-50 border-blue-200 text-blue-700"
          )}
        >
          {label}
          {selected.length > 0 && (
            <span className="ml-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {selected.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {options.map((option) => (
            <div
              key={option.value}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
              onClick={() => toggleOption(option.value)}
            >
              <Checkbox
                checked={selected.includes(option.value)}
                onCheckedChange={() => toggleOption(option.value)}
              />
              <span className="text-sm">{option.label}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TextbookFilters({
  searchValue,
  onSearchChange,
  selectedGrades,
  selectedSubjects,
  selectedTypes,
  selectedStatuses,
  onGradesChange,
  onSubjectsChange,
  onTypesChange,
  onStatusesChange,
  gradeOptions,
  subjectOptions,
  typeOptions,
  statusOptions,
  labels,
}: TextbookFiltersProps) {
  const hasActiveFilters =
    selectedGrades.length > 0 ||
    selectedSubjects.length > 0 ||
    selectedTypes.length > 0 ||
    selectedStatuses.length > 0;

  const clearAllFilters = () => {
    onGradesChange([]);
    onSubjectsChange([]);
    onTypesChange([]);
    onStatusesChange([]);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Filter buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPopover
          label={labels.grade}
          options={gradeOptions}
          selected={selectedGrades}
          onChange={onGradesChange}
        />
        <FilterPopover
          label={labels.subject}
          options={subjectOptions}
          selected={selectedSubjects}
          onChange={onSubjectsChange}
        />
        <FilterPopover
          label={labels.type}
          options={typeOptions}
          selected={selectedTypes}
          onChange={onTypesChange}
        />
        <FilterPopover
          label={labels.status}
          options={statusOptions}
          selected={selectedStatuses}
          onChange={onStatusesChange}
        />

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-gray-500 hover:text-gray-700 h-9"
          >
            <X className="w-4 h-4 mr-1" />
            {labels.clearFilters}
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder={labels.search}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 rounded-full"
        />
      </div>
    </div>
  );
}
