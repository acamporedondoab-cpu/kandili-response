-- incident_media: photos and videos attached to incidents by citizens
CREATE TABLE IF NOT EXISTS public.incident_media (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  uuid        NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  uploaded_by  uuid        NOT NULL REFERENCES auth.users(id),
  media_url    text        NOT NULL,
  media_type   text        NOT NULL CHECK (media_type IN ('photo', 'video')),
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.incident_media ENABLE ROW LEVEL SECURITY;

-- Citizens can insert media for their own incidents
CREATE POLICY "citizen_insert_incident_media"
  ON public.incident_media FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_id AND i.citizen_id = auth.uid()
    )
  );

-- Citizens can view media on their own incidents
-- Org members (TL, responder) can view media for incidents in their org
-- Super admin can view all
CREATE POLICY "read_incident_media"
  ON public.incident_media FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_id AND i.citizen_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.incidents i
      JOIN public.profiles p ON p.organization_id = i.organization_id
      WHERE i.id = incident_id
        AND p.id = auth.uid()
        AND p.role IN ('team_leader', 'responder')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Storage bucket for incident media (public reads, auth writes)
INSERT INTO storage.buckets (id, name, public)
VALUES ('incident-media', 'incident-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "authenticated_upload_incident_media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'incident-media');

CREATE POLICY "public_read_incident_media"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'incident-media');
