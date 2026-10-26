# MboaFit project state � 26 October 2026

## Authoritative source and preservation

Recovered 88 current source/config/test files directly from the existing AI Studio editor after its ZIP export failed and its agent returned permission denied twice. Checksum-verified before editing. Original snapshot ZIP and hash manifest are in the Codex workspace outputs. The original AI Studio project and public deployment have not been overwritten. This branch is the release work candidate; main remains unchanged.

## Implemented in this branch

- Existing Cameroon catalogue, core UI, manual-food validation, owner-scoped IndexedDB and sync controller preserved.
- Remaining Recently Logged label translated; bilingual privacy/account controls and external `/privacy` and `/delete-account` routes added. Support/privacy email approved by owner: kaffeallain@gmail.com. Privacy text is a beta draft; provider data terms and production settings still need confirmation.
- Billable API now requires verified Firebase ID tokens; ignores arbitrary client user IDs and bearer-prefix/IP-based quota identities. Strict image/result validation, size limits and bounded provider timeout. Durable transactional per-user/global daily limits plus idempotency. Conservative provisional defaults 5 attempts/user/day and 50/day globally. Cloud scanning off until explicitly configured.
- Recent-authenticated, explicitly confirmed account deletion backend; recursive active data cleanup, partial-failure retry and late-response protection. Account deletion off until Admin permissions and deletion-barrier Firestore rules are deployed and live-tested. Tests never deleted a real account.
- Client and server outputs separated into `dist/web` and `dist/server`, preventing server files/source maps from being served as public assets.
- Capacitor Android 8 project generated. Provisional internal app ID `dev.kaffeallain.mboafit.beta`, version 0.1.0-beta. Android backup and cleartext networking disabled; no broad media permissions. Simple green/cream M mark. Guest/manual logging is the current Android scope; Google native sign-in requires registration/configuration before enabling. Scan action explains this and offers manual entry.
- No fake local TFLite-loaded claim and no random portion fluctuation; heuristic estimates remain approximate and require review.
- Dependency updates stay within the existing major stack. Targeted gRPC 1.14.6 override fixes the old Firebase Node dependency; Capacitor CLI pinned to the compatible 8.4.3 line to avoid its vulnerable iOS-only toolchain dependency. Audit currently reports zero vulnerabilities, including production audit.

## Verification performed

- Local `npm run lint`: passed after implementation.
- Local production web/server build: passed; final repeat after packaging polish passed.
- New release API suite: 15 passed, zero failed; actual HTTP routes and production Firebase service transactions execute against boundary fixtures.
- Actual onboarding view suite: two passed (close without mutation; skip without forced goal). The prior harness imported the full browser Firebase context into JSDOM and hung; replaced with real-view bundling plus a mocked context boundary. No production logic is recreated in the test.
- Full local regression suite passed: 260 checks across six suites (201 + 17 + 20 + 2 + 5 + 15).
- Android project generation and Capacitor sync: succeeded. Local native compilation unavailable because this laptop has no Android SDK/JDK; hosted build workflow added.
- No physical Android device test, live AI call, real account deletion, native Google sign-in, public deploy or Play upload performed.

## Release blockers and exact next steps

1. Hosted APK build succeeded. Install the artifact on a test phone. Test data persistence, EN/FR, manual portion editing, backup and offline relaunch.
2. Confirm Play Console account existence, permanent application ID and release signing-key custody. No paid account was created; current artifact is debug-signed testing only.
3. Register/configure actual Android Firebase/Google OAuth clients before enabling native sign-in; test two real accounts and cloud isolation on a phone.
4. Deploy the staged server/rules through a reviewed approval. Verify named Belgium database, Admin permissions, API origin allowlist, recent-auth deletion and real external deletion URL before enabling cloud features.
5. Choose/verify the Gemini model, provider data terms and operating budget; keep keys in server secrets. No VITE_ secret or unlimited scanning.
6. Finalize the truthful privacy policy, health declaration, Data safety answers, real store screenshots and rating questionnaire. Source routes are not live public policy URLs.
7. Cameroon currently supports Play developer registration but not merchant registration. This is a free beta; subscriptions/payment activation remains blocked on a legitimate supported merchant arrangement. No workaround checkout was added.
8. Run required Google Play closed testing if applicable to the developer account, then production review. This is separate from the research design of 20 completed Cameroon sessions in two stages of 10 across five behavioral groups.

No deployment approval has been requested yet because native/device and production configuration gates are not complete.

## Hosted build evidence

GitHub Actions run https://github.com/kaffeallain-dev/kaffeallain-dev/actions/runs/40323365266 succeeded for commit 81bfdea92a9a9a595c9b98819abc53eaf64e0954. Typecheck/regressions, web build, Capacitor sync and Android assembleDebug all passed on Linux. Artifact MboaFit-android-guest-beta (ID12649259645), 4,352,851 bytes, expires 2 November2026. Artifact ZIP SHA256:4b505fab01a8a7a71edd523da8eb203baf5c4e4f5c762a7487e7a690fd99b0e3. Draft PR:https://github.com/kaffeallain-dev/kaffeallain-dev/pull/3. Main/live deployment unchanged. Local browser preview could not connect to the local server in this environment; no new visual/mobile verification claimed.
