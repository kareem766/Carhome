DROP POLICY IF EXISTS organization_logos_delete_own_folder ON storage.objects;
DROP POLICY IF EXISTS organization_logos_update_own_folder ON storage.objects;
DROP POLICY IF EXISTS organization_logos_insert_own_folder ON storage.objects;
DROP POLICY IF EXISTS organization_logos_select_own_folder ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'organization-logos';
ALTER TABLE public.organizations DROP COLUMN IF EXISTS logo_path;
