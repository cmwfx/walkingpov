-- Store preview files beside, but independently from, their protected originals.
-- Preview filenames reuse the corresponding original storage key in a separate
-- private directory; the database row remains the authoritative video link.
alter table public.media_assets
  add column preview_storage_key uuid,
  add column preview_size_bytes bigint,
  add column source_duration_seconds double precision,
  add column preview_duration_seconds double precision;

alter table public.media_assets
  add constraint media_assets_preview_storage_key_unique unique (preview_storage_key),
  add constraint media_assets_preview_metadata_check check (
    (
      preview_storage_key is null
      and preview_size_bytes is null
      and source_duration_seconds is null
      and preview_duration_seconds is null
    )
    or
    (
      preview_storage_key is not null
      and preview_storage_key = storage_key
      and preview_size_bytes is not null
      and preview_size_bytes > 0
      and source_duration_seconds is not null
      and source_duration_seconds > 0
      and preview_duration_seconds is not null
      and preview_duration_seconds > 0
      and preview_duration_seconds <= 10.05
      and preview_duration_seconds <= source_duration_seconds + 0.1
    )
  );
