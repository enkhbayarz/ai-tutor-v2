# CodeRabbit Review - Issues to Fix

> Review Date: 2026-02-02
> Compared: `main` vs `origin/main` (13 unpushed commits)

---

## Critical Issues

### 1. Race Condition - Shared ConvexHttpClient

**Files:**
- `app/api/teachers/create-with-clerk/route.ts` (lines 11-14)
- `app/api/students/create-with-clerk/route.ts` (lines 11-14)

**Problem:** The `ConvexHttpClient` is instantiated at module level, but `setAuth()` is called per-request. In concurrent requests, one request's auth token could be overwritten by another before the queries execute.

**Fix:** Instantiate client per request instead of module level.

```typescript
// BEFORE (module level - BAD)
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  // ...
  convex.setAuth(token); // Race condition!
}

// AFTER (per-request - GOOD)
export async function POST(request: Request) {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(token); // Safe - each request has its own instance
  // ...
}
```

---

### 2. Convex Mutation Without Auth Token

**File:** `app/api/chat-v2/route.ts` (lines 69-77)

**Problem:** The route calls `ensureExternalUserId` mutation without setting auth. Falls back to `DEFAULT_USER_ID` which could silently create issues.

**Fix:** Add auth token before mutation.

```typescript
// Add this before the mutation call
const { getToken } = await auth();
const convexToken = await getToken({ template: "convex" });
if (convexToken) {
  convex.setAuth(convexToken);
}

// Then call the mutation
const convexUser = await convex.mutation(api.users.ensureExternalUserId, {
  clerkId: clerkUserId,
});
```

---

### 3. Bug - onComplete Callback Never Fires

**File:** `components/teacher/bulk-import-dialog.tsx` (lines 114-120)

**Problem:** `handleClose` checks `step` and `summary.success` AFTER calling `resetState()`, which resets them. Condition always false.

**Fix:** Capture state before reset.

```typescript
// BEFORE (BUG)
const handleClose = useCallback(() => {
  resetState();
  onOpenChange(false);
  if (step === "results" && summary.success > 0) { // Always false!
    onComplete?.();
  }
}, [resetState, onOpenChange, step, summary.success, onComplete]);

// AFTER (FIXED)
const handleClose = useCallback(() => {
  const wasResults = step === "results";
  const hadSuccess = summary.success > 0;
  resetState();
  onOpenChange(false);
  if (wasResults && hadSuccess) {
    onComplete?.();
  }
}, [resetState, onOpenChange, step, summary.success, onComplete]);
```

---

### 4. Missing Environment Variable Validation

**File:** `app/api/chat-v2/route.ts` (lines 16-17)

**Problem:** Non-null assertion on `NEXT_PUBLIC_CONVEX_URL` will throw a cryptic error if missing.

**Fix:** Add validation.

```typescript
// BEFORE
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// AFTER
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
}
const convex = new ConvexHttpClient(CONVEX_URL);
```

---

## Medium Priority Issues

### 5. Clerk Pagination Limit (500 users max)

**Files:**
- `app/api/teachers/create-with-clerk/route.ts` (lines 77-82)
- `app/api/students/create-with-clerk/route.ts` (lines 79-84)
- `app/api/teachers/bulk-import/route.ts` (lines 151-156)

**Problem:** With `limit: 500`, if there are more than 500 Clerk users, some usernames won't be checked for duplicates.

**Fix:** Paginate through all users.

```typescript
// BEFORE
const clerkUsers = await clerkClient.users.getUserList({ limit: 500 });
for (const user of clerkUsers.data) {
  if (user.username) {
    usernameSet.add(user.username);
  }
}

// AFTER
let offset = 0;
const pageSize = 500;
while (true) {
  const clerkUsers = await clerkClient.users.getUserList({
    limit: pageSize,
    offset
  });
  for (const user of clerkUsers.data) {
    if (user.username) {
      usernameSet.add(user.username);
    }
  }
  if (clerkUsers.data.length < pageSize) break;
  offset += pageSize;
}
```

---

### 6. Partial Rollback - Orphaned Teacher Record

**File:** `app/api/teachers/bulk-import/route.ts` (lines 64-70)

**Problem:** If `api.teachers.createWithClerk` succeeds but `api.users.createFromAdmin` fails, the teacher record is orphaned (not rolled back).

**Fix:** Add teacher deletion to rollback.

