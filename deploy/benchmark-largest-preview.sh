#!/usr/bin/env bash
set -Eeuo pipefail

media_root="${MEDIA_ROOT:-/srv/candidfan/media}"
output_parent="${OUTPUT_PARENT:-/srv/candidfan/preview-benchmarks}"
minimum_free_bytes="${MINIMUM_FREE_BYTES:-10737418240}" # Keep at least 10 GiB free.
target_seconds=10

for tool in find sort sed awk ffmpeg ffprobe df stat mktemp date basename nice; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'Required command not found: %s\n' "$tool" >&2
    exit 1
  }
done

if [[ ! -d "$media_root" ]]; then
  printf 'Media directory not found: %s\n' "$media_root" >&2
  exit 1
fi
if [[ ! -d "$output_parent" || ! -w "$output_parent" ]]; then
  printf 'Output directory is missing or not writable: %s\n' "$output_parent" >&2
  exit 1
fi
if [[ "$(id -u)" -eq 0 ]]; then
  printf 'Run this benchmark as the candidfan-media service user, not root.\n' >&2
  exit 1
fi

# Select by byte size, but never print the full source path (stored keys are private).
largest="$(find "$media_root" -type f -iname '*.mp4' -printf '%s\t%p\n' | sort -nr | sed -n '1p')"
if [[ -z "$largest" ]]; then
  printf 'No MP4 media files found under %s\n' "$media_root" >&2
  exit 1
fi
IFS=$'\t' read -r source_size source_path <<< "$largest"
if [[ ! "$source_size" =~ ^[0-9]+$ || ! -f "$source_path" ]]; then
  printf 'Unable to identify the largest MP4 file.\n' >&2
  exit 1
fi

source_duration="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$source_path" | sed -n '1p')"
if [[ ! "$source_duration" =~ ^[0-9]+([.][0-9]+)?$ ]] || ! awk -v d="$source_duration" 'BEGIN { exit !(d > 0) }'; then
  printf 'Unable to read a valid duration for the largest MP4.\n' >&2
  exit 1
fi

# Estimate ten seconds from the average source bitrate, with 50%% headroom.
# Keep a fixed free-space reserve because the source can have variable bitrate.
estimated_output_bytes="$(awk -v size="$source_size" -v duration="$source_duration" -v seconds="$target_seconds" 'BEGIN { used = duration < seconds ? duration : seconds; printf "%.0f", (size * used / duration) * 1.5 }')"
available_bytes="$(df -B1 --output=avail "$output_parent" | awk 'NR == 2 { print $1 }')"
if [[ ! "$available_bytes" =~ ^[0-9]+$ ]]; then
  printf 'Unable to determine free space for output directory.\n' >&2
  exit 1
fi
if (( available_bytes < estimated_output_bytes + minimum_free_bytes )); then
  printf 'Not enough free space: available=%s estimated_output=%s required_reserve=%s bytes\n' \
    "$available_bytes" "$estimated_output_bytes" "$minimum_free_bytes" >&2
  exit 1
fi

work_dir="$(mktemp -d "${output_parent%/}/candidfan-preview-benchmark.XXXXXX")"
output_path="${work_dir}/largest-first-10-seconds.mp4"
completed=0
cleanup() {
  if [[ "$completed" -ne 1 ]]; then
    rm -f -- "$output_path"
    rmdir -- "$work_dir" 2>/dev/null || true
  fi
}
trap cleanup EXIT

printf 'source_file=%s\n' "$(basename "$source_path")"
printf 'source_size_bytes=%s\n' "$source_size"
printf 'source_duration_seconds=%s\n' "$source_duration"
printf 'method=stream-copy (no video/audio re-encoding)\n'
printf 'target_duration_seconds=%s\n' "$target_seconds"

start_ns="$(date +%s%N)"
if command -v ionice >/dev/null 2>&1; then
  nice -n 15 ionice -c 3 ffmpeg -hide_banner -nostdin -y -i "$source_path" \
    -map 0:v:0 -map '0:a?' -map_metadata -1 -map_chapters -1 -c copy \
    -t "$target_seconds" -movflags +faststart "$output_path"
else
  nice -n 15 ffmpeg -hide_banner -nostdin -y -i "$source_path" \
    -map 0:v:0 -map '0:a?' -map_metadata -1 -map_chapters -1 -c copy \
    -t "$target_seconds" -movflags +faststart "$output_path"
fi
end_ns="$(date +%s%N)"

output_duration="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$output_path" | sed -n '1p')"
output_size="$(stat -c '%s' "$output_path")"
elapsed_seconds="$(awk -v start="$start_ns" -v end="$end_ns" 'BEGIN { printf "%.3f", (end - start) / 1000000000 }')"

printf 'elapsed_seconds=%s\n' "$elapsed_seconds"
printf 'output_duration_seconds=%s\n' "$output_duration"
printf 'output_size_bytes=%s\n' "$output_size"
printf 'output_path=%s\n' "$output_path"
if awk -v d="$output_duration" 'BEGIN { exit !(d > 10.0) }'; then
  printf 'warning=stream-copy packet boundaries yielded more than 10 seconds; this is a benchmark, not yet a strict preview asset\n'
fi
printf 'source_modified=no\n'

completed=1
