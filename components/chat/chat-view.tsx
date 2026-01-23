"use client";

import { useState } from "react";
import { ChatWelcome } from "./chat-welcome";
import { ChatInput, ModelType } from "./chat-input";

export function ChatView() {
  const [model, setModel] = useState<ModelType>("openai");

  const handleSend = (message: string) => {
    // Step 5 will connect this to real AI streaming
    console.log("Send:", message, "Model:", model);
  };

  const handleMicClick = () => {
    // Step 7 will connect this to Chimege STT
    console.log("Mic clicked");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Welcome / Messages area */}
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4">
        {/* Blue gradient glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-96 w-[500px] -translate-x-1/2 rounded-full bg-blue-400/15 blur-3xl" />
        </div>

        {/* Welcome content */}
        <div className="relative z-10 flex flex-col items-center gap-8">
          <ChatWelcome />
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 p-4 pb-6">
        <ChatInput
          onSend={handleSend}
          model={model}
          onModelChange={setModel}
          onMicClick={handleMicClick}
        />
      </div>
    </div>
  );
}
