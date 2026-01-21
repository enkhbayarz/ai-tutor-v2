import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TeacherEmptyStateProps {
  onAddNew: () => void;
}

export function TeacherEmptyState({ onAddNew }: TeacherEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border">
      <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6">
        <Package className="w-12 h-12 text-blue-200" />
      </div>
      <p className="text-gray-500 mb-6">
        Одоогоор бүртгэлтэй багш байхгүй байна
      </p>
      <Button
        onClick={onAddNew}
        className="bg-blue-500 hover:bg-blue-600 rounded-full px-6"
      >
        + Шинэ багш нэмэх
      </Button>
    </div>
  );
}
