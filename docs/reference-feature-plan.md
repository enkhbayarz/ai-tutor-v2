# Textbook Reference Context Feature

## Overview
When a user clicks "Танд хэрхэн туслах уу?" inside a chapter in the textbook detail panel, it pins that chapter as a reference. A reference chip appears above the input, and quick action buttons compose prompts using that reference context. The LLM receives the full textbook/chapter/topics context in its system prompt.

---

## Step 1: Define `TextbookReference` Type

Create a shared type (in `components/chat/chat-view.tsx`):

```typescript
export interface TextbookReference {
  textbookId: Id<"textbooks">;
  subjectName: string;
  grade: number;
  chapterTitle: string;      // "Бүлэг 1"
  chapterDescription: string; // "Бүхэл тоон олонлог"
  topics: string[];           // ["Бүхэл тоон олонлогийн ойлголт", ...]
}
```

---

## Step 2: Update `textbook-detail-panel.tsx`

**Changes**:
- Add prop: `onSetReference: (ref: TextbookReference) => void`
- The "Танд хэрхэн туслах уу?" button in each chapter (not just the first) calls `onSetReference` with the chapter data
- On click: build a `TextbookReference` from the textbook + clicked chapter, call `onSetReference(ref)`

```tsx
// Inside each chapter's AccordionContent:
<button
  onClick={() => onSetReference({
    textbookId,
    subjectName: textbook.subjectName,
    grade: textbook.grade,
    chapterTitle: chapter.title,
    chapterDescription: chapter.description,
    topics: chapter.topics.sort((a, b) => a.order - b.order).map(t => t.title),
  })}
  className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 w-full"
>
  <Image src="/logo_ai.png" alt="AI" width={20} height={20} />
  <span className="text-xs font-medium text-blue-700">{t("howCanIHelp")}</span>
</button>
```

Move the "howCanIHelp" button to ALL chapters (remove the `chapterIndex === 0` condition).

---

## Step 3: Create `components/chat/reference-chip.tsx` (new)

A compact chip displayed above the input showing the active reference.

**Props**:
```typescript
interface ReferenceChipProps {
  reference: TextbookReference;
  onRemove: () => void;
}
```

