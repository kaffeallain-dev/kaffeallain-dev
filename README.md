# MboaFit beta

The existing Cameroon meal journal, preserved from AI Studio and prepared for a free Android test build. This is **not a Play production release**. Android Google authentication is not configured; the packaged beta supports guest/manual logging. Cloud scanning, account deletion and a production API require deliberate server configuration and live validation.

## Run and verify

Node 22 or newer. Run `npm ci`, `npm run lint`, `npm test`, `npm run build`, then `npm run dev` for a local preview. Production serving uses `NODE_ENV=production npm start` and serves only `dist/web`. Server code is built separately to `dist/server/index.mjs`.

`npm run android:sync` builds the web assets and syncs the checked-in Android project. A local native build requires Android SDK 36 and JDK 21. The GitHub Actions workflow builds a debug APK without production secrets. Its artifact is for installation testing, not Play upload. Debug signing may differ between workflow runs: export test data before replacing a build, and do not uninstall a build containing needed records without a backup.

## Configuration and release gates

See `.env.example` and `PROJECT_STATE.md`. The provisional Android application ID is `dev.kaffeallain.mboafit.beta`; a permanent production ID and signing-key ownership must be confirmed before Play upload. The Android app packages local web assets; its backend is a separately deployed HTTPS service. Never embed server credentials in Vite variables or Android assets.

Cloud scanning is **off by default**, requires verified Firebase authentication and durable Firestore quotas, and does not silently fall back to unlimited guest requests. Failed or uncertain provider calls consume their reserved attempt. Beta limits are provisional technical safeguards, not a paid plan. The production model must be explicitly configured and checked for availability and data terms.

Account deletion is **off by default** until Admin SDK credentials/permissions and the accompanying Firestore deletion-barrier rules have been deployed and tested. `/privacy` and `/delete-account` are web routes; the published external URL still requires deployment. No real account was deleted in automated tests. A minimal UID deletion tombstone remains to prevent stale offline data restoring a deleted account. Historical ambiguous local stores and user-exported backup files are not automatically deleted.

Support/privacy contact approved by owner: kaffeallain@gmail.com.

Cameroon publisher status: Google supports developer registration but not merchant registration in its current country table. This free beta does not implement subscriptions or an external-payment workaround. No paid service or Play account was created.