```typescript
let clerkUserId: string | null = null;
let teacherId: string | null = null;

try {
  // ... Clerk user creation ...
  clerkUserId = clerkUser.id;

  const createdTeacher = await convex.mutation(api.teachers.createWithClerk, {
    // ...
  });
  teacherId = createdTeacher; // Capture the ID

  await convex.mutation(api.users.createFromAdmin, {
    // ...
  });
} catch (error) {
  // Rollback Clerk user
  if (clerkUserId) {
    try {
      await clerkClient.users.deleteUser(clerkUserId);
    } catch (rollbackError) {
      console.error("Rollback failed - orphaned Clerk user:", clerkUserId);
    }
  }
  // Rollback teacher record
  if (teacherId) {
    try {
      await convex.mutation(api.teachers.softDelete, { id: teacherId });
    } catch (rollbackError) {
      console.error("Rollback failed - orphaned teacher record:", teacherId);
    }
  }
  throw error;
}
```

---

### 7. Missing Fetch Error Handling

**File:** `app/[locale]/(dashboard)/teacher-info/page.tsx` (lines 149-175)

**Problem:** `handleAddSubmit` assumes fetch succeeds. Network errors or non-JSON responses will throw unhandled exceptions.

**Fix:** Add proper error handling.

```typescript
const handleAddSubmit = async (data: PersonFormData) => {
  let result;
  try {
    const response = await fetch("/api/teachers/create-with-clerk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lastName: data.lastName.trim(),
        firstName: data.firstName.trim(),
        phone1: data.phone1.trim(),
        phone2: data.phone2?.trim() || undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: Failed to create teacher`);
    }

    result = await response.json();
  } catch (error) {
    throw error instanceof Error ? error : new Error("Failed to create teacher");
  }

  if (!result.success) {
    throw new Error(result.error || "Failed to create teacher");
  }

  // Continue with success handling...
};
```

---

### 8. Base64 Conversion Error Not Handled

**File:** `components/chat/chat-view.tsx` (lines 122-124)

**Problem:** If `fileToBase64` rejects, the generic error message won't help users understand what went wrong.

**Fix:** Add specific error handling.

```typescript
if (currentImage) {
  try {
    imageBase64 = await fileToBase64(currentImage);
  } catch (imgError) {
    console.error("Failed to process image:", imgError);
    // Show user-friendly error
    toast.error("Failed to process image. Please try a different file.");
    return;
  }

  const uploadUrl = await generateUploadUrl();
  // ...
}
```

---

### 9. Memory Leak - setTimeout Not Cleaned Up

**File:** `components/student/student-credentials-dialog.tsx` (lines 38-51)

**Problem:** If component unmounts before the 2-second timeout completes, it will try to update state on unmounted component.

**Fix:** Use refs for cleanup.

```typescript
import { useState, useRef, useEffect } from "react";

export function StudentCredentialsDialog({ ... }) {
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const timeoutRefs = useRef<{ username?: NodeJS.Timeout; password?: NodeJS.Timeout }>({});

  useEffect(() => {
    return () => {
      if (timeoutRefs.current.username) clearTimeout(timeoutRefs.current.username);
      if (timeoutRefs.current.password) clearTimeout(timeoutRefs.current.password);
    };
  }, []);

  const copyToClipboard = async (text: string, type: "username" | "password") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "username") {
        setCopiedUsername(true);
        if (timeoutRefs.current.username) clearTimeout(timeoutRefs.current.username);
        timeoutRefs.current.username = setTimeout(() => setCopiedUsername(false), 2000);
      } else {
        setCopiedPassword(true);
        if (timeoutRefs.current.password) clearTimeout(timeoutRefs.current.password);
        timeoutRefs.current.password = setTimeout(() => setCopiedPassword(false), 2000);
      }
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };
  // ...
}
```

---

### 10. JSON Parse Error Not Handled

**File:** `app/api/extract-pdf/route.ts` (lines 56-94)

**Problem:** If LLM returns malformed JSON, `JSON.parse(content)` will throw.

**Fix:** Add try-catch around JSON parse.

```typescript
const content = result.response.text() || '{"chapters":[]}';
let parsed: { chapters?: Array<{ title: string; topics: { title: string }[] }> };
try {
  parsed = JSON.parse(content);
} catch (e) {
  console.error("Failed to parse LLM response:", content);
  parsed = { chapters: [] };
}
```

---

## Low Priority Issues

### 11. Audio Buffer Padding May Break STT

**File:** `app/[locale]/chat-avatar/page.tsx` (lines 220-227)

**Problem:** Padding small audio buffers with zeros may produce invalid audio data.

**Fix:** Discard recordings that are too short instead of padding.

```typescript
let buffer = await blob.arrayBuffer();

