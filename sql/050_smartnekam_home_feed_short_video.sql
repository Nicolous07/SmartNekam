-- SmartNekam SQL 050 — allow short videos in Home Feed attachments.
-- Keeps the existing post-attachments bucket public and preserves the 10 MB
-- per-file limit from SQL 018. Posts still allow at most 5 attachments.
-- Safe to re-run.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-attachments',
  'post-attachments',
  TRUE,
  10485760,
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
  file_size_limit = 10485760,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


COMMIT;
