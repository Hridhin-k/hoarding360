-- M03 Documents vault: private org-documents storage bucket
-- Path: {organization_id}/{entity_type}/{entity_id}/{filename}
-- Live project: harding (bzgdutrmehuojindfyxi)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-documents',
  'org-documents',
  false,
  20971520,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists org_documents_select on storage.objects;
drop policy if exists org_documents_insert on storage.objects;
drop policy if exists org_documents_update on storage.objects;
drop policy if exists org_documents_delete on storage.objects;

create policy org_documents_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'org-documents'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
  );

create policy org_documents_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'org-documents'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
  );

create policy org_documents_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'org-documents'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
  );

create policy org_documents_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'org-documents'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
  );
