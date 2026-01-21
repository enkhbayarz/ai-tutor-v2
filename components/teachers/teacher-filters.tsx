"use client";

import { X, SlidersHorizontal, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TeacherFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  activeFilter: string | null;
  onClearFilter: () => void;
}

export function TeacherFilters({
  searchValue,
  onSearchChange,
  activeFilter,
  onClearFilter,
}: TeacherFiltersProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Filter Pills */}
      <div className="flex items-center gap-2">
        {activeFilter && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full px-4 h-9 flex-1 sm:flex-none"
            onClick={onClearFilter}
          >
            {activeFilter}
            <X className="w-4 h-4 ml-2" />
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="rounded-full px-4 h-9 flex-1 sm:flex-none"
        >
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          Шүүлтүүр
        </Button>
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 rounded-full border-gray-200"
        />
      </div>
    </div>
  );
}
