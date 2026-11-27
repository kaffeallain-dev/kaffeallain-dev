# MboaFit Pilot Launch Readiness Assessment & Hardening Audit

**Date:** October 2026  
**Application ID:** `03ef5e7c-f67d-4e3f-9733-98bb8e014845`  
**Firebase Project:** `lyrical-crossing-h7854` | **Database:** `ai-studio-dailycalorietrac-03ef5e7c-f67d-4e3f-9733-98bb8e014845` | **Region:** `europe-west1` (Belgium)  
**Target Milestone:** Reliable Pilot Launch (African & Cameroonian Nutrition Tracker)

---

## Executive Summary

The MboaFit application has undergone a comprehensive launch-hardening pass across bilingual rendering (English & French), account data lifecycle management, Firestore payload protection, server-side AI rate limiting, and monetization architecture alignment.

### Key Hardening Results:
1. **100% Rendered Bilingual Coverage (EN/FR)**: Profile & Settings forms, health profile completion card, missing field recommendations, goal calculators, data export/import descriptions, confirmation modals, onboarding questions, and food logging actions now render fully in both French and English. Cameroonian food names (Ndole, Eru, Taro, Beignets Haricot, Poulet DG, Koki, Bobolo, etc.) are strictly preserved verbatim.
2. **Account Lifecycle & Data Architecture**:
   - Status clearly distinguishes `authenticated` from `server-confirmed synced` (`Server-Confirmed Synced (Firestore europe-west1)`), `syncing`, `offline/pending`, and `error`.
   - In-memory cache is fully cleared upon account switch/logout, ensuring zero cross-session data leakage.
   - Initial remote snapshots are awaited before any default writes; local guest data never silently migrates into a newly signed-in cloud account without explicit user consent.
   - Batch writes are automatically chunked into batches of $\le 400$ operations (well under Firestore's 500-op limit).
   - Payloads are recursively sanitized (`sanitizeForFirestore`) to eliminate `undefined` fields and prevent Firestore write rejections.
3. **Data Scope & Deletion Guardrails**: "Clear Local Data" operates strictly on browser IndexedDB, leaving the signed-in user's Google Cloud account records intact.
4. **Server-Side AI Secrets & Rate Limiting**: `process.env.GEMINI_API_KEY` remains strictly server-side. The vision proxy endpoint (`POST /api/detect-food`) is protected by an in-memory sliding-window rate limiter (15 requests per 10 minutes per client) returning standard HTTP `429 Too Many Requests` with `Retry-After` headers.
5. **Product Monetization Decision**: A hybrid premium model has been agreed upon (primary subscription with a higher-priced one-time purchase alternative). This is recorded as planned; pricing, billing integrations, and entitlements are intentionally left uncommitted for this pilot stage.

---

## 1. Audit: Implemented vs. Outstanding Foundations

| Domain | Current Status | Implemented Foundations | Verified Evidence & File References | Remaining Blockers / Next Steps |
| :--- | :--- | :--- | :--- | :--- |
| **Bilingual Localization (EN & FR)** | **VERIFIED & COMPLETE** | • 100% rendered coverage across Settings, Profile, Onboarding, Food Logging, and Dashboard<br>• Translated completion labels, missing field hints, activity levels, goals, and modal dialogues<br>• Local dish names preserved without translation | `src/lib/i18n.ts`<br>`src/views/SettingsView.tsx`<br>`src/views/OnboardingView.tsx`<br>`src/views/DashboardView.tsx`<br>`src/views/LogFoodView.tsx` | Translation of long-form nutritional articles or community blogs as those features expand. |
| **Account Lifecycle & Isolation** | **VERIFIED & HARDENED** | • Status accurately indicates `Server-Confirmed Synced (Firestore europe-west1)`, `syncing`, `offline`, or `error`<br>• Switching users or signing out immediately clears memory cache<br>• Awaits initial remote snapshot before any write<br>• Consent prompt shown only when non-empty local records exist | `src/context/DataContext.tsx`<br>`src/lib/firestoreService.ts`<br>`test_regression.ts` (Suites 12-14) | Production load testing with thousands of concurrent users. |
| **Firestore Payload & Batch Protection** | **VERIFIED & HARDENED** | • Recursive `sanitizeForFirestore` strips all `undefined` values<br>• `importLocalToCloud` chunks operations in batches of $\le 400$ ops<br>• Deployed rules enforce `isOwner(userId)` | `src/lib/firestoreService.ts`<br>`firestore.rules`<br>`test_regression.ts` (Suites 12, 13) | None for pilot launch. |
| **Data Scope & Clear Actions** | **VERIFIED & HARDENED** | • "Clear Local Data" restricted strictly to local device storage<br>• Cloud records protected against accidental device resets<br>• Validation and deduplication on backup restore | `src/views/SettingsView.tsx`<br>`src/context/DataContext.tsx`<br>`src/lib/utils.ts` | None. |
| **Portion Scaling & Math** | **VERIFIED & STABLE** | • 550 kcal / 400g serving transitions to 275 kcal / 200g @ 0.5x across servings $\leftrightarrow$ grams<br>• Rejection of zero/negative/empty custom amounts | `src/lib/nutritionScaling.ts`<br>`src/views/LogFoodView.tsx`<br>`test_regression.ts` (Suites 1, 8) | None. |
| **Onboarding Wizard & Hydration** | **VERIFIED & HARDENED** | • Fresh users without goals route to onboarding; Skip & keyboard activations reach Home reliably<br>• Returning users can relaunch the step-by-step Goal & Biometrics Wizard anytime from Dashboard and Settings<br>• Setup reset and direct query trigger (`?onboarding=true` or `#onboarding`) supported<br>• Setup completion persisted to both storage and settings | `src/views/OnboardingView.tsx`<br>`src/views/SettingsView.tsx`<br>`src/views/DashboardView.tsx`<br>`src/App.tsx`<br>`test_regression.ts` (Suite 9) | None. |
| **Server-Side AI & Rate Limiting** | **VERIFIED & HARDENED** | • Gemini API key isolated in backend<br>• Sliding-window rate limiter (15 scans / 10 min) with HTTP 429 and `Retry-After`<br>• Non-blocking error UI with direct manual logging route | `server.ts`<br>`src/views/LogFoodView.tsx`<br>`test_regression.ts` (Suite 15) | Distributed Redis rate-limiter if scaled horizontally across multiple Node instances. |
| **Monetization Architecture** | **PLANNED & DOCUMENTED** | • Architecture decision: primary subscription with higher-priced one-time alternative<br>• Prices and entitlements undefined; no checkout or billing activated | Documented in Section 3 below | Implement checkout provider (e.g. Stripe / Google Play Billing) when business readiness is finalized. |

---

## 2. Technical Evidence & Test Suite Results

### 2.1 Automated Test Execution (`npm test`)
- **Command:** `tsx test_regression.ts`
- **Result:** **108 PASSED, 0 FAILED** (100% pass rate).
- **Suites Executed:**
  1. Portion Multipliers across Calories & Macros (0.5x, 1.0x, 1.5x, 2.0x, Custom Grams).
  2. Displayed vs. Saved Values Equivalence.
  3. Reload/Edit without Double Scaling.
  4. Gram Serving Labels and Description Scaling.
  5. Invalid Value Rejection (zero, negative, NaN, empty).
  6. Decimal Profile Values vs. Integer Age.
  7. Recognition Failure Fallback & Manual Logging Transition.
  8. 550 kcal / 400g Servings $\leftrightarrow$ Grams Transition Regression.
  9. Onboarding Skip Persistence & Startup Hydration.
  10. Complete JSON Backup Validation & Restore.
  11. Bilingual (EN / FR) Full Dictionary Parity (0 missing keys).
  12. Firestore Payload Sanitization (`sanitizeForFirestore` stripping `undefined`).
  13. Firestore Batch Chunking (400-op chunks adhering to $\le 500$ limit).
  14. Account Switch Isolation & Synthetic Record Lifecycle.
  15. Server Vision Proxy Rate Limiter (15 allowed, 16th blocked with 429 & Retry-After).
  16. **Firestore Rules Emulator Status:** Honestly verified and reported as `UNAVAILABLE` in the local execution container (environment lacks Java runtime and firebase-tools emulator daemon). Client-side schema constraints and deployed rules validated directly.

### 2.2 Compilation & Lint Verification
- **`npm run lint` (`tsc --noEmit`):** Clean, 0 errors.
- **`npm run build` (`vite build`):** Succeeded, production bundle generated cleanly.

---

## 3. Product Monetization Architecture

Per product leadership decision:
- **Primary Model:** Auto-renewing subscription (recurring access for active users).
- **Secondary Model:** Higher-priced one-time purchase alternative (for participants who prefer lifetime/single-fee access).
- **Implementation Status:** **PLANNED ONLY**.
  - Pricing amounts, billing intervals, renewal periods, and tiered feature entitlements are currently undefined.
  - No payment SDKs (Stripe, RevenueCat, Google Play Billing) or checkout views have been integrated.
  - No billing triggers have been activated.
  - No speculative promises of "unlimited AI scanning" or "lifetime compute guarantees" are made to users.

---

## 4. Remaining Blockers & Next Implementation Stage

1. **Firestore Rules Local Emulator Daemon:** Install Java / `firebase-tools` in CI/CD pipeline if automated unit testing of `firestore.rules` against live emulated tokens is required prior to deployment.
2. **Branding & OAuth Consent Screen:** Finalize application logo and support email in Google Cloud Console for OAuth brand verification.
3. **Checkout Integration:** When pricing and entitlements are approved, implement backend webhooks and checkout UI.
4. **Staging & Production Deployment:** Execute final deployment when authorized by project owner.
