#!/usr/bin/env bash
set -Eeuo pipefail
umask 0027

media_root="${MEDIA_ROOT:-/srv/candidfan/media}"
preview_root="${PREVIEW_ROOT:-/srv/candidfan/previews}"
minimum_free_bytes="${MINIMUM_FREE_BYTES:-10737418240}" # Keep at least 10 GiB free.
site_url="${WEBSITE_INTERNAL_URL:-https://candidfan.com}"
importer_token="${IMPORTER_TOKEN:-}"

for tool in curl df ffmpeg ffprobe flock mktemp mv node nice ionice stat awk; do
  command -v "$tool" >/dev/null 2>&1 || { printf 'Required command not found: %s\n' "$tool" >&2; exit 1; }
done
[[ -d "$media_root" && -r "$media_root" ]] || { echo 'Original media directory is unavailable.' >&2; exit 1; }
[[ -d "$preview_root" && -w "$preview_root" ]] || { echo 'Preview directory is unavailable or not writable.' >&2; exit 1; }
[[ "$minimum_free_bytes" =~ ^[0-9]+$ ]] || { echo 'MINIMUM_FREE_BYTES must be an integer.' >&2; exit 1; }
[[ -n "$importer_token" ]] || { echo 'IMPORTER_TOKEN is required.' >&2; exit 1; }
api_base="${site_url%/}"
uuid_re='^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'

exec 9>"${preview_root}/.backfill.lock"
if ! flock -n 9; then
  echo 'Another preview backfill is already running.' >&2
  exit 1
fi

queue_file=""
items_file=""
current_part=""
cleanup() {
  [[ -z "$queue_file" ]] || rm -f -- "$queue_file"
  [[ -z "$items_file" ]] || rm -f -- "$items_file"
  [[ -z "$current_part" ]] || rm -f -- "$current_part"
}
trap cleanup EXIT

queue_file="$(mktemp "${preview_root}/.preview-queue.XXXXXX")"
items_file="$(mktemp "${preview_root}/.preview-items.XXXXXX")"
if ! curl --fail --silent --show-error --connect-timeout 10 --max-time 60 \
  -H "Authorization: Bearer ${importer_token}" \
  "${api_base}/api/import/previews/queue" -o "$queue_file"; then
  echo 'Unable to load the internal preview queue.' >&2
  exit 1
fi

page_size="$(node -e 'const q=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); if(!Number.isSafeInteger(q.page_size)||q.page_size<1)process.exit(2); process.stdout.write(String(q.page_size))' "$queue_file")"
node - "$queue_file" > "$items_file" <<'NODE'
const fs = require('node:fs');
const queue = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!Array.isArray(queue.videos)) process.exit(2);
for (const video of queue.videos) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(video.video_id || '')) process.exit(2);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(video.storage_key || '')) process.exit(2);
  process.stdout.write(`${video.video_id}\t${video.storage_key}\t${video.has_preview === true}\n`);
}
NODE

free_bytes() {
  df -B1 --output=avail "$preview_root" | awk 'NR == 2 { print $1 }'
}

probe_duration() {
  ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$1" | awk 'NR == 1 { print; exit }'
}

valid_durations() {
  awk -v source="$1" -v preview="$2" 'BEGIN { exit !(source > 0 && preview > 0 && preview <= 10.05 && preview <= source + 0.1) }'
}

register_preview() {
  local video_id="$1" size_bytes="$2" source_duration="$3" preview_duration="$4" payload
  payload="$(node -e 'process.stdout.write(JSON.stringify({preview_size_bytes:Number(process.argv[1]),source_duration_seconds:Number(process.argv[2]),preview_duration_seconds:Number(process.argv[3])}))' "$size_bytes" "$source_duration" "$preview_duration")"
  curl --fail --silent --show-error --connect-timeout 10 --max-time 30 \
    -H "Authorization: Bearer ${importer_token}" \
    -H 'Content-Type: application/json' \
    --data "$payload" \
    "${api_base}/api/import/previews/${video_id}/complete" -o /dev/null
}

total=0
processed=0
already_done=0
failed=0
index=0
space_stop=0
printf 'preview_backfill_start page_one_priority=%s minimum_free_bytes=%s\n' "$page_size" "$minimum_free_bytes"

