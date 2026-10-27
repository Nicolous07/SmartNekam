# SmartNekam — Creator Channels (SQL 047)

SQL 047 adds public learning channels inside Learn.

## What it enables
- Every active user can create one public creator channel.
- Channel categories cover school subjects, life skills, technology, business/careers, personal development, science, creativity, health/wellbeing, and other topics.
- Channel owners can create free course drafts with a first lesson in text or video-link format from **Learn → Fungua channel yangu**.
- Students can browse public channels and follow channels.
- New creator courses and their lessons enter moderation review before becoming public. Existing courses are preserved.
- Paid courses are deliberately not enabled for ordinary creators by this migration; keep payments disabled until the verified provider payment flow is ready.

## How to apply
1. In Supabase Dashboard, open **SQL Editor**.
2. Open and copy the complete file `sql/047_smartnekam_creator_channels.sql` from GitHub.
3. Run it once after SQL 009 and the existing Learn/admin SQL migrations.
4. Wait for **Success**. If Supabase returns an error, do not deploy/retest creator flows yet; share the exact error to fix the migration.

SQL 047 is additive. It creates creator-channel tables, adds `channel_id` and `category` to courses, updates course-submission review functions so lessons publish with the approved course, and creates the public follower-count RPC.

## Try it
- Open `/learn`, choose **Fungua channel yangu**.
- Create the channel.
- Add a course and its first text or video lesson.
- Submit it for review.
- A moderator approves the course in the existing moderation workflow.
- The published course then appears on the channel page and in Learn.
