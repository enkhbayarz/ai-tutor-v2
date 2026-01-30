"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteDialog } from "@/components/shared/delete-dialog";

interface ChatItemProps {
  title: string;
  href: string;
  isActive: boolean;
  onDelete: () => Promise<void>;
  onRename: (newTitle: string) => Promise<void>;
}

export function ChatItem({
  title,
  href,
  isActive,
  onDelete,
  onRename,
}: ChatItemProps) {
  const t = useTranslations("chat");
  const [isHovered, setIsHovered] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  const [isRenaming, setIsRenaming] = useState(false);

  // Show menu button when hovering OR when dropdown is open
  const showMenuButton = isHovered || dropdownOpen;

  const handleRename = async () => {
    if (!newTitle.trim() || newTitle === title) {
      setRenameDialogOpen(false);
      return;
    }
    setIsRenaming(true);
    try {
      await onRename(newTitle.trim());
      setRenameDialogOpen(false);
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "group relative flex items-center rounded-md transition-colors",
          isActive ? "bg-blue-50" : "hover:bg-gray-50"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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

        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "absolute right-1 p-1.5 rounded-md hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors",
                showMenuButton ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
              onClick={(e) => e.preventDefault()}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                setNewTitle(title);
                setRenameDialogOpen(true);
                setDropdownOpen(false);
              }}
            >
              <Pencil className="w-4 h-4 mr-2" />
              {t("rename")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600 cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                setDeleteDialogOpen(true);
                setDropdownOpen(false);
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("renameChat")}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t("newName")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRename();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
              disabled={isRenaming}
            >
              {t("cancel")}
            </Button>
            <Button onClick={handleRename} disabled={isRenaming}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t("deleteChat")}
        description={t("deleteChatConfirm", { name: title })}
        onConfirm={onDelete}
        labels={{
          cancel: t("cancel"),
          delete: t("delete"),
          deleting: t("deleting"),
        }}
      />
    </>
  );
}