while IFS=$'\t' read -r video_id storage_key has_preview; do
  [[ -n "$video_id" ]] || continue
  index=$((index + 1))
  total=$((total + 1))
  if [[ "$has_preview" == true ]]; then
    already_done=$((already_done + 1))
    continue
  fi
  if [[ ! "$video_id" =~ $uuid_re || ! "$storage_key" =~ $uuid_re ]]; then
    failed=$((failed + 1))
    printf 'preview_skip invalid_catalog_identity item=%s\n' "$index"
    continue
  fi

  source_path="${media_root}/${storage_key}.mp4"
  output_path="${preview_root}/${storage_key}.mp4"
  current_part="${preview_root}/.${storage_key}.part.mp4"
  [[ -f "$source_path" && -r "$source_path" ]] || {
    failed=$((failed + 1))
    printf 'preview_skip source_missing item=%s\n' "$index"
    continue
  }

  source_duration="$(probe_duration "$source_path" 2>/dev/null || true)"
  if ! awk -v duration="$source_duration" 'BEGIN { exit !(duration > 0) }'; then
    failed=$((failed + 1))
    printf 'preview_skip source_duration_unavailable item=%s\n' "$index"
    continue
  fi

  # A completed file whose API registration was interrupted is reused on resume.
  if [[ -f "$output_path" ]]; then
    existing_duration="$(probe_duration "$output_path" 2>/dev/null || true)"
    if valid_durations "$source_duration" "$existing_duration"; then
      output_size="$(stat -c '%s' "$output_path")"
      if [[ "$output_size" =~ ^[0-9]+$ ]] && (( output_size > 0 )); then
        if ! register_preview "$video_id" "$output_size" "$source_duration" "$existing_duration"; then
          echo 'Preview registration failed; the finished deterministic file will be reconciled on the next run.' >&2
          exit 1
        fi
        processed=$((processed + 1))
        printf 'preview_registered existing_file=yes item=%s size_bytes=%s\n' "$index" "$output_size"
        continue
      fi
    fi
    rm -f -- "$output_path"
  fi

  rm -f -- "$current_part"
  source_size="$(stat -c '%s' "$source_path")"
  estimate_bytes="$(awk -v size="$source_size" -v duration="$source_duration" 'BEGIN { used = duration < 10 ? duration : 10; printf "%.0f", (size * used / duration) * 2 }')"
  available_bytes="$(free_bytes)"
  if [[ ! "$available_bytes" =~ ^[0-9]+$ ]] || (( available_bytes <= minimum_free_bytes + estimate_bytes )); then
    space_stop=1
    printf 'preview_backfill_stopped reason=reserve_preflight free_bytes=%s reserve_bytes=%s estimated_output_bytes=%s\n' "$available_bytes" "$minimum_free_bytes" "$estimate_bytes"
    break
  fi

  printf 'preview_processing item=%s priority=%s\n' "$index" "$([[ "$index" -le "$page_size" ]] && echo page_one || echo catalog)"
  if ! nice -n 15 ionice -c 3 ffmpeg -hide_banner -loglevel error -nostdin -y \
    -i "$source_path" -map 0:v:0 -map '0:a?' -map_metadata -1 -map_chapters -1 \
    -c copy -t 10 -movflags +faststart "$current_part"; then
    rm -f -- "$current_part"
    current_part=""
    failed=$((failed + 1))
    printf 'preview_skip ffmpeg_failed item=%s\n' "$index"
    continue
  fi

  preview_duration="$(probe_duration "$current_part" 2>/dev/null || true)"
  if ! valid_durations "$source_duration" "$preview_duration"; then
    rm -f -- "$current_part"
    if ! nice -n 15 ionice -c 3 ffmpeg -hide_banner -loglevel error -nostdin -y \
      -i "$source_path" -map 0:v:0 -map '0:a?' -map_metadata -1 -map_chapters -1 \
      -c copy -t 9.95 -movflags +faststart "$current_part"; then
      rm -f -- "$current_part"
      current_part=""
      failed=$((failed + 1))
      printf 'preview_skip ffmpeg_retry_failed item=%s\n' "$index"
      continue
    fi
    preview_duration="$(probe_duration "$current_part" 2>/dev/null || true)"
  fi

  if ! valid_durations "$source_duration" "$preview_duration"; then
    rm -f -- "$current_part"
    current_part=""
    failed=$((failed + 1))
    printf 'preview_skip duration_outside_tolerance item=%s\n' "$index"
    continue
  fi

  output_size="$(stat -c '%s' "$current_part")"
  available_after_write="$(free_bytes)"
  if [[ ! "$available_after_write" =~ ^[0-9]+$ ]] || (( available_after_write < minimum_free_bytes )); then
    rm -f -- "$current_part"
    current_part=""
    space_stop=1
    printf 'preview_backfill_stopped reason=reserve_postflight free_bytes=%s reserve_bytes=%s\n' "$available_after_write" "$minimum_free_bytes"
    break
  fi

  mv -f -- "$current_part" "$output_path"
  current_part=""
  chmod 0640 "$output_path"
  if ! register_preview "$video_id" "$output_size" "$source_duration" "$preview_duration"; then
    echo 'Preview registration failed; the finished deterministic file will be reconciled on the next run.' >&2
    exit 1
  fi
  processed=$((processed + 1))
  printf 'preview_complete item=%s preview_duration_seconds=%s size_bytes=%s free_bytes=%s\n' "$index" "$preview_duration" "$output_size" "$(free_bytes)"
done < "$items_file"

printf 'preview_backfill_finish catalog_items=%s new_previews=%s existing_previews=%s skipped=%s stopped_for_reserve=%s free_bytes=%s\n' \
  "$total" "$processed" "$already_done" "$failed" "$space_stop" "$(free_bytes)"
