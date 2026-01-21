# Axiom Logging Integration Plan

## Overview
Add Axiom for structured logging alongside Sentry for error tracking in AI Tutor V2.

**Axiom** = Structured logs, observability, analytics
**Sentry** = Error tracking, stack traces, performance monitoring

---

## 1. Install Dependencies

```bash
bun add @axiomhq/js @axiomhq/logging @axiomhq/nextjs @axiomhq/react
```

---

## 2. Environment Variables

Add to `.env.local`:
```env
AXIOM_DATASET=ai-tutor-v2
AXIOM_TOKEN=xaat-your-token-here
```

---

## 3. Files to Create

### `lib/logger/types.ts`
- Log level types
- LogContext interface (requestId, userId, userRole, operation)
- LLMLogData, UserActionLogData interfaces

### `lib/logger/constants.ts`
- OPERATIONS enum (CHAT_START, CHAT_MESSAGE, CRUD operations, etc.)
- LOG_LEVELS by environment

### `lib/logger/server.ts`
- createServerLogger() with AxiomJSTransport
- Export withAxiom wrapper for API routes
- Console transport in development

### `lib/logger/client.ts`
- createClientLogger() with ProxyTransport
- Re-export useLogger hook from @axiomhq/react

### `lib/logger/index.ts`
- Re-export all utilities

### `app/api/axiom-proxy/route.ts`
- POST handler to forward client logs to Axiom
- Keeps AXIOM_TOKEN server-side only

### `instrumentation.ts`
- onRequestError for combined Axiom + Sentry error capture

---

## 4. Files to Modify

### `next.config.ts`
```typescript
const nextConfig: NextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};
```

### `app/layout.tsx`
- Import WebVitals from @axiomhq/react
- Add `<WebVitals />` inside html tag

### `lib/utils.ts`
- Add generateRequestId() helper

---

## 5. Usage Patterns

### API Routes
```typescript
import { withAxiom, type AxiomRequest } from "@axiomhq/nextjs";

export const POST = withAxiom(async (req: AxiomRequest) => {
  req.log.info("Chat started", { operation: "chat.start" });
  // ...
});
```

### Server Components
```typescript
const log = createServerLogger({ component: "Dashboard" });
log.info("Page loaded", { userId });
await log.flush();
```

### Client Components
```typescript
const log = useLogger();
log.info("Button clicked", { action: "submit" });
```

### Convex Functions
Create `convex/_utils/logger.ts` with Axiom client for backend logging.

---

## 6. Directory Structure

```
ai-tutor-app/
├── app/
│   ├── api/axiom-proxy/route.ts    # NEW
│   └── layout.tsx                   # MODIFY
├── lib/
│   ├── logger/
│   │   ├── index.ts                 # NEW
│   │   ├── server.ts                # NEW
│   │   ├── client.ts                # NEW
│   │   ├── types.ts                 # NEW
│   │   └── constants.ts             # NEW
│   └── utils.ts                     # MODIFY
├── convex/_utils/logger.ts          # NEW
├── instrumentation.ts               # NEW
├── next.config.ts                   # MODIFY
└── .env.local                       # MODIFY
```

---

## 7. Verification

1. **Install & Config**
   - Run `bun add` commands
   - Add env variables
   - Verify `bun run dev` starts without errors

2. **Web Vitals**
   - Load app in browser
   - Check Axiom dashboard for vitals data

3. **Server Logging**
   - Create test API route with `withAxiom`
   - Make request, verify logs in Axiom

4. **Client Logging**
   - Add `useLogger()` to a component
   - Trigger log, check Axiom via proxy

5. **Error Capture**
   - Throw error in API route
   - Verify both Axiom log AND Sentry capture

---

## Notes

- Sentry setup is separate (already in BUILD.md)
- Axiom token must stay server-side (use proxy for client)
- Flush logs in server components before returning
- Use consistent operation names from constants
