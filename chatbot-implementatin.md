# Chatbot Interface - Step-by-Step Implementation Guide

## Overview
Build AI chatbot at `app/[locale]/(chat)/` with:
- Real streaming LLM (OpenAI GPT-4o-mini + Gemini 2.0 Flash)
- Model toggle inside input bar
- Chimege voice input (STT)
- Convex chat history persistence
- Right panel with real textbook data from Convex

---

## Prerequisites
```bash
bun add openai @google/generative-ai
```

Env vars in `.env.local`:
```
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=AI...
CHIMEGE_STT_KEY=...
CHIMEGE_TTS_KEY=...
```

---

## STEP 1: Chat Layout + Sidebar

### 1.1 Create `app/[locale]/(chat)/layout.tsx`
- Client component with `flex h-screen`
- Renders `<ChatSidebar />` + `<main className="flex-1 overflow-hidden">{children}</main>`

### 1.2 Create `app/[locale]/(chat)/page.tsx`
- Simple page that renders `<ChatView />`

### 1.3 Create `components/chat/chat-sidebar.tsx`
- Same expand/collapse pattern as `components/common/sidebar.tsx`
- **Collapsed**: w-16 with icon buttons
- **Expanded**: w-64 with labels
- **Top**: Logo (`/logo_ai.png`) + expand/collapse toggle
- **Nav items**:
  - `PenSquare` icon → "Шинэ чат" (new chat) → resets to `/mn/chat`
  - `Clock` icon → "Түүх" (history) → opens history panel (Step 8)
- **Bottom**: User profile section (copy from dashboard sidebar - avatar, name, dropdown menu with settings/help/logout)
- Uses `useUser()` from Clerk, same `DropdownMenu` pattern

### Test
```
bun run build → passes
Navigate /mn/chat → sidebar visible + empty main area
Sidebar expands/collapses
Profile dropdown works
```

---

## STEP 2: Chat Welcome + Input

### 2.1 Create `components/chat/chat-welcome.tsx`
```tsx
// Logo + "Өдрийн мэнд!" subtitle + "Танд юугаар туслах вэ?" heading
// Centered in flex container
```

### 2.2 Create `components/chat/chat-input.tsx`
- `<form>` with rounded pill container (`rounded-full border px-4 py-2`)
- **Left**: Model selector - small Popover/Select showing current model name
  - Options: "GPT-4o" (openai), "Gemini" (gemini)
  - Compact chip style with ChevronDown icon
  - Stores selected model in state, passed up via prop
- **Middle**: `<input>` with `placeholder="Энд бичээрэй..."`
- **Right**: Mic button (ghost, icon) + Send button (blue circle, `bg-blue-500 rounded-full`)
- Props: `onSend(message, model)`, `disabled`, `onMicClick`

### 2.3 Create `components/chat/chat-view.tsx`
- State: `messages[]`, `streamingMessage`, `selectedModel`
- When no messages: show `<ChatWelcome />` with blue gradient background
- Background: `absolute div` with `bg-blue-400/20 blur-3xl` positioned top-center
- Bottom: `<ChatInput />` always visible
- When messages exist: show `<ChatContainer />` (Step 5)

### Test
```
Navigate /mn/chat → blue gradient, greeting, input bar visible
Model selector dropdown works (switches between GPT-4o/Gemini)
Type text → send button activates
Submit → (nothing happens yet, just console.log)
```

---

## STEP 3: Convex Chat Schema

### 3.1 Update `convex/schema.ts`
Add these tables:
```typescript
conversations: defineTable({
  clerkUserId: v.string(),
  title: v.string(),
  model: v.string(), // "openai" | "gemini"
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["clerkUserId"])
  .index("by_updated", ["updatedAt"]),

messages: defineTable({
  conversationId: v.id("conversations"),
  role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
  content: v.string(),
  model: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_conversation", ["conversationId"]),
```

### 3.2 Create `convex/conversations.ts`
```typescript
// Mutations:
// - create({ clerkUserId, title, model }) → returns Id
// - updateTitle({ id, title })
// - remove({ id }) → deletes conversation + its messages

// Queries:
// - list({ clerkUserId }) → ordered by updatedAt desc
// - get({ id }) → single conversation
```

### 3.3 Create `convex/messages.ts`
```typescript
// Mutations:
// - send({ conversationId, role, content, model? })

// Queries:
// - list({ conversationId }) → ordered by createdAt asc
```

### Test
```
bunx convex dev → syncs without errors
Convex dashboard shows new tables
Can create test records via dashboard
```

---

## STEP 4: AI Streaming API Route

### 4.1 Create `app/api/chat/route.ts`
```typescript
// POST handler
// Body: { messages: [{role, content}], model: "openai" | "gemini" }
// Returns: ReadableStream with text chunks

// System prompt (prepended to messages):
// "Та бол Монгол хэлээр заадаг AI багш туслах. Сурагчдад тусалж,
//  асуултад тодорхой, товч хариулаарай."

// OpenAI path:
// - new OpenAI({ apiKey })
// - chat.completions.create({ model: "gpt-4o-mini", messages, stream: true })
// - Iterate over stream chunks, write to ReadableStream encoder

// Gemini path:
// - new GoogleGenerativeAI(apiKey)
// - model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
// - Convert messages to Gemini format (contents array with role/parts)
// - generateContentStream() → iterate chunks

// Response: new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
```

