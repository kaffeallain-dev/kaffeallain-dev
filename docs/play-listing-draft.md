# Google Play listing — draft, not submitted

App: **MboaFit**. Test build label: **MboaFit Beta**. Support/privacy contact: **kaffeallain@gmail.com**.

English short description: **Record local meals and explore approximate nutrition.**

English description: MboaFit is a meal journal built with Cameroonian food context. Search local dishes, review portions and approximate nutrition, save entries and explore your journal. English and French are supported. You can start without choosing a fitness goal. The current Android test build supports guest/manual logging; cloud accounts and online scanning are not activated for this Android beta. Nutrition estimates require your review and do not replace professional medical advice. This beta is free and has no subscription purchase.

Français, description courte : **Notez vos repas locaux et découvrez leur nutrition estimée.**

Description : MboaFit est un journal alimentaire adapté au contexte camerounais. Recherchez des plats locaux, vérifiez les portions et les valeurs approximatives, puis enregistrez vos repas. L’interface est disponible en français et en anglais. Aucun objectif sportif n’est obligatoire pour commencer. La bêta Android actuelle permet la saisie manuelle en mode invité ; les comptes en ligne et l’analyse photo ne sont pas encore activés sur Android. Les estimations ne remplacent pas un avis médical. Cette bêta est gratuite, sans achat d’abonnement.

## Content and data declarations — verify against the actual uploaded build

- Health declaration: Nutrition and Weight Management. This is not a diagnostic or regulated medical-device claim.
- Guest journal/profile: device IndexedDB; Android cloud backup must remain disabled for this beta. No claim that device data is encrypted by this app.
- Future enabled web sign-in: Firebase identity, user email/provider, profile and meal records in the configured Belgium Firestore database. Do not mark this as an active Android capability while native sign-in is disabled.
- Future configured scanning: photos are transmitted through the server to Gemini; the application does not persist raw photos server-side. Account-linked results/quota metadata and request fingerprints are stored. Provider retention/data-use terms require confirmation before enabling scans.
- Third-party network use: Firebase SDK and externally loaded Google Fonts must be reviewed/disclosed as applicable. No advertising or analytics SDK is intentionally added by this release work.
- Deletion: production web path `/delete-account`; active user data deletion plus minimal UID tombstone. This URL is not live merely because the route exists in source. Historical ambiguous caches/exported backups require separate user handling.
- Required before submission: real public privacy/deletion URLs, finalized privacy text and provider terms, owner/developer identity, native device testing, content-rating answers, real screenshots, Play account verification, permanent package ID and release signing.

Do not submit guessed Data safety answers. Do not use mock UI screenshots as proof of working cloud features. No Play submission or merchant registration has occurred.
