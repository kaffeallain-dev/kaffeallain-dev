# Android Google sign-in

The app uses Android Credential Manager, exchanges the returned Google ID token through Firebase JS Auth, and continues to use the existing account storage and Firestore rules. Continue with Google is both registration and login. The existing account card shows the signed-in user's name and email. Guest logging remains usable without a Google account.

1. Register the exact Android application ID and signing certificate SHA-1 in the same Firebase project as the existing web app. Enable the Google provider. Store credentials privately and use a stable signing certificate for repeated device updates.
2. Set the public Web OAuth client ID from that Firebase project as `VITE_ANDROID_GOOGLE_WEB_CLIENT_ID` when building the web bundle included in Android. This is the Web OAuth client ID, distinct from the Android OAuth client ID. The bridge exchanges the credential through the existing Firebase JS instance and uses no client secret.
3. Build and sign the APK. Install it on a physical Android device with Google Play services. Verify cancellation, offline fallback, first Google login, reload, sign-out, a second Google account, exclusive meal and profile visibility, and guest import consent. Test only with dedicated accounts and sample data.

An unset client ID leaves the beta in guest/manual mode. No Google account information is sent to other users. See [Firebase Android Google sign-in](https://firebase.google.com/docs/auth/android/google-signin).
