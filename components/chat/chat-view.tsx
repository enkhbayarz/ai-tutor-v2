"use client";

import { useState, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ChatWelcome } from "./chat-welcome";
import { ChatInput, ModelType } from "./chat-input";
import { ChatContainer } from "./chat-container";
import { Message } from "./chat-message";
import { RightPanel } from "./right-panel";
import { useChatStream } from "@/hooks/use-chat-stream";

export function ChatView() {
  const { user } = useUser();
  const [model, setModel] = useState<ModelType>("openai");
  const [messages, setMessages] = useState<Message[]>([]);
  const [panelOpen, setPanelOpen] = useState(true);
  const conversationIdRef = useRef<Id<"conversations"> | null>(null);

  const { sendMessage, isStreaming, streamingContent } = useChatStream();

  const createConversation = useMutation(api.conversations.create);
  const touchConversation = useMutation(api.conversations.touch);
  const saveMessage = useMutation(api.messages.send);

  const handleSend = useCallback(
    async (content: string) => {
      if (!user?.id || isStreaming) return;

      // Add user message to local state
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
      };
      setMessages((prev) => [...prev, userMsg]);

      // Create conversation in Convex if first message
      let convId = conversationIdRef.current;
      if (!convId) {
        const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
        convId = await createConversation({
          clerkUserId: user.id,
          title,
          model,
        });
        conversationIdRef.current = convId;
      } else {
        await touchConversation({ id: convId });
      }

      // Save user message to Convex
      await saveMessage({
        conversationId: convId,
        role: "user",
        content,
        model,
      });

      // Build messages array for API (only role + content)
      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Stream AI response
      try {
        const assistantContent = await sendMessage(apiMessages, model);

        if (assistantContent) {
          // Add assistant message to local state
          const assistantMsg: Message = {
            id: `asst-${Date.now()}`,
            role: "assistant",
            content: assistantContent,
          };
          setMessages((prev) => [...prev, assistantMsg]);

          // Save assistant message to Convex
          await saveMessage({
            conversationId: convId,
            role: "assistant",
            content: assistantContent,
            model,
          });
        }
      } catch (error) {
        console.error("Failed to get AI response:", error);
      }
    },
    [
      user?.id,
      model,
      messages,
      isStreaming,
      sendMessage,
      createConversation,
      touchConversation,
      saveMessage,
    ]
  );

  const handleMicClick = () => {
    // Step 7 will connect this to Chimege STT
    console.log("Mic clicked");
  };

  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <div className="flex h-full">
      {/* Main chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {hasMessages ? (
          <ChatContainer
            messages={messages}
            streamingContent={streamingContent}
            isStreaming={isStreaming}
          />
        ) : (
          <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4">
            {/* Blue gradient glow */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute left-1/2 top-0 h-96 w-[500px] -translate-x-1/2 rounded-full bg-blue-400/15 blur-3xl" />
            </div>
            <div className="relative z-10 flex flex-col items-center gap-8">
              <ChatWelcome />
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="shrink-0 p-4 pb-6">
          <ChatInput
            onSend={handleSend}
            model={model}
            onModelChange={setModel}
            disabled={isStreaming}
            onMicClick={handleMicClick}
          />
        </div>
      </div>

      {/* Right panel */}
      <RightPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  );
}
