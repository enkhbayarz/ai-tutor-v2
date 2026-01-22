# Orphaned Files Cleanup - Storage Leak Fix

## Problem

When users upload files on `/textbook/new` but don't submit:
1. Close browser tab → sessionStorage cleared, but files remain in Convex storage
2. Navigate away without submitting → files orphaned if draft is later cleared
3. Over time, storage fills with unused files

---

## Solution: Pending Uploads Tracking + Scheduled Cleanup

Track pending uploads in a database table. A scheduled job cleans up old unlinked files.

---

## Implementation

### Step 1: Add Pending Uploads Table

**File**: `convex/schema.ts`

```typescript
pendingUploads: defineTable({
  storageId: v.id("_storage"),
  uploadedAt: v.number(),
  sessionId: v.string(), // Browser session identifier
})
  .index("by_session", ["sessionId"])
  .index("by_uploaded_at", ["uploadedAt"]),
```

### Step 2: Track Uploads

**File**: `convex/textbooks.ts`

```typescript
// When file is uploaded, track it as pending
export const trackPendingUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("pendingUploads", {
      storageId: args.storageId,
      sessionId: args.sessionId,
      uploadedAt: Date.now(),
    });
  },
});

// When textbook is created, remove from pending
export const clearPendingUpload = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("pendingUploads")
      .filter((q) => q.eq(q.field("storageId"), args.storageId))
      .first();
    if (pending) {
      await ctx.db.delete(pending._id);
    }
  },
});
```

### Step 3: Scheduled Cleanup Job

**File**: `convex/crons.ts`

```typescript
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run every hour
crons.hourly(
  "cleanup orphaned uploads",
  { minuteUTC: 0 },
  internal.cleanup.cleanupOrphanedUploads
);

export default crons;
```

**File**: `convex/cleanup.ts`

```typescript
import { internalMutation } from "./_generated/server";

// Delete pending uploads older than 24 hours
export const cleanupOrphanedUploads = internalMutation({
  handler: async (ctx) => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    const oldPendingUploads = await ctx.db
      .query("pendingUploads")
      .withIndex("by_uploaded_at", (q) => q.lt("uploadedAt", oneDayAgo))
      .collect();

    for (const pending of oldPendingUploads) {
      // Delete file from storage
      await ctx.storage.delete(pending.storageId);
      // Remove tracking record
      await ctx.db.delete(pending._id);
    }

    return { deleted: oldPendingUploads.length };
  },
});
```

### Step 4: Update FileUpload Component

**File**: `components/textbook/file-upload.tsx`

After successful upload, track as pending:
```typescript
// After getting storageId from upload
await trackPendingUpload({ storageId, sessionId: getSessionId() });
onUpload(storageId, file.name, imagePreviewUrl);
```

### Step 5: Session ID Helper

**File**: `lib/session.ts`

```typescript
export function getSessionId(): string {
  let sessionId = sessionStorage.getItem("upload-session-id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("upload-session-id", sessionId);
  }
  return sessionId;
}
```

### Step 6: Clear Pending on Textbook Create

**File**: `convex/textbooks.ts` (update create mutation)

```typescript
export const create = mutation({
  // ... existing args
  handler: async (ctx, args) => {
    // Create textbook
    const id = await ctx.db.insert("textbooks", { ... });

    // Clear pending status for these files
    await clearPendingUploadInternal(ctx, args.pdfFileId);
    await clearPendingUploadInternal(ctx, args.thumbnailId);

    return id;
  },
});
```

---

## Files to Modify

| File | Change |
|------|--------|
| `convex/schema.ts` | Add `pendingUploads` table |
| `convex/textbooks.ts` | Add tracking mutations, update create |
| `convex/cleanup.ts` | NEW - Cleanup logic |
| `convex/crons.ts` | NEW - Scheduled job |
| `lib/session.ts` | NEW - Session ID helper |
| `components/textbook/file-upload.tsx` | Track uploads as pending |

---

## How It Works

```
Upload Flow:
1. User uploads file → stored in Convex
2. File tracked in pendingUploads table with timestamp
3. User submits form → textbook created, files removed from pending
4. Files are now "linked" (not orphaned)

Cleanup Flow:
1. Cron job runs every hour
2. Finds pendingUploads older than 24 hours
3. Deletes files from storage
4. Removes tracking records

Edge Cases:
- User closes tab → files stay pending → cleaned up after 24h
- User removes file manually → file deleted immediately (existing behavior)
- User submits → files removed from pending → never cleaned up
```

---

## Verification

1. `bunx convex dev` - deploy schema and functions
2. Upload files on `/textbook/new`
3. Close browser tab without submitting
4. Check Convex dashboard → files in storage, records in pendingUploads
5. Wait for cron (or trigger manually) → orphaned files deleted
6. Verify storage is cleaned up

---

## Alternative: Simpler Approach (No Cron)

If you don't want scheduled jobs, a simpler approach:

1. On `/textbook/new` page load, check for old pending uploads for current session
2. Delete them immediately
3. Less robust but no cron needed

```typescript
// On page mount
useEffect(() => {
  cleanupOldSessionUploads({ sessionId: getSessionId() });
}, []);
```

This cleans up when user returns to the page, not automatically.
