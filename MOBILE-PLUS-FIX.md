# SmartNekam mobile + button fix

- Restored the animated green `+` button to the center of the mobile bottom navigation.
- The nav button dispatches `smartnekam:create-post`, which is handled by `CreatePostButton` to open the real post composer.
- Kept the animated floating create button for desktop only to avoid duplicate `+` buttons on phones.
- The composer continues to insert posts into Supabase and supports image upload, categories, subject, and anonymous posting as before.

Run `npm install` and `npm run dev`. Test the `+` on a mobile viewport while signed in. Actual posting requires valid Supabase configuration and the expected `posts` table/storage policies.
