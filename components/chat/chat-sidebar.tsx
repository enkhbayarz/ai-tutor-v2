"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  PenSquare,
  PanelLeft,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProfileSettingsDialog } from "@/components/common/profile-settings-dialog";
import { HelpDialog } from "@/components/common/help-dialog";
import { HistorySection } from "./history-section";
import { ChatItem } from "./chat-item";

// Helper to group conversations by date
function groupConversationsByDate(
  conversations: Array<{
    _id: Id<"conversations">;
    title: string;
    updatedAt: number;
  }>,
) {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const sevenDays = 7 * oneDay;
  const thirtyDays = 30 * oneDay;

  const today: typeof conversations = [];
  const last7Days: typeof conversations = [];
  const last30Days: typeof conversations = [];
  const older: typeof conversations = [];

  // Get start of today
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayStart = startOfToday.getTime();

  for (const conv of conversations) {
    const age = now - conv.updatedAt;

    if (conv.updatedAt >= todayStart) {
      today.push(conv);
    } else if (age < sevenDays) {
      last7Days.push(conv);
    } else if (age < thirtyDays) {
      last30Days.push(conv);
    } else {
      older.push(conv);
    }
  }

  return { today, last7Days, last30Days, older };
}

export function ChatSidebar() {
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("chat");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  const [expanded, setExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Convex queries and mutations - skip until Convex auth is ready
  const conversations = useQuery(
    api.conversations.list,
    isAuthenticated ? {} : "skip"
  );
  const removeConversation = useMutation(api.conversations.remove);
  const updateTitle = useMutation(api.conversations.updateTitle);

  // Get active conversation ID from URL
  const activeConversationId = useMemo(() => {
    const match = pathname.match(/\/chat\/c\/([^/]+)/);
    return match ? match[1] : null;
  }, [pathname]);

  // Group conversations by date
  const groupedConversations = useMemo(() => {
    if (!conversations)
      return { today: [], last7Days: [], last30Days: [], older: [] };
    return groupConversationsByDate(conversations);
  }, [conversations]);

  // Handle delete conversation
  const handleDelete = async (id: Id<"conversations">) => {
    try {
      await removeConversation({ id });
      // If we deleted the active conversation, navigate to new chat
      if (activeConversationId === id) {
        router.push(`/${locale}/chat`);
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  // Handle rename conversation
  const handleRename = async (id: Id<"conversations">, newTitle: string) => {
    try {
      await updateTitle({ id, title: newTitle });
    } catch (error) {
      console.error("Failed to rename conversation:", error);
    }
  };

  // User dropdown menu content (reused in both views)
  const UserDropdownContent = (
    <DropdownMenuContent
      align="start"
      side="top"
      sideOffset={8}
      className="w-56 ml-2"
    >
      <div className="flex items-center gap-3 p-3">
        <Avatar className="w-12 h-12">
          <AvatarImage
            src={user?.imageUrl}
            alt={user?.fullName || "User"}
          />
          <AvatarFallback>
            {user?.firstName?.charAt(0) || "U"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">
            {user?.fullName || tCommon("defaultManager")}
          </p>
          <p className="text-sm text-gray-500 truncate">
            {user?.primaryEmailAddress?.emailAddress ||
              tCommon("defaultEmail")}
          </p>
        </div>
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="cursor-pointer"
        onClick={() => setSettingsOpen(true)}
      >
        <Settings className="w-4 h-4" />
        {tNav("settings")}
      </DropdownMenuItem>
      <DropdownMenuItem
        className="cursor-pointer"
        onClick={() => setHelpOpen(true)}
      >
        <HelpCircle className="w-4 h-4" />
        {tNav("help")}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <SignOutButton redirectUrl={`/${locale}/sign-in`}>
        <DropdownMenuItem className="cursor-pointer">
          <LogOut className="w-4 h-4" />
          {tNav("logout")}
        </DropdownMenuItem>
      </SignOutButton>
    </DropdownMenuContent>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "relative hidden lg:flex flex-col h-screen bg-[#F9FAFF] py-4",
          "transition-[width] duration-300 ease-out",
          expanded ? "w-64 px-4" : "w-12"
        )}
      >
        {/* Rail View - Collapsed */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center py-4",
            "transition-opacity duration-150",
            expanded ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
        >
          {/* PanelLeft toggle at top */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setExpanded(true)}
                className="flex items-center justify-center w-10 h-10 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <PanelLeft className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              sideOffset={12}
              className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-medium"
            >
              {t("expandSidebar")}
            </TooltipContent>
          </Tooltip>

          {/* New chat button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => router.push(`/${locale}/chat?t=${Date.now()}`)}
                className="flex items-center justify-center w-10 h-10 mt-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <PenSquare className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              sideOffset={12}
              className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-medium"
            >
              {t("newChat")}
            </TooltipContent>
          </Tooltip>

          {/* Spacer */}
          <div className="flex-1" />

          {/* User avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center justify-center cursor-pointer hover:bg-gray-100 rounded-xl p-2 transition-colors">
                <Avatar className="w-8 h-8">
                  <AvatarImage
                    src={user?.imageUrl}
                    alt={user?.fullName || "User"}
                  />
                  <AvatarFallback>
                    {user?.firstName?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            {UserDropdownContent}
          </DropdownMenu>
        </div>

        {/* Expanded View */}
        <div
          className={cn(
            "flex flex-col h-full w-full",
            "transition-opacity duration-150",
            expanded ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          {/* Header: Logo + collapse toggle */}
          <div className="flex items-center justify-between mb-4 shrink-0">
            <Link href={`/${locale}/chat`} className="flex items-center gap-2">
              <Image
                src="/logo_ai.png"
                alt="AI Tutor"
                width={32}
                height={32}
                className="w-8 h-8"
              />
              <span className="font-semibold text-gray-900">
                {tCommon("appName")}
              </span>
            </Link>
            <button
              onClick={() => setExpanded(false)}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
            >
              <PanelLeft className="w-5 h-5 rotate-180" />
            </button>
          </div>

          {/* New chat button (full width) */}
          <div className="shrink-0 mb-2">
            <button
              onClick={() => router.push(`/${locale}/chat?t=${Date.now()}`)}
              className="flex items-center gap-2 py-3 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer w-full"
            >
              <PenSquare className="w-5 h-5" />
              <span className="font-semibold">{t("newChat")}</span>
            </button>
          </div>

          {/* Chat history (scrollable) */}
          <nav className="flex-1 overflow-y-auto min-h-0 mt-2">
            {groupedConversations.today.length > 0 && (
              <HistorySection title={t("today")}>
                {groupedConversations.today.map((chat) => (
                  <ChatItem
                    key={chat._id}
                    title={chat.title}
                    href={`/${locale}/chat/c/${chat._id}`}
                    isActive={activeConversationId === chat._id}
                    onDelete={() => handleDelete(chat._id)}
                    onRename={(newTitle) => handleRename(chat._id, newTitle)}
                  />
                ))}
              </HistorySection>
            )}

            {groupedConversations.last7Days.length > 0 && (
              <HistorySection title={t("last7Days")} defaultOpen={false}>
                {groupedConversations.last7Days.map((chat) => (
                  <ChatItem
                    key={chat._id}
                    title={chat.title}
                    href={`/${locale}/chat/c/${chat._id}`}
                    isActive={activeConversationId === chat._id}
                    onDelete={() => handleDelete(chat._id)}
                    onRename={(newTitle) => handleRename(chat._id, newTitle)}
                  />
                ))}
              </HistorySection>
            )}

            {groupedConversations.last30Days.length > 0 && (
              <HistorySection title={t("last30Days")} defaultOpen={false}>
                {groupedConversations.last30Days.map((chat) => (
                  <ChatItem
                    key={chat._id}
                    title={chat.title}
                    href={`/${locale}/chat/c/${chat._id}`}
                    isActive={activeConversationId === chat._id}
                    onDelete={() => handleDelete(chat._id)}
                    onRename={(newTitle) => handleRename(chat._id, newTitle)}
                  />
                ))}
              </HistorySection>
            )}

            {groupedConversations.older.length > 0 && (
              <HistorySection title={t("older")} defaultOpen={false}>
                {groupedConversations.older.map((chat) => (
                  <ChatItem
                    key={chat._id}
                    title={chat.title}
                    href={`/${locale}/chat/c/${chat._id}`}
                    isActive={activeConversationId === chat._id}
                    onDelete={() => handleDelete(chat._id)}
                    onRename={(newTitle) => handleRename(chat._id, newTitle)}
                  />
                ))}
              </HistorySection>
            )}

            {/* Empty state */}
            {conversations && conversations.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                {t("noConversations")}
              </div>
            )}
          </nav>

          {/* User profile */}
          <div className="mt-auto pt-4 shrink-0 px-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full cursor-pointer hover:bg-gray-50 rounded-xl p-2 transition-colors">
                  <Avatar className="w-10 h-10">
                    <AvatarImage
                      src={user?.imageUrl}
                      alt={user?.fullName || "User"}
                    />
                    <AvatarFallback>
                      {user?.firstName?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-medium text-gray-900 truncate">
                      {user?.fullName || tCommon("defaultManager")}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {user?.primaryEmailAddress?.emailAddress ||
                        tCommon("defaultEmail")}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              {UserDropdownContent}
            </DropdownMenu>
          </div>
        </div>

        <ProfileSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
        <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      </aside>
    </TooltipProvider>
  );
}