### Test
```bash
# Test OpenAI:
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"openai","messages":[{"role":"user","content":"Сайн уу"}]}'

# Test Gemini:
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"gemini","messages":[{"role":"user","content":"Сайн уу"}]}'

# Both should stream Mongolian text responses
```

---

## STEP 5: Full Chat with Streaming

### 5.1 Create `hooks/use-chat-stream.ts`
```typescript
// Hook: useChatStream()
// State: isStreaming, streamingContent
//
// sendMessage(messages[], model):
//   1. Set isStreaming = true
//   2. fetch("/api/chat", { method: "POST", body: { messages, model } })
//   3. reader = response.body.getReader()
//   4. Loop: read chunks, decode, append to streamingContent
//   5. On done: set isStreaming = false, return full content
//
// Returns: { sendMessage, isStreaming, streamingContent, reset }
```

### 5.2 Create `components/chat/chat-container.tsx`
- Scrollable div (`overflow-y-auto flex-1`)
- Renders messages list + streaming message
- Smart auto-scroll: scroll to bottom on new content UNLESS user scrolled up
- Uses `useRef` for scroll container + `useEffect` for auto-scroll
- Max-width `max-w-2xl mx-auto` for messages

### 5.3 Create `components/chat/chat-message.tsx`
- **User**: Right-aligned, `bg-slate-800 text-white rounded-2xl px-4 py-2`
- **Assistant**: Left-aligned, logo avatar (small, 6x6), light background
- **Streaming indicator**: Animated `▊` block cursor (pulse animation)
- Simple markdown: Parse `**bold**`, preserve line breaks

### 5.4 Create `components/chat/scroll-to-bottom.tsx`
- Floating button, absolute positioned bottom-24 center
- Shows only when user scrolled up (not at bottom)
- ArrowDown icon in circle, `rounded-full shadow-lg`

### 5.5 Update `components/chat/chat-view.tsx`
- Integrate `useChatStream` hook
- On send:
  1. Add user message to local state
  2. Create conversation in Convex (if first message)
  3. Save user message to Convex
  4. Call `sendMessage()` for streaming
  5. On stream complete: save assistant message to Convex
  6. Auto-title: Use first 50 chars of first user message

### Test
```
Type message → AI response streams in character by character
Animated cursor while streaming
Switch model toggle → different AI responds
Scroll up during long response → stays put (no auto-scroll)
Scroll-to-bottom button appears when scrolled up
Page reload → messages load from Convex
```

---

## STEP 6: Right Panel (Textbooks)

### 6.1 Create `components/chat/right-panel.tsx`
- **States**: `hidden` | `collapsed` | `expanded`
- **Hidden**: `open={false}` → returns null
- **Collapsed**: `w-16` icon bar
  - X close button
  - BookOpen icon with blue "+" badge → click expands
- **Expanded**: renders `<TextbookPanel />`
- Prop: `open` (controlled by ChatView, opens on first message)

### 6.2 Create `components/chat/textbook-panel.tsx`
- Header: "Сурах бичиг" + back button (→ collapse to icon bar)
- Filters: Grade Select (1-12) + Subject Select (from schema)
- Grid: 2-col grid of `<TextbookCard />`
- Data: `useQuery(api.textbooks.listActive, { grade, subject })`
- Add a `listActive` query to `convex/textbooks.ts`:
  - Filters by `status !== "deleted"`
  - Optional grade/subject filters

### 6.3 Create `components/chat/textbook-card.tsx`
- Thumbnail image (from Convex storage URL)
- Subject name + grade badge
- Hover scale animation
- Click → (future: show TOC or add to context)

### 6.4 Update `components/chat/chat-view.tsx`
- Add `panelOpen` state
- Set `panelOpen = true` on first message
- Render `<RightPanel open={panelOpen} />` at right side

### Test
```
Send first message → icon bar appears on right
Click BookOpen icon → panel expands with real textbooks
Grade filter → list updates
Close → returns to icon bar
```

---

## STEP 7: Voice Input (Chimege STT)

### 7.1 Create `app/api/chimege/route.ts`
```typescript
// GET/POST handler with ?type=stt or ?type=tts
//
// STT (type=stt):
//   - Receives audio buffer in request body
//   - POST to Chimege STT endpoint with auth header
//   - Returns { text: string }
//
// TTS (type=tts):
//   - Receives { text: string } in body
//   - POST to Chimege TTS endpoint
//   - Returns audio blob (audio/wav)
```

