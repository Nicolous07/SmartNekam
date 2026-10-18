# SmartNekam: Android, Windows `.exe`, and Apple App Store

This packaging guide extends the existing Next.js/Supabase project. It does not require starting a new web project and does not change the website theme.

## Order of work

1. Build and test the Windows `.exe` from the `desktop/` folder.
2. Package Android from the deployed PWA using PWABuilder (Trusted Web Activity).
3. Prepare the iOS app on a Mac with Xcode, then test with TestFlight before App Store submission.

## Windows `.exe`
Follow `desktop/README-SW.md`. The build outputs an installer and a portable executable under `desktop/release/`. The application loads `https://smartnekam.vercel.app/`, so it needs internet and uses the latest deployed website.

## Android package for Play Store
1. Open https://www.pwabuilder.com/ and enter `https://smartnekam.vercel.app/`.
2. Run the assessment. Address any required manifest/icon/service-worker issues it reports before generating the Android package.
3. Choose Android package generation (Trusted Web Activity) and use the app ID `com.smartnekam.app` only if this ID has not already been published/reserved by another app. Treat it as permanent once the first store version is published.
4. Keep the signing key and its password in a secure backup. Do not put them on GitHub.
5. Generate the Android package, preferably an Android App Bundle (`.aab`) for Google Play, and follow Play Console's current closed/open testing and publishing requirements.
6. Complete Digital Asset Links verification. After the signing certificate's SHA-256 fingerprint is known, publish a valid `assetlinks.json` at `https://smartnekam.vercel.app/.well-known/assetlinks.json`. Do not publish a file with placeholder fingerprints. Use the official Android Trusted Web Activity guide: https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities

## Apple iPhone/iPad app
- An iOS App Store build requires macOS with Xcode and an Apple Developer account for signing/App Store Connect submission.
- The current SmartNekam web app uses Next.js server actions and server-side routes, so it cannot simply be exported as a fully offline static bundle. The native integration strategy must keep its server-side functionality accessible.
- Capacitor is a possible native runtime, but a website placed in a thin WebView wrapper may be rejected by Apple's minimum-functionality rule. Add and test app-like native value (for example reliable native share/file handling, push notifications, deep links, lifecycle/error handling, and robust account/auth flows), then test on real devices and TestFlight. No package should be claimed App Store-ready until Xcode build and review requirements pass.
- Official docs: https://capacitorjs.com/docs/getting-started and https://developer.apple.com/app-store/review/guidelines/

## Important
- Publishing the website on Vercel is not the same as publishing an Android/iOS app in an app store.
- Android `.apk` is useful for direct testing; Google Play normally uses `.aab` for new app uploads.
- PWA and desktop-wrapper apps require internet for the current cloud-hosted build. Offline access is not implemented by this kit.
- Do not upload secrets or keys from `.env.local` to GitHub.
