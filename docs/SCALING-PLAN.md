# AI Tutor V2 - Complete Production Architecture

## Executive Summary

- **Target Scale**: 1M total users, 100-200K DAU
- **Cost**: ~$0.03/user/month ($5,500/month at 200K DAU)
- **Ops Burden**: Minimal (fully serverless)
- **Launch**: Fast (government partnership)

---

## Complete Production Tech Stack

### Frontend Layer

| Component            | Technology                  | Purpose                           |
| -------------------- | --------------------------- | --------------------------------- |
| Framework            | **Next.js 15** (App Router) | Server components, API routes     |
| UI Library           | **shadcn/ui** + Tailwind v4 | Consistent, accessible components |
| Internationalization | **next-intl**               | Mongolian/English support         |
| State Management     | **React hooks** + Convex    | Real-time reactive state          |
| Theme                | **next-themes**             | Dark/light mode                   |
| Toast Notifications  | **Sonner**                  | User feedback                     |

### Backend/Database Layer

| Component    | Technology         | Purpose                                          |
| ------------ | ------------------ | ------------------------------------------------ |
| Database     | **Convex**         | Real-time DB, file storage, serverless functions |
| Caching      | **Upstash Redis**  | Rate limiting, response caching                  |
| File Storage | **Convex Storage** | PDFs, images, thumbnails                         |

### Authentication Layer

| Component          | Technology         | Purpose              |
| ------------------ | ------------------ | -------------------- |
| Auth Provider      | **WorkOS AuthKit** | Free up to 1M MAU    |
| Session Management | JWT tokens         | Stateless auth       |
| OAuth              | Google, Facebook   | Social login options |

### AI/ML Layer

| Component      | Technology           | Purpose                        |
| -------------- | -------------------- | ------------------------------ |
| LLM Router     | **OpenRouter**       | Multi-model support, fallbacks |
| Primary LLM    | **Gemini 2.5 Flash** | Text chat, vision (cheap)      |
| Fallback LLM   | **DeepSeek V3**      | If Gemini fails                |
| Speech-to-Text | **Chimege API**      | Mongolian voice input          |
| Text-to-Speech | **Chimege API**      | (Future) Voice responses       |

### Infrastructure Layer

| Component  | Technology                   | Purpose                      |
| ---------- | ---------------------------- | ---------------------------- |
| Hosting    | **Vercel**                   | Edge functions, auto-scaling |
| CDN        | **Vercel Edge Network**      | Global distribution          |
| Domain/DNS | **Vercel** or **Cloudflare** | Fast DNS resolution          |

### Monitoring & Analytics

| Component      | Technology               | Purpose                    |
| -------------- | ------------------------ | -------------------------- |
| Error Tracking | **Sentry**               | Exception monitoring       |
| Analytics      | **PostHog**              | User behavior, usage stats |
| Logs           | **Vercel Logs**          | Request/error logs         |
| Uptime         | **Better Uptime** (free) | Downtime alerts            |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USERS                                       │
│                    (Mobile/Desktop Browser)                              │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         VERCEL EDGE                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                      │
│  │ middleware  │  │  Next.js    │  │  API Routes │                      │
│  │ (rate limit)│  │  App Router │  │  /api/chat  │                      │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                      │
└─────────┼────────────────┼────────────────┼─────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────┐  ┌───────────┐  ┌──────────────────────────────────────┐
│  UPSTASH REDIS  │  │  CONVEX   │  │           AI SERVICES                │
│  ┌───────────┐  │  │  ┌─────┐  │  │  ┌──────────┐  ┌──────────────┐     │
│  │Rate Limit │  │  │  │ DB  │  │  │  │OpenRouter│  │   Chimege    │     │
│  │LLM Cache  │  │  │  │Files│  │  │  │(Gemini)  │  │   (STT)      │     │
│  └───────────┘  │  │  │Auth │  │  │  └──────────┘  └──────────────┘     │
└─────────────────┘  │  └─────┘  │  └──────────────────────────────────────┘
                     └───────────┘
                           │
                           ▼
                     ┌───────────┐
                     │  WORKOS   │
                     │  AuthKit  │
                     └───────────┘