### 7.2 Create `hooks/use-voice-input.ts`
Adapted from `examples/tutor-chimege/page.tsx`:
```typescript
// Returns: { isRecording, audioLevel, startRecording, stopRecording }
//
// startRecording():
//   1. getUserMedia({ audio: { deviceId } })
//   2. Create AudioContext + AnalyserNode for VAD
//   3. Start MediaRecorder
//   4. Monitor audio levels via requestAnimationFrame
//   5. Track silence: if level < threshold for 1s → auto-stop
//
// stopRecording():
//   1. Stop MediaRecorder
//   2. Collect audio blob from chunks
//   3. If blob > 1KB (actually spoke): POST to /api/chimege?type=stt
//   4. Return transcribed text
//   5. Cleanup: close AudioContext, stop stream tracks
//
// No Rive avatar logic - just audio recording + STT
```

### 7.3 Create `components/chat/voice-indicator.tsx`
- Small overlay shown above input when recording
- Audio level bar (green progress indicator)
- Status text: "Ярина уу..." (Speak now) / "Бичиж байна..." (Recording)
- Compact, doesn't block the input

### 7.4 Update `components/chat/chat-input.tsx`
- Mic button onClick → `startRecording()` or `stopRecording()`
- While recording: show VoiceIndicator, mic icon changes to red/active
- On transcript received: set input value to transcript text
- User can then edit and send

### Test
```
Click mic → browser permission prompt
Grant permission → recording starts, green level bar shows
Speak in Mongolian → auto-stops after silence
Transcribed text appears in input field
Can edit and send as normal message
```

---

## STEP 8: Chat History

### 8.1 Create `app/[locale]/(chat)/c/[id]/page.tsx`
- Get `id` from params
- Render `<ChatView conversationId={id} />`

### 8.2 Create `components/chat/history-panel.tsx`
- Uses shadcn `Sheet` component (slides from left)
- Lists conversations: `useQuery(api.conversations.list, { clerkUserId })`
- Each item: title + relative date + model badge (small chip)
- Click → `router.push(\`/${locale}/chat/c/${id}\`)`
- Delete button per conversation (with confirmation)
- Empty state: "Чат түүх байхгүй" + icon

### 8.3 Update `components/chat/chat-sidebar.tsx`
- Clock icon onClick → open history Sheet
- Render `<HistoryPanel open={historyOpen} onOpenChange={setHistoryOpen} />`

### 8.4 Update `components/chat/chat-view.tsx`
- Accept optional `conversationId` prop
- If provided: load messages from Convex via `useQuery(api.messages.list, { conversationId })`
- Populate messages state from loaded data
- Continue chatting: new messages append to existing conversation
- New Chat (PenSquare) → `router.push(\`/${locale}/chat\`)`

### Test
```
Chat with AI → conversation auto-saved
Click history icon → Sheet opens with conversation list
Click a conversation → navigates, previous messages load
Can continue chatting in loaded conversation
New Chat button → fresh empty chat
Delete conversation → removed from list
```

---

## STEP 9: Message Actions

### 9.1 Create `components/chat/message-actions.tsx`
- Appears below each assistant message (on hover or always visible)
- **Copy button**: `Copy` icon → `navigator.clipboard.writeText(content)` → toast "Хуулагдлаа"
- **Audio button**: `Volume2` icon → calls `/api/chimege?type=tts` with message content
  - Shows loading spinner while generating
  - Creates audio Blob → `new Audio(URL.createObjectURL(blob)).play()`
  - Clean up object URL after playback

### 9.2 Update `app/api/chimege/route.ts`
- Add TTS path (type=tts):
  - Receives `{ text: string }` in JSON body
  - Truncate to 300 chars if longer (Chimege limit)
  - POST to Chimege TTS endpoint
  - Return audio/wav response

### 9.3 Update `components/chat/chat-message.tsx`
- Render `<MessageActions content={message.content} />` below assistant messages
- Only show when not streaming

### Test
```
Copy button → text copied, toast appears
Audio button → loading state → Mongolian audio plays back
Long messages get truncated for TTS
```

---

## STEP 10: Translations

### 10.1 Update `messages/mn.json`
Add `"chat"` namespace with all Mongolian strings.

### 10.2 Update `messages/en.json`
Add `"chat"` namespace with English equivalents.

### 10.3 Update all chat components
Replace hardcoded strings with `useTranslations("chat")` calls.

### Test
```
All text shows in Mongolian at /mn/chat
Switch to /en/chat → English text
bun run build → no errors
```

---

## Final File Structure
```
app/[locale]/(chat)/
├── layout.tsx
├── page.tsx
└── c/[id]/page.tsx

app/api/
├── chat/route.ts
└── chimege/route.ts

components/chat/
├── chat-sidebar.tsx
├── chat-view.tsx
├── chat-welcome.tsx
├── chat-input.tsx
├── chat-container.tsx
├── chat-message.tsx
├── message-actions.tsx
├── scroll-to-bottom.tsx
├── right-panel.tsx
├── textbook-panel.tsx
├── textbook-card.tsx
├── history-panel.tsx
└── voice-indicator.tsx

hooks/
├── use-chat-stream.ts
└── use-voice-input.ts

convex/
├── conversations.ts
└── messages.ts
```

## Dependencies
```bash
bun add openai @google/generative-ai
```
