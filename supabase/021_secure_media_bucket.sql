-- ============================================================
-- 021: Secure incident-media storage bucket
-- Makes bucket private, removes public SELECT policy,
-- adds role-based access: citizen / assigned-responder / TL-same-org / super_admin
-- ============================================================

-- 1. Drop the public read policy on storage objects
DROP POLICY IF EXISTS "public_read_incident_media" ON storage.objects;

-- 2. Make the bucket private (disables public URL access)
UPDATE storage.buckets
SET public = false
WHERE id = 'incident-media';

-- 3. Tighten the INSERT policy: uploader must own (be the citizen of) the incident
--    Path format: <incident_id>/<filename>  → split_part(name,'/',1) = incident_id
DROP POLICY IF EXISTS "authenticated_upload_incident_media" ON storage.objects;

CREATE POLICY "authenticated_upload_incident_media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'incident-media'
    AND EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = (split_part(name, '/', 1))::uuid
        AND i.citizen_id = auth.uid()
    )
  );

-- 4. Role-based SELECT on storage objects
CREATE POLICY "role_read_incident_media"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'incident-media'
    AND (
      -- citizen who owns the incident
      EXISTS (
        SELECT 1 FROM public.incidents i
        WHERE i.id = (split_part(name, '/', 1))::uuid
          AND i.citizen_id = auth.uid()
      )
      -- assigned responder
      OR EXISTS (
        SELECT 1 FROM public.incidents i
        WHERE i.id = (split_part(name, '/', 1))::uuid
          AND i.assigned_responder_id = auth.uid()
      )
      -- team leader in the same organisation
      OR EXISTS (
        SELECT 1 FROM public.incidents i
        JOIN public.profiles p ON p.organization_id = i.organization_id
        WHERE i.id = (split_part(name, '/', 1))::uuid
          AND p.id = auth.uid()
          AND p.role = 'team_leader'
      )
      -- super admin
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'super_admin'
      )
    )
  );
