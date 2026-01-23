"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ChatWelcome } from "./chat-welcome";
import { ChatInput, ModelType } from "./chat-input";
import { ChatContainer } from "./chat-container";
import { Message } from "./chat-message";
import { RightPanel } from "./right-panel";
import { QuickActionButtons } from "./quick-action-buttons";
import { ReferenceChip } from "./reference-chip";
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
  const [model, setModel] = useState<ModelType>("openai");
  const [messages, setMessages] = useState<Message[]>([]);
  const [panelOpen, setPanelOpen] = useState(true);
  const [selectedTextbookId, setSelectedTextbookId] = useState<Id<"textbooks"> | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [reference, setReference] = useState<TextbookReference | null>(null);
  const conversationIdRef = useRef<Id<"conversations"> | null>(
    conversationId ?? null
  );
  const loadedRef = useRef(false);

  const { sendMessage, isStreaming, streamingContent } = useChatStream();

  const createConversation = useMutation(api.conversations.create);
  const touchConversation = useMutation(api.conversations.touch);
  const saveMessage = useMutation(api.messages.send);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);

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

  const buildTextbookContext = (ref: TextbookReference): string => {
    const topicsList = ref.topics.map((t, i) => `${i + 1}. ${t}`).join("\n");
    return `Сурах бичиг: ${ref.subjectName}, ${ref.grade}-р анги\nБүлэг: ${ref.chapterTitle} - ${ref.chapterDescription}\nСэдвүүд:\n${topicsList}`;
  };

  const handleSend = useCallback(
    async (content: string) => {
      if (!user?.id || isStreaming) return;
      const currentImage = imageFile;
      setInputValue("");
      setImageFile(null);

      // Upload image to Convex if present
      let imageStorageId: Id<"_storage"> | undefined;
      let resolvedImageUrl: string | undefined;
      if (currentImage) {
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

      // Save user message to Convex (with imageId if uploaded)
      await saveMessage({
        conversationId: convId,
        role: "user",
        content,
        model,
        imageId: imageStorageId,
      });

      // Build messages array for API (only role + content)
      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Stream AI response
      try {
        const textbookContext = reference
          ? buildTextbookContext(reference)
          : undefined;

        // Convert image to data URL for the API (works for both OpenAI and Gemini)
        let apiImageUrl: string | undefined;
        if (currentImage) {
          const reader = new FileReader();
          apiImageUrl = await new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(currentImage);
          });
        }

        const assistantContent = await sendMessage(apiMessages, model, textbookContext, apiImageUrl);

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
      imageFile,
      reference,
      sendMessage,
      generateUploadUrl,
      createConversation,
      touchConversation,
      saveMessage,
    ]
  );

  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <div className="flex h-full">
      {/* Main chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {hasMessages ? (
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
            </div>
          </div>
        )}
      </div>

      {/* Right panel */}
      <RightPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        selectedTextbookId={selectedTextbookId}
        onSelectTextbook={setSelectedTextbookId}
        onSetReference={setReference}
      />
    </div>
  );
}
