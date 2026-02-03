"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useLocale } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ChatWelcome } from "./chat-welcome";
import { ChatInput, ModelType } from "./chat-input";
import { ChatContainer } from "./chat-container";
import { ChatSkeleton } from "./chat-skeleton";
import { Message } from "./chat-message";
import { RightPanel } from "./right-panel";
import { QuickActionButtons } from "./quick-action-buttons";
import { ReferenceChip } from "./reference-chip";
import { WelcomeQuickActions } from "./welcome-quick-actions";
import { useChatStream } from "@/hooks/use-chat-stream";

export interface TextbookReference {
  textbookId: Id<"textbooks">;
  subjectName: string;
  grade: number;
  chapterTitle: string;
  chapterDescription: string;
  topics: string[];
}

interface ChatViewProps {
  conversationId?: Id<"conversations">;
}

export function ChatView({ conversationId }: ChatViewProps) {
  const { user } = useUser();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const resetKey = searchParams.get("t");

  const [model, setModel] = useState<ModelType>("openai");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedTextbookId, setSelectedTextbookId] = useState<Id<"textbooks"> | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [reference, setReference] = useState<TextbookReference | null>(null);
  const conversationIdRef = useRef<Id<"conversations"> | null>(
    conversationId ?? null
  );
  // Session ID for external AI backend (UUID format)
  const sessionIdRef = useRef<string | null>(null);
  const loadedRef = useRef(false);
  // Track the resetKey we've processed to avoid wiping messages during URL updates
  const prevResetKeyRef = useRef<string | null>(resetKey);

  const { sendMessage, isStreaming, streamingContent } = useChatStream();

  const createConversation = useMutation(api.conversations.create);
  const touchConversation = useMutation(api.conversations.touch);
  const saveMessage = useMutation(api.messages.send);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const recordInteraction = useMutation(api.learningInteractions.record);

  // Load current user for role-based UI
  const currentUser = useQuery(api.users.getCurrentUser);

  // Load existing conversation data
  const conversation = useQuery(
    api.conversations.get,
    conversationId ? { id: conversationId } : "skip"
  );
  const loadedMessages = useQuery(
    api.messages.list,
    conversationId ? { conversationId } : "skip"
  );

  // Populate local state from loaded messages
  useEffect(() => {
    if (loadedMessages && !loadedRef.current) {
      loadedRef.current = true;
      setMessages(
        loadedMessages.map((m) => ({
          id: m._id,
          role: m.role as "user" | "assistant",
          content: m.content,
          imageUrl: m.imageUrl,
        }))
      );
    }
  }, [loadedMessages]);

  // Set model from loaded conversation
  useEffect(() => {
    if (conversation?.model) {
      setModel(conversation.model as ModelType);
    }
  }, [conversation?.model]);

  // Set sessionId from loaded conversation
  useEffect(() => {
    if (conversation?.sessionId) {
      sessionIdRef.current = conversation.sessionId;
    }
  }, [conversation?.sessionId]);

  // Reset state when navigating to an existing conversation changes
  useEffect(() => {
    if (conversationId) {
      // When conversationId prop is provided, sync the ref
      conversationIdRef.current = conversationId;
    }
  }, [conversationId]);

  // Handle "New Chat" button - only reset when resetKey CHANGES to a new value
  useEffect(() => {
    // Only trigger reset when:
    // 1. resetKey exists (we're at /chat?t=...)
    // 2. resetKey is different from what we've already processed
    // 3. We don't have an active conversation in progress
    if (resetKey && resetKey !== prevResetKeyRef.current) {
      prevResetKeyRef.current = resetKey;
      // Force reset for new chat
      setMessages([]);
      conversationIdRef.current = null;
      sessionIdRef.current = null;
      setInputValue("");
      setImageFile(null);
      setReference(null);
      loadedRef.current = false;
    }
  }, [resetKey]);

  // Also reset when navigating directly to /chat (no conversationId and no resetKey)
  useEffect(() => {
    if (!conversationId && !conversationIdRef.current && !resetKey) {
      setMessages([]);
      sessionIdRef.current = null;
      setInputValue("");
      setImageFile(null);
      setReference(null);
      loadedRef.current = false;
    }
  }, [conversationId, resetKey]);

  // Helper to convert File to base64
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Extract base64 data without the data URL prefix
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const handleSend = useCallback(
    async (content: string) => {
      if (!user?.id || isStreaming) return;
      const currentImage = imageFile;
      setInputValue("");
      setImageFile(null);

      // Upload image to Convex if present
      let imageStorageId: Id<"_storage"> | undefined;
      let resolvedImageUrl: string | undefined;
      let imageBase64: string | undefined;
      if (currentImage) {
        // Convert to base64 for vision API
        imageBase64 = await fileToBase64(currentImage);

        const uploadUrl = await generateUploadUrl();
        const uploadResult = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": currentImage.type },
          body: currentImage,
        });
        const { storageId } = await uploadResult.json();
        imageStorageId = storageId;
        // Create a local preview URL for immediate display
        resolvedImageUrl = URL.createObjectURL(currentImage);
      }

      // Add user message to local state
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        imageUrl: resolvedImageUrl,
      };
      setMessages((prev) => [...prev, userMsg]);

      // Create conversation in Convex if first message
      let convId = conversationIdRef.current;
      let currentSessionId = sessionIdRef.current;
      if (!convId) {
        // Generate new session ID for external AI backend
        currentSessionId = crypto.randomUUID();
        sessionIdRef.current = currentSessionId;

        const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
        convId = await createConversation({
          title,
          model,
          sessionId: currentSessionId,
        });
        conversationIdRef.current = convId;

        // Update URL without triggering navigation (preserves component state)
        window.history.replaceState(null, "", `/${locale}/chat/c/${convId}`);
      } else {
        await touchConversation({ id: convId });
      }

      // Save user message to Convex (with imageId if uploaded)
      await saveMessage({
        conversationId: convId,
        role: "user",
        content,
        model,
        imageId: imageStorageId,
      });

      // Stream AI response using chat-v2 API (backend manages conversation history)
      try {
        const assistantContent = await sendMessage(
          content,
          currentSessionId ?? undefined,
          undefined, // classId
          imageBase64,
        );

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

          // Track learning interaction when textbook reference is active
          if (reference) {
            recordInteraction({
              textbookId: reference.textbookId,
              subjectName: reference.subjectName,
              grade: reference.grade,
              topicTitle: reference.chapterDescription,
              interactionType: currentImage ? "problem_solving" : "question",
              conversationId: convId,
            }).catch(() => {});
          }
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
      imageFile,
      reference,
      sendMessage,
      generateUploadUrl,
      createConversation,
      touchConversation,
      saveMessage,
      recordInteraction,
      fileToBase64,
      locale,
    ]
  );

  const hasMessages = messages.length > 0 || isStreaming;
  // Show skeleton when loading an existing conversation
  const isLoadingConversation = conversationId && loadedMessages === undefined;

  return (
    <div className="flex h-full gap-4">
      {/* Main chat area */}
      <div className="flex min-w-0 flex-1 flex-col rounded-3xl bg-white overflow-hidden">
        {isLoadingConversation ? (
          // Loading skeleton for existing conversations
          <>
            <ChatSkeleton />
            <div className="shrink-0 px-4 pb-6 pt-2">
              <ChatInput
                onSend={handleSend}
                model={model}
                onModelChange={setModel}
                disabled={true}
                value={inputValue}
                onValueChange={setInputValue}
                imageFile={imageFile}
                onImageChange={setImageFile}
              />
            </div>
          </>
        ) : hasMessages ? (
          <>
            <ChatContainer
              messages={messages}
              streamingContent={streamingContent}
              isStreaming={isStreaming}
            />
            {/* Input area at bottom */}
            <div className="shrink-0 px-4 pb-6 pt-2">
              {reference && (
                <QuickActionButtons onAction={setInputValue} reference={reference} />
              )}
              {reference && (
                <ReferenceChip reference={reference} onRemove={() => setReference(null)} />
              )}
              <ChatInput
                onSend={handleSend}
                model={model}
                onModelChange={setModel}
                disabled={isStreaming}
                value={inputValue}
                onValueChange={setInputValue}
                imageFile={imageFile}
                onImageChange={setImageFile}
              />
            </div>
          </>
        ) : (
          <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4">
            {/* Blue gradient glow */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute left-1/2 top-0 h-96 w-[500px] -translate-x-1/2 rounded-full bg-blue-400/15 blur-3xl" />
            </div>
            <div className="relative z-10 flex w-full flex-col items-center gap-6">
              <ChatWelcome />
              {reference && (
                <QuickActionButtons onAction={setInputValue} reference={reference} />
              )}
              {reference && (
                <ReferenceChip reference={reference} onRemove={() => setReference(null)} />
              )}
              <ChatInput
                onSend={handleSend}
                model={model}
                onModelChange={setModel}
                disabled={isStreaming}
                value={inputValue}
                onValueChange={setInputValue}
                imageFile={imageFile}
                onImageChange={setImageFile}
              />
              <WelcomeQuickActions onAction={setInputValue} userRole={currentUser?.role} />
            </div>
          </div>
        )}
      </div>

      {/* Right panel */}
      <RightPanel
        selectedTextbookId={selectedTextbookId}
        onSelectTextbook={setSelectedTextbookId}
        onSetReference={setReference}
      />
    </div>
  );
}
