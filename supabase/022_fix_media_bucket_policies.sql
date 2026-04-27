-- ============================================================
-- 022: Simplify incident-media storage bucket policies
-- Reverts the complex JOIN-based policies from 021 that were
-- causing upload failures due to storage RLS context issues.
-- Security is enforced at the incident_media TABLE level (RLS).
-- ============================================================

-- 1. Make bucket public again (no signed URLs needed for display)
UPDATE storage.buckets
SET public = true
WHERE id = 'incident-media';

-- 2. Drop all existing storage object policies for this bucket
DROP POLICY IF EXISTS "authenticated_upload_incident_media" ON storage.objects;
DROP POLICY IF EXISTS "public_read_incident_media" ON storage.objects;
DROP POLICY IF EXISTS "role_read_incident_media" ON storage.objects;

-- 3. Simple INSERT: any authenticated user can upload
--    Table RLS on incident_media enforces incident ownership at DB insert time
CREATE POLICY "authenticated_upload_incident_media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'incident-media');

-- 4. Simple SELECT: public reads (URLs are UUID-path based, unguessable)
--    incident_media table RLS controls who can even obtain the URL
CREATE POLICY "public_read_incident_media"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'incident-media');
