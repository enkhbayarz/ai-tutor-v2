# SESSION-CONTEXT.md

Full implementation context for AI Tutor V2. Read this to understand what has been built, how it works, and what comes next.

---

## Current State Summary

The app is a working Mongolian-language AI tutoring platform with:
- Clerk authentication (admin/teacher/student roles)
- Teacher and student CRUD management with Excel export
- Textbook upload, PDF text extraction, and table-of-contents editing
- AI chat with streaming responses (OpenAI GPT + Google Gemini)
- Voice input via Mongolian STT (Chimege API)
- Image upload for problem-solving (GPT-4o Vision / Gemini Vision)
- Textbook reference context injection (pin a chapter for smarter responses)
- Chat history persistence in Convex
- Bilingual UI (Mongolian default, English fallback)

---

## Implemented Features

### 1. Authentication (Clerk)
- Sign-in/sign-up with Clerk components
- Webhook syncs Clerk users to Convex `users` table
- Roles: admin, teacher, student
- Protected routes via middleware.ts
- Login history tracking (device, browser, location)

### 2. Teacher & Student Management
- List view with DataTable component (pagination, sorting)
- Add/edit via PersonFormDialog (grade, group, phone fields)
- Soft delete (status: "active" | "deleted")
- Grade/group filtering with EntityFilters
- Excel export via `lib/export-excel.ts`
- Empty state with CTA when no records exist

### 3. Textbook Management
- Upload PDF + thumbnail image to Convex storage
- Create/edit textbook (subject, grade, year, type, notes)
- PDF text extraction via `api/extract-pdf` (pdf2json library)
- Automatic table of contents extraction from PDF structure
- Manual TOC editor (chapters with ChapterDialog, topics with TopicDialog)
- View textbook detail page with TOC display
- Filter by grade, subject, type, status
- Recently viewed tracking (FIFO, max 3 per user)
- Form draft persistence via sessionStorage (useFormDraft hook)

### 4. AI Chat
- Dual model support: OpenAI GPT-4o-mini (text) / GPT-4o (vision) and Gemini 2.0 Flash
- Model selector in input bar (switch anytime)
- Streaming responses via ReadableStream
- Conversation management (create, list, delete, touch)
- Chat sidebar with conversation history
- Welcome screen with greeting when no messages
- Message formatting (bold, line breaks)
- Copy message action (MessageActions component)
- Mongolian system prompt for educational context

### 5. Voice Input
- Microphone button in chat input
- Records audio via MediaRecorder API
- Transcribes via Chimege STT API (`/api/chimege`)
- VoiceIndicator component shows audio levels
- Appends transcribed text to input field

### 6. Textbook Reference Context
- Right panel shows textbooks in chat view
- TextbookDetailPanel shows chapters/topics
- "Танд хэрхэн туслах уу?" button on each chapter sets reference
- ReferenceChip displays above input (removable)
- QuickActionButtons show context-aware prompts (Prepare test, Lesson plan, Exercise)
- Reference builds textbook context string injected into LLM system prompt:
  ```
  Сурах бичиг: [subject], [grade]-р анги
  Бүлэг: [chapter] - [description]
  Сэдвүүд: [topics list]
  ```

### 7. Image Upload & Vision
- Paperclip button in chat input opens file picker
- Image preview with remove (X) button above input
- 10MB file size validation
- Upload to Convex storage (storageId saved in messages table)
- Data URL passed to API for LLM processing
- OpenAI: multimodal content array with `image_url` type, uses GPT-4o
- Gemini: fetches image, converts to base64, uses `inlineData`
- Default prompt when no text: "Энэ зургийг тайлбарлаж, бодлогыг алхам алхмаар бодож өгнө үү."
- Images persist in chat history (resolved from Convex storage on load)

---

## Complete File Map

### App Pages
```
app/[locale]/(auth)/sign-in/       - Clerk sign-in
app/[locale]/(auth)/sign-up/       - Clerk sign-up
app/[locale]/(dashboard)/page.tsx  - Dashboard home
app/[locale]/(dashboard)/student-info/page.tsx - Student list
app/[locale]/(dashboard)/teacher-info/page.tsx - Teacher list
app/[locale]/(dashboard)/textbook/page.tsx     - Textbook list
app/[locale]/(dashboard)/textbook/new/page.tsx - Add textbook
app/[locale]/(dashboard)/textbook/[id]/page.tsx     - View textbook
app/[locale]/(dashboard)/textbook/[id]/edit/page.tsx - Edit textbook
app/[locale]/chat/page.tsx         - New chat
app/[locale]/chat/c/[id]/page.tsx  - View conversation
```

### API Routes
```
app/api/chat/route.ts        - POST: Streaming LLM (OpenAI + Gemini, vision support)
app/api/chimege/route.ts     - POST: Mongolian STT transcription
app/api/extract-pdf/route.ts - POST: PDF text extraction + TOC parsing
```

