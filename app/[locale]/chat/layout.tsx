"use client";

import dynamic from "next/dynamic";

const ChatSidebar = dynamic(
  () =>
    import("@/components/chat/chat-sidebar").then((mod) => mod.ChatSidebar),
  { ssr: false }
);

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-white">
      <ChatSidebar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
