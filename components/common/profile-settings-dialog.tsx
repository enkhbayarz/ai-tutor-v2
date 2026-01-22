"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Camera, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileSettingsDialog({
  open,
  onOpenChange,
}: ProfileSettingsDialogProps) {
  const { user: clerkUser } = useUser();
  const t = useTranslations("profileSettings");

  const convexUser = useQuery(api.users.getCurrentUser);
  const storeUser = useMutation(api.users.store);
  const updateProfile = useMutation(api.users.updateProfile);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Ensure user exists in Convex
  useEffect(() => {
    if (open && clerkUser) {
      storeUser();
    }
  }, [open, clerkUser, storeUser]);

  // Populate form with Convex user data
  useEffect(() => {
    if (convexUser) {
      setDisplayName(convexUser.displayName || "");
      setUsername(convexUser.username || "");
    }
  }, [convexUser]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await updateProfile({ displayName, username });
      toast.success(t("success"));
      onOpenChange(false);
    } catch {
      toast.error(t("error"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          {/* Avatar with camera overlay */}
          <div className="relative">
            <Avatar className="w-24 h-24">
              <AvatarImage src={clerkUser?.imageUrl} />
              <AvatarFallback className="text-2xl">
                {displayName?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <button className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full shadow-md border cursor-pointer hover:bg-gray-50">
              <Camera className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Form fields */}
          <div className="w-full space-y-4">
            <div className="space-y-2">
              <Label>{t("displayName")}</Label>
              <div className="relative">
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t("displayName")}
                  className="pr-10"
                />
                <Pencil className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("username")}</Label>
              <div className="relative">
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("username")}
                  className="pr-10"
                />
                <Pencil className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Save button */}
          <Button
            onClick={handleSave}
            disabled={isLoading}
            variant="outline"
            className="ml-auto"
          >
            {isLoading ? t("saving") : t("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