### Chat Components
```
components/chat/chat-view.tsx          - Main chat orchestrator (state, send logic, image upload)
components/chat/chat-input.tsx         - Input bar (text, model selector, mic, paperclip, send)
components/chat/chat-message.tsx       - Message bubble (user/assistant, image, formatting)
components/chat/chat-container.tsx     - Scrollable message list
components/chat/chat-sidebar.tsx       - Left sidebar with conversation history
components/chat/chat-welcome.tsx       - Welcome greeting screen
components/chat/right-panel.tsx        - Right panel wrapper (textbook browser)
components/chat/textbook-panel.tsx     - Textbook list in panel
components/chat/textbook-card.tsx      - Textbook preview card
components/chat/textbook-detail-panel.tsx - Textbook chapters/topics with reference button
components/chat/quick-action-buttons.tsx - Context-aware quick prompts
components/chat/reference-chip.tsx     - Shows active textbook reference
components/chat/voice-indicator.tsx    - Audio level visualization
components/chat/message-actions.tsx    - Copy/actions on messages
components/chat/history-panel.tsx      - Chat history management
components/chat/scroll-to-bottom.tsx   - Auto-scroll behavior
```

### Textbook Components
```
components/textbook/file-upload.tsx      - Drag-drop file upload (PDF/image)
components/textbook/textbook-filters.tsx - Grade/subject/type filters
components/textbook/textbook-context.tsx - React context for textbook data
components/textbook/table-of-contents.tsx - TOC display component
components/textbook/chapter-dialog.tsx   - Add/edit chapter modal
components/textbook/topic-dialog.tsx     - Add/edit topic modal
```

### Shared & Common
```
components/shared/data-table.tsx         - Reusable table with pagination
components/shared/delete-dialog.tsx      - Confirmation dialog
components/shared/empty-state.tsx        - Empty state with CTA
components/shared/entity-filters.tsx     - Grade/subject filter UI
components/shared/person-form-dialog.tsx - Add/edit person modal
components/shared/table-skeleton.tsx     - Loading skeleton

components/common/sidebar.tsx            - Main navigation
components/common/mobile-sidebar.tsx     - Mobile nav
components/common/mobile-header.tsx      - Mobile header
components/common/help-dialog.tsx        - Settings/help modal
components/common/profile-settings-dialog.tsx - Profile edit
```

### Hooks
```
hooks/use-chat-stream.ts   - Streaming fetch to /api/chat with abort support
hooks/use-voice-input.ts   - MediaRecorder + STT transcription
hooks/use-form-draft.ts    - Session storage draft persistence
```

### Convex Backend
```
convex/schema.ts           - All table definitions
convex/users.ts            - User CRUD, Clerk sync
convex/teachers.ts         - Teacher CRUD with filters
convex/students.ts         - Student CRUD with filters
convex/textbooks.ts        - Textbook CRUD, file URLs, extraction
convex/conversations.ts    - Chat conversation management
convex/messages.ts         - Message CRUD, image upload/URL resolution
convex/recentTextbooks.ts  - Recently viewed tracking
convex/loginHistory.ts     - Login event storage
convex/migrations.ts       - Data migrations
convex/http.ts             - HTTP webhooks
convex/auth.config.ts      - Clerk auth config
```

### Lib & Utils
```
lib/utils.ts               - cn() helper (clsx + tailwind-merge)
lib/export-excel.ts        - Excel export utility
lib/toc-parser.ts          - PDF TOC parsing
lib/validations/person.ts  - Name, phone, grade validators
lib/validations/student.ts - Student form validation
lib/validations/teacher.ts - Teacher form validation
lib/validations/textbook.ts - Textbook form validation
```

---

## Data Flow Diagrams

### Chat Message Flow
```
User types message
  → ChatInput.onSend(text)
  → ChatView.handleSend(text)
    → [if image] Upload to Convex storage → get storageId
    → Add user message to local state (immediate UI update)
    → Create/touch conversation in Convex
    → Save user message to Convex (with imageId if present)
    → [if image] Convert file to data URL
    → useChatStream.sendMessage(messages, model, textbookContext, imageUrl)
      → POST /api/chat { messages, model, textbookContext, imageUrl }
        → Build system prompt (+ textbook context if reference active)
        → [OpenAI] openai.chat.completions.create (stream: true)
          → [if image] Use GPT-4o with multimodal content array
        → [Gemini] geminiModel.generateContentStream
          → [if image] Fetch image, base64, inlineData
        → Stream chunks via ReadableStream
      → Client reads stream, updates streamingContent
    → Save assistant message to Convex
    → Update local state with final response
```

### Image Upload Flow
```
User clicks Paperclip → file picker opens
  → handleFileSelect validates size (< 10MB)
  → FileReader generates preview data URL
  → Image preview shows above input bar
  → User clicks Send
    → generateUploadUrl() → Convex storage upload URL
    → POST file to upload URL → get storageId
    → Save message with imageId: storageId
    → Convert file to data URL for API
    → API receives imageUrl in request body
    → [OpenAI] content: [{ type: "text", text }, { type: "image_url", image_url: { url } }]
    → [Gemini] parts: [{ text }, { inlineData: { mimeType, data: base64 } }]
```