**Layout** (matches the Cursor-style chip from image #45):
- Small rounded pill with: BookOpen icon + "subjectName grade - chapterTitle: chapterDescription" + X button
- Background: `bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5`
- Text truncated if too long
- X button to dismiss

Example chip text: `📖 mongolian 7 - Бүлэг 1: Бүхэл тоон олонлог`

---

## Step 4: Update `components/chat/quick-action-buttons.tsx`

**Changes**:
- Add optional `reference` prop: `reference?: TextbookReference | null`
- When a chip is clicked AND a reference exists, compose a richer prompt:
  - `"${t(actionKey)} - ${reference.subjectName} ${reference.grade}, ${reference.chapterDescription}"`
  - Example: `"Тест бэлдээд өгөөч - mongolian 7, Бүхэл тоон олонлог"`
- If no reference, just fill with the action text as before

---

## Step 5: Update `hooks/use-chat-stream.ts`

**Changes**:
- Accept optional `textbookContext` parameter in `sendMessage`:
  ```typescript
  sendMessage(messages: ChatMessage[], model: ModelType, textbookContext?: string)
  ```
- Pass it in the request body:
  ```typescript
  body: JSON.stringify({ messages, model, textbookContext })
  ```

---

## Step 6: Update `app/api/chat/route.ts`

**Changes**:
- Extend `ChatRequest` interface:
  ```typescript
  interface ChatRequest {
    messages: ChatMessage[];
    model: "openai" | "gemini";
    textbookContext?: string;  // NEW
  }
  ```
- Build dynamic system prompt:
  ```typescript
  const systemPrompt = textbookContext
    ? `${SYSTEM_PROMPT}\n\nСурагч дараах сурах бичгийн хичээлийг лавлаж байна:\n${textbookContext}\n\nЭнэ хичээлийн контекстод тохируулан хариулаарай.`
    : SYSTEM_PROMPT;
  ```
- Use `systemPrompt` instead of `SYSTEM_PROMPT` when building messages

---

## Step 7: Update `components/chat/right-panel.tsx`

**Changes**:
- Add prop: `onSetReference: (ref: TextbookReference) => void`
- Pass `onSetReference` to `<TextbookDetailPanel>`

---

## Step 8: Update `components/chat/chat-view.tsx`

**New state**:
```typescript
const [reference, setReference] = useState<TextbookReference | null>(null);
```

**Build context string helper** (in the component or a util):
```typescript
function buildTextbookContext(ref: TextbookReference): string {
  const topicsList = ref.topics.map((t, i) => `${i + 1}. ${t}`).join("\n");
  return `Сурах бичиг: ${ref.subjectName}, ${ref.grade}-р анги\nБүлэг: ${ref.chapterTitle} - ${ref.chapterDescription}\nСэдвүүд:\n${topicsList}`;
}
```

**handleSend** changes:
- Build textbookContext from reference if it exists
- Pass to `sendMessage`:
  ```typescript
  const textbookContext = reference ? buildTextbookContext(reference) : undefined;
  const assistantContent = await sendMessage(apiMessages, model, textbookContext);
  ```

**Render changes**:
- Show `<ReferenceChip>` between QuickActionButtons and ChatInput (in both welcome and messages views)
- Pass `reference` to `<QuickActionButtons>` so it can compose richer prompts
- Pass `onSetReference={setReference}` to `<RightPanel>`
- QuickActionButtons show when `reference` exists (replace `selectedTextbookId` condition with `reference`)

---

## Step 9: Translation Keys

Add to `messages/mn.json` and `messages/en.json` in `"chat"`:

```json
// mn.json
"referencing": "Лавлаж байна"

// en.json
"referencing": "Referencing"
```

---

## Data Flow

1. User views textbook detail → sees chapters with "Танд хэрхэн туслах уу?" in each
2. User clicks the button in a chapter → `onSetReference(ref)` fires
3. `reference` state set in ChatView → ReferenceChip appears above input + QuickActionButtons appear
4. User clicks quick action chip → composes prompt like "Тест бэлдээд өгөөч - mongolian 7, Бүхэл тоон олонлог" → fills input
5. User presses send → `handleSend` builds textbookContext string → passed to API
6. API receives textbookContext → injects into system prompt
7. LLM responds with knowledge of the textbook/chapter/topics context
8. User can dismiss reference with X on the chip → `setReference(null)` → quick actions hide

---

## Files Modified
- `components/chat/textbook-detail-panel.tsx` - add `onSetReference` prop, move button to all chapters
- `components/chat/reference-chip.tsx` - new file
- `components/chat/quick-action-buttons.tsx` - accept `reference` prop, compose richer prompts
- `components/chat/right-panel.tsx` - pass `onSetReference` through
- `components/chat/chat-view.tsx` - add reference state, show chip, pass context to API
- `hooks/use-chat-stream.ts` - accept `textbookContext` param
- `app/api/chat/route.ts` - accept `textbookContext`, dynamic system prompt
- `messages/mn.json` + `messages/en.json` - new key

---

## Verification
1. `bun run build` → no TypeScript errors
2. Open textbook detail → click "Танд хэрхэн туслах уу?" in a chapter
3. Reference chip appears above input: "📖 mongolian 7 - Бүлэг 1: Бүхэл тоон олонлог"
4. Quick action buttons appear
5. Click "Тест бэлдээд өгөөч" → input fills with "Тест бэлдээд өгөөч - mongolian 7, Бүхэл тоон олонлог"
6. Send → LLM responds with a test based on the chapter's topics
7. Click X on chip → reference dismissed, quick actions hide
8. Click different chapter's button → replaces previous reference
