-- SmartNekam SQL 051: 50 MB Home Feed video uploads + merge + YouTube embed support.
-- SQL 050 enabled short-video MIME types with a 10 MB cap.
-- This migration raises only the post-attachments bucket cap to 50 MB.
-- Note: Supabase project's Global file size limit must also allow 50 MB.
-- Safe to re-run.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-attachments',
  'post-attachments',
  TRUE,
  52428800,
  ARRAY[
    'image/jpeg','image/png','image/webp','image/gif',
    'video/mp4','video/webm','video/quicktime','video/3gpp','video/x-m4v',
    'application/pdf','text/plain','text/csv','application/msword',
    'application/vnd.ms-excel','application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]::TEXT[]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = 52428800,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;
NOTIFY pgrst, 'reload schema';