### Textbook Reference Flow
```
User opens right panel → TextbookPanel shows textbook list
  → Clicks textbook → TextbookDetailPanel shows chapters/topics
  → Clicks "Танд хэрхэн туслах уу?" on a chapter
    → onSetReference({ textbookId, subjectName, grade, chapterTitle, chapterDescription, topics })
    → ChatView sets reference state
    → ReferenceChip appears above input
    → QuickActionButtons show context-aware prompts
  → User sends message
    → buildTextbookContext(reference) generates context string
    → Context injected into system prompt: "Сурагч дараах сурах бичгийн хичээлийг лавлаж байна..."
```

---

## API Routes Reference

### POST /api/chat
```typescript
Request: { messages: ChatMessage[], model: "openai"|"gemini", textbookContext?: string, imageUrl?: string }
Response: ReadableStream (text/plain, streaming LLM response)
Models: GPT-4o-mini (text), GPT-4o (vision), Gemini 2.0 Flash (both)
```

### POST /api/chimege
```typescript
Request: FormData with audio file
Response: { text: string } (transcribed Mongolian text)
```

### POST /api/extract-pdf
```typescript
Request: { textbookId: string, fileUrl: string }
Response: { success: boolean, text: string, toc: Chapter[] }
Side effect: Updates textbook in Convex with extractedText and tableOfContents
```

---

## Translation Keys Structure

Both `messages/mn.json` and `messages/en.json` share the same key structure:

```
common          - appName, defaults
nav             - sidebar navigation labels
auth            - sign-in/up form fields and messages
teachers        - teacher list UI
students        - student list UI
studentForm     - student form fields and validation
teacherForm     - teacher form fields and validation
textbooks       - textbook list, subjects, types
textbookForm    - textbook form validation messages
toc             - table of contents labels
profileSettings - profile edit dialog
helpDialog      - settings tabs (profile, password, security)
chat            - chat UI (greeting, input, models, actions, textbooks, history, image)
```

---

## Known Issues / Tech Debt

1. **Gemini free tier rate limits** - 429 errors when exceeding ~15 RPM on Google AI Studio free tier. Switch to GPT or upgrade plan.
2. **Debug console.log in API route** - `console.log("messagesWithSystem", ...)` and `console.log("contents", ...)` left in `app/api/chat/route.ts`
3. **No error toasts in chat** - Failed API calls only log to console, no user-facing error notification
4. **No retry logic** - Streaming failures don't retry automatically
5. **No message loading state** - When loading conversation history, no skeleton/spinner shown
6. **Image URL resolution** - Uses data URL for API (works but large payload). Could use Convex storage URLs directly.
7. **No image compression** - Large images sent as-is (up to 10MB data URLs to API)
8. **Chat pagination** - All messages loaded at once, no virtualization for long conversations

---

## Next Steps / Roadmap

### Priority 1: Core Learning Features
- **RAG Search** - Use extracted textbook text with embeddings (OpenAI text-embedding-3-small) for context-aware answers. Vector search over textbook content.
- **Quiz/Test Generation** - Auto-generate multiple-choice quizzes from textbook chapters. Save and share quizzes.
- **Lesson Planning** - AI-assisted lesson plan generation for teachers based on textbook content and grade level.

### Priority 2: Audio & Avatar
- **Audio TTS Responses** - AI reads answers aloud using Chimege TTS. Summarize long responses (< 300 chars) before TTS.
- **Mongolian Speaking Avatar** - Duolingo-style animated character that speaks responses. Likely D-ID or similar avatar API.

### Priority 3: Role-Based Experience
- **Custom Roles** - Admin, Teacher, Student, Manager with distinct permissions
- **Role-Based UI** - Different dashboards and navigation per role
- **Grade-Based Content** - Teachers and students see content filtered to their grade level

### Priority 4: Advanced Features
- **Student Analytics Dashboard** - Track usage, questions asked, topics covered, progress over time
- **File Upload & Analysis** - Upload PDF, XLSX, DOCX files for AI analysis (not just images)
- **Level-Based Learning** - Progressive difficulty, unlock topics as students advance
- **Custom Follow-Up Buttons** - Context-aware quick action buttons that change based on conversation state

### Priority 5: Infrastructure
- **Rate Limiting** - Per-user request limits, abuse prevention
- **Security Hardening** - Input sanitization, auth checks on all API routes
- **Caching** - Redis or in-memory cache for repeated queries
- **Error Handling** - Proper error toasts, retry logic, graceful degradation

---

## User Preferences & Instructions

- All UI text in Mongolian by default (Cyrillic characters)
- Use Convex for all backend/storage (no external DB)
- Streaming responses required for chat
- Support both OpenAI and Gemini (switchable in UI)
- Images must persist in chat history (stored in Convex, not ephemeral)
- Simple, clean UI (shadcn/ui components, Tailwind)
- Build must pass (`bun run build`) before any feature is considered done
- Keep the existing file naming conventions
- Don't over-engineer - implement what's requested, nothing more
- Always test with both models when chat changes are made
