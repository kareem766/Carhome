ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_path text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('organization-logos', 'organization-logos', false, 2097152, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 2097152, allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp'];

DROP POLICY IF EXISTS organization_logos_select_own_folder ON storage.objects;
CREATE POLICY organization_logos_select_own_folder ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'organization-logos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS organization_logos_insert_own_folder ON storage.objects;
CREATE POLICY organization_logos_insert_own_folder ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'organization-logos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS organization_logos_update_own_folder ON storage.objects;
CREATE POLICY organization_logos_update_own_folder ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'organization-logos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
WITH CHECK (bucket_id = 'organization-logos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS organization_logos_delete_own_folder ON storage.objects;
CREATE POLICY organization_logos_delete_own_folder ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'organization-logos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