const minSize = 5120;
if (buffer.byteLength < minSize) {
  console.warn("Recording too short, discarding");
  playIdle();
  return;
}

// Continue with STT...
```

---

### 12. Autoplay Rejection Handling

**File:** `app/[locale]/chat-avatar/page.tsx` (lines 296-303)

**Problem:** `audioRef.current.play()` can throw if autoplay is blocked. Current catch doesn't distinguish autoplay failures.

**Fix:** Add specific handling for autoplay errors.

```typescript
if (audioRef.current) {
  audioRef.current.src = url;
  audioRef.current.onended = () => {
    playIdle();
    URL.revokeObjectURL(url);
  };
  try {
    await audioRef.current.play();
  } catch (playError) {
    console.warn("Autoplay blocked:", playError);
    URL.revokeObjectURL(url);
    playIdle();
  }
}
```

---

### 13. AudioContext Leak on Error

**File:** `app/[locale]/chat-avatar/page.tsx` (lines 125-200)

**Problem:** If error occurs after creating AudioContext but before setup completes, resources won't be cleaned up.

**Fix:** Move declarations outside try block and add cleanup in catch.

```typescript
const startRecording = async () => {
  let audioCtx: AudioContext | null = null;
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    silenceStartRef.current = null;
    hasSpokenRef.current = false;
    setHasSpoken(false);

    audioCtx = new AudioContext();
    audioContextRef.current = audioCtx;
    // ... rest of setup
  } catch (error) {
    console.error("Recording error:", error);
    // Cleanup on error
    audioCtx?.close();
    stream?.getTracks().forEach((t) => t.stop());
    alert("Микрофон руу хандах боломжгүй");
  }
};
```

---

### 14. Event Handler Type Casts

**File:** `app/[locale]/chat-avatar/page.tsx` (lines 88-93)

**Problem:** `onLoop` and `onStop` handlers use `as never` casts instead of proper event parameter types.

**Fix:** Accept event parameter properly.

```typescript
const onLoop = (_event: Event) => {
  // handler body
};
const onStop = (_event: Event) => {
  // handler body
};

rive.on(EventType.Loop, onLoop);
rive.on(EventType.Stop, onStop);
```

---

### 15. QStash Callback Null Check

**File:** `concurant_users.md` (lines 267-307)

**Problem:** If `redis.get` returns null for a job, `JSON.parse(null)` will throw.

**Fix:** Add null check before parsing.

```typescript
} else if (status === "complete") {
  await markStreamComplete(sessionId);

  const existingJob = await redis.get(`chat:job:${jobId}`);
  if (existingJob) {
    await redis.set(`chat:job:${jobId}`, JSON.stringify({
      ...JSON.parse(existingJob as string),
      status: "completed"
    }));
  }
}
```

---

## Documentation Issues

### 16. Filename Typo

**File:** `concurent_users_v2.md`

**Fix:** Rename to `concurrent_users_v2.md`

---

### 17. Outdated Trigger.dev Pricing

**File:** `concurant_users.md` (lines 53-61)

**Problem:** Estimate of ~$30k/mo is drastically outdated. Current pricing is ~$2.50 per 100k runs + compute.

**Fix:** Update the cost table to reflect Feb 2026 pricing.

---

## Checklist

- [ ] Fix race condition in `create-with-clerk` routes (teachers & students)
- [ ] Add auth token to chat-v2 route
- [ ] Fix `onComplete` callback bug in bulk-import-dialog
- [ ] Add env var validation to chat-v2 route
- [ ] Add Clerk pagination to all routes
- [ ] Add teacher rollback to bulk-import route
- [ ] Add fetch error handling to teacher-info page
- [ ] Add base64 error handling to chat-view
- [ ] Fix memory leak in student-credentials-dialog
- [ ] Add JSON parse safety to extract-pdf route
- [ ] Fix audio buffer padding in chat-avatar
- [ ] Add autoplay error handling in chat-avatar
- [ ] Fix AudioContext leak in chat-avatar
- [ ] Fix event handler types in chat-avatar
- [ ] Add null check to QStash callback (docs)
- [ ] Rename `concurent_users_v2.md` to `concurrent_users_v2.md`
- [ ] Update Trigger.dev pricing in docs
