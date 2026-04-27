-- Create public avatars bucket for citizen profile photos
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload their own avatar
create policy "Users can upload own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (string_to_array(name, '-'))[1]
);

-- Allow authenticated users to update/upsert their own avatar
create policy "Users can update own avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (string_to_array(name, '-'))[1]
);

-- Allow public read of all avatars
create policy "Public avatar read"
on storage.objects for select
to public
using (bucket_id = 'avatars');
