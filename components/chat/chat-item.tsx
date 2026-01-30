"use client";

import Link from "next/link";
import { useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatItemProps {
  id: Id<"conversations">;
  title: string;
  href: string;
  isActive: boolean;
  onDelete: () => void;
}

export function ChatItem({
  id,
  title,
  href,
  isActive,
  onDelete,
}: ChatItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={cn(
        "group relative flex items-center rounded-md transition-colors",
        isActive ? "bg-blue-50" : "hover:bg-gray-50"
      )}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      <Link
        href={href}
        className={cn(
          "flex-1 px-3 py-1.5 text-sm truncate",
          isActive ? "text-blue-700 font-medium" : "text-gray-700"
        )}
      >
        {title || "New Chat"}
      </Link>

      {showMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="absolute right-1 p-1.5 rounded-md hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
              onClick={(e) => e.preventDefault()}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem
              className="text-red-600 cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                onDelete();
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