```

---

## Cost Summary by Scale

| DAU  | Monthly Cost | Per User |
| ---- | ------------ | -------- |
| 10K  | $345         | $0.035   |
| 50K  | $1,435       | $0.029   |
| 100K | $2,825       | $0.028   |
| 200K | $5,525       | $0.028   |
| 500K | $13,650      | $0.027   |
| 1M   | $27,150      | $0.027   |

---

## Implementation Priority

### Phase 1: Auth Migration (1-2 days)

1. Set up WorkOS AuthKit
2. Create webhook for user sync to Convex
3. Update middleware for new auth
4. Test auth flow thoroughly

### Phase 2: Caching Layer (2-3 days)

1. Set up Upstash Redis
2. Implement edge rate limiting
3. Add LLM response caching
4. Test rate limiting behavior

### Phase 3: Database Optimization (2-3 days)

1. Batch learning interaction writes
2. Add pagination to analytics queries
3. Optimize topic mastery updates

### Phase 4: LLM Optimization (1-2 days)

1. Switch to Gemini 2.5 Flash everywhere
2. Add fallback chain
3. Implement streaming timeout
4. Test cache hit rates

### Phase 5: Monitoring (1 day)

1. Configure Sentry alerts
2. Set up PostHog dashboards
3. Add uptime monitoring
4. Create runbook for incidents

**Total Estimated Time: 2-3 weeks**

---

## Files to Create/Modify

### New Files

```
lib/upstash.ts              # Redis client
lib/rate-limit.ts           # Edge rate limiting
lib/llm-cache.ts            # Response caching
lib/workos.ts               # WorkOS client
app/api/auth/callback/route.ts  # WorkOS callback
app/api/webhooks/workos/route.ts # User sync
convex/batchLearning.ts     # Batched writes
```

### Modified Files

```
middleware.ts               # Add rate limiting
app/api/chat/route.ts       # Add caching, timeout, fallback
convex/learningInteractions.ts  # Batch writes
convex/usageEvents.ts       # Pagination
convex/users.ts             # WorkOS integration
```

---

## Developer Operations Stack

### All Tools Summary

| Tool             | Purpose           | Cost                |
| ---------------- | ----------------- | ------------------- |
| GitHub           | Code hosting      | Free                |
| GitHub Actions   | CI/CD             | Free                |
| Vercel           | Hosting + Preview | $20/mo              |
| Sentry           | Error tracking    | Free (5K errors/mo) |
| PostHog          | Analytics         | Free (1M events/mo) |
| Better Uptime    | Status monitoring | Free (10 monitors)  |
| CodeRabbit       | AI code review    | Free / $15/mo       |
| SonarCloud       | Code quality      | Free                |
| **Total DevOps** |                   | **$20-35/month**    |

### Security Scanning Tools (All Free)

| Tool                   | Purpose                | When It Runs  |
| ---------------------- | ---------------------- | ------------- |
| Dependabot             | Dependency CVEs        | Weekly        |
| Snyk                   | Deep dependency scan   | Every PR      |
| GitHub Secret Scanning | Exposed secrets        | Every push    |
| Gitleaks               | Pre-commit secrets     | Before commit |
| SonarCloud             | SAST code analysis     | Every PR      |
| Semgrep                | Next.js security rules | Every PR      |
| OWASP ZAP              | API security           | Weekly        |

---

## Deployment Checklist

### Pre-Launch

- [ ] WorkOS configured with production URLs
- [ ] All environment variables set in Vercel
- [ ] Convex deployed to production
- [ ] Upstash Redis provisioned
- [ ] Sentry project created
- [ ] PostHog project configured
- [ ] Domain DNS configured
- [ ] SSL certificate active
- [ ] Enable GitHub Dependabot
- [ ] Enable GitHub Secret Scanning
- [ ] Set up CodeRabbit
- [ ] Set up SonarCloud

### Launch Day

- [ ] Test auth flow end-to-end
- [ ] Test chat with all models
- [ ] Test voice input
- [ ] Test image upload
- [ ] Verify rate limiting works
- [ ] Check error tracking in Sentry
- [ ] Monitor Convex dashboard

### Post-Launch (First 48 Hours)

- [ ] Monitor error rates in Sentry
- [ ] Check usage patterns in PostHog
- [ ] Review LLM costs in OpenRouter
- [ ] Adjust rate limits if needed

---

## Summary

This architecture is designed for:

- ✅ **1M total users** - WorkOS free tier covers it
- ✅ **200K DAU** - Convex + caching handles it
- ✅ **~$5,500/month at scale** - $0.028/user
- ✅ **Minimal ops** - All serverless, auto-scaling
- ✅ **Fast launch** - 2-3 weeks to production-ready
- ✅ **Single developer** - No infrastructure management needed

---

_Full detailed plan available at: `/Users/enkhbayarenkhorkhon/.claude/plans/merry-petting-grove.md`_
