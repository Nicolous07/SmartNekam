# SmartNekam Desktop (Windows .exe)

This folder adds a separate Electron shell for the existing deployed SmartNekam app. It does not change the root Next.js app, its theme, Supabase schema, or the root package.json.

## Before building
- Make sure `https://smartnekam.vercel.app/` is the correct live production URL.
- The desktop app currently loads that hosted website, so an internet connection is required. Changes deployed to Vercel appear in the desktop app automatically.
- Test email/password login and any Google/OAuth login flows. Web-view behavior may differ from Chrome; fix auth/deep-link handling before public release if needed.

## Build on Windows
1. Install a current Node.js LTS release from https://nodejs.org/.
2. Open PowerShell in this `desktop` folder (the one containing this package.json).
3. Install the packaging dependencies:

   ```powershell
   npm install
   ```

4. Test the app:

   ```powershell
   npm start
   ```

5. Build both the installer and portable executable:

   ```powershell
   npm run dist:win
   ```

6. Find the generated `.exe` files in `desktop/release/`.

To generate only the installer, run `npm run dist:installer`. For only the portable `.exe`, run `npm run dist:portable`.

## Security and release notes
- Never add `.env.local`, Supabase service-role keys, signing passwords, or certificates to this folder or GitHub.
- The app has no Node.js integration enabled in web content and opens ordinary external links in the system browser.
- A build without a Windows code-signing certificate may show an unknown-publisher warning. For public distribution, obtain and configure a code-signing certificate instead of asking users to bypass security prompts.
- The shell currently relies on the deployed site. It does not create a standalone offline copy of the Next.js app.
- Web Push, microphone/camera calls, OAuth popups, file picker behavior and notification actions must be tested on the packaged app before promising parity with Chrome.
