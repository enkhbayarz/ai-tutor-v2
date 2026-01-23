import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Chat messages: 10 per minute per user
  sendMessage: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 10 },
  // File uploads: 5 per minute per user
  fileUpload: { kind: "token bucket", rate: 5, period: MINUTE, capacity: 5 },
  // PDF extraction: 2 per hour per user
  pdfExtraction: { kind: "fixed window", rate: 2, period: HOUR },
  // STT requests: 10 per minute per user
  sttRequest: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 10 },
});
