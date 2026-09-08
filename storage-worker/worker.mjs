import crypto from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import os from 'node:os';

const API_URL = (process.env.WEB_API_URL || 'https://candidfan.com/api').replace(/\/$/, '');
const WORKER_TOKEN = process.env.WORKER_TOKEN || '';
const WORKER_ID = process.env.WORKER_ID || 'candidfan-storage-' + os.hostname();
const INBOX = resolve(process.env.INBOX_ROOT || '/root/videos');
const MEDIA_ROOT = resolve(process.env.MEDIA_ROOT || '/srv/candidfan-media');
const PROCESS_LIMIT = Number(process.env.PROCESS_LIMIT || 0);
const PROBE_UNKNOWN = process.env.PROBE_UNKNOWN === 'true';
const PROCESSING_VERSION = 'candidfan-720p-v1';
const VIDEO_EXTENSIONS = new Set(['.mp4', '.m4v', '.mov', '.mkv', '.avi', '.webm', '.wmv', '.flv', '.mpeg', '.mpg', '.3gp', '.mts', '.m2ts', '.ts', '.ogv']);

if (!WORKER_TOKEN) throw new Error('WORKER_TOKEN is required');

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

async function api(path, options = {}) {
  const response = await fetch(API_URL + path, {
    ...options,
    headers: { 'content-type': 'application/json', 'x-worker-token': WORKER_TOKEN, ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload.error || 'Worker API request failed'));
  return payload;
}

async function walk(dir, result = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) await walk(fullPath, result);
    else if (entry.isFile()) result.push(fullPath);
  }
  return result;
}

function safeRelative(filePath) {
  const value = relative(INBOX, filePath).split(sep).join('/');
  if (!value || value.startsWith('../') || value.includes('\0')) throw new Error('Invalid inbox path');
  return value;
}

async function isVideo(filePath) {
  if (VIDEO_EXTENSIONS.has(extname(filePath).toLowerCase())) return true;
  if (!PROBE_UNKNOWN) return false;
  try {
    await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_type', '-of', 'default=nw=1:nk=1', filePath], 30_000);
    return true;
  } catch {
    return false;
  }
}

async function inventory() {
  const files = await walk(INBOX);
  const items = [];
  for (const filePath of files) {
    if (!(await isVideo(filePath))) continue;
    const first = await stat(filePath);
    await sleep(25);
    const second = await stat(filePath);
    if (first.size !== second.size || first.mtimeMs !== second.mtimeMs) continue;
    const sourceName = safeRelative(filePath);
    const fingerprint = crypto.createHash('sha256').update(sourceName + ':' + second.size + ':' + second.mtimeMs).digest('hex');
    items.push({ source_name: sourceName, source_size_bytes: second.size, source_mtime_ms: Math.round(second.mtimeMs), fingerprint });
  }
  return items;
}

async function run(command, args, timeoutMs) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
  const [code] = await once(child, 'close');
  clearTimeout(timer);
  if (code !== 0) throw new Error(command + ' failed');
  return stdout;
}

async function probe(filePath) {
  const output = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath], 120_000);
  const parsed = JSON.parse(output);
  const video = (parsed.streams || []).find((stream) => stream.codec_type === 'video');
  if (!video) throw new Error('No usable video stream');
  return {
    duration: Number(parsed.format?.duration || video.duration || 0),
    width: Number(video.width || 0),
    height: Number(video.height || 0),
    codec: String(video.codec_name || 'unknown'),
    mime: 'video/' + (extname(filePath).slice(1).toLowerCase() || 'unknown'),
  };
}

async function copyAndHash(source, destination) {
  await mkdir(dirname(destination), { recursive: true });
  const hash = crypto.createHash('sha256');
  const input = createReadStream(source);
  const output = createWriteStream(destination, { flags: 'wx' });
  input.on('data', (chunk) => hash.update(chunk));
  input.pipe(output);
  await once(output, 'close');
  return hash.digest('hex');
}

async function diskIsHealthy() {
  const fsStats = await statfsCompat(MEDIA_ROOT);
  return Number(fsStats.bavail) / Number(fsStats.blocks) >= 0.15;
}

async function statfsCompat(path) {
  const fs = await import('node:fs/promises');
  return fs.statfs(path);
}

async function processItem(item) {
  if (!(await diskIsHealthy())) throw new Error('LOW_DISK_SPACE');
  const source = resolve(INBOX, item.source_name);
  const inboxRelative = relative(INBOX, source);
  if (inboxRelative.startsWith('..' + sep) || inboxRelative.includes('\0')) throw new Error('Invalid source path');
  const sourceStat = await stat(source);
  if (sourceStat.size !== Number(item.source_size_bytes) || Math.round(sourceStat.mtimeMs) !== Number(item.source_mtime_ms)) throw new Error('SOURCE_CHANGED');
  const itemRoot = join(MEDIA_ROOT, 'work', item.id);
  const sourceKey = 'sources/' + item.id + '/source' + (extname(item.source_name).toLowerCase() || '.media');
  const sourceCopy = join(MEDIA_ROOT, sourceKey);
  await mkdir(itemRoot, { recursive: true });
  let sourceHash;
  try {
    sourceHash = await copyAndHash(source, sourceCopy);
  } catch (error) {
    if (error?.code === 'EEXIST') sourceHash = await hashFile(sourceCopy);
    else throw error;
  }
  const afterCopy = await stat(source);
  if (afterCopy.size !== sourceStat.size || Math.round(afterCopy.mtimeMs) !== Math.round(sourceStat.mtimeMs)) throw new Error('SOURCE_CHANGED');
  const probeInfo = await probe(sourceCopy);
  const fullWork = join(itemRoot, 'full.mp4');
  const previewWork = join(itemRoot, 'preview.mp4');
  const filter = "scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p";
  const baseArgs = ['-hide_banner', '-loglevel', 'error', '-y', '-i', sourceCopy, '-map', '0:v:0', '-map', '0:a:0?', '-vf', filter, '-fpsmax', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-maxrate', '2M', '-bufsize', '4M', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart'];
  await run('ffmpeg', [...baseArgs, fullWork], 6 * 60 * 60 * 1000);
  await run('ffmpeg', [...baseArgs, '-t', '5', previewWork], 30 * 60 * 1000);
  const fullInfo = await probe(fullWork);
  const previewInfo = await probe(previewWork);
  if (previewInfo.duration > 5.2 || fullInfo.duration <= 0) throw new Error('OUTPUT_VALIDATION_FAILED');
  const thumbnailKeys = {};
  for (const [label, width] of [['small', 320], ['medium', 640], ['large', 960]]) {
    const file = join(itemRoot, label + '.webp');
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(Math.min(1, Math.max(0, fullInfo.duration / 2))), '-i', fullWork, '-frames:v', '1', '-vf', "scale=w='min(" + width + ",iw)':h=-2:force_original_aspect_ratio=decrease", '-c:v', 'libwebp', '-q:v', '78', file], 120_000);
    thumbnailKeys[label] = 'thumbnails/' + item.id + '/' + label + '.webp';
  }
  const fullTarget = join(MEDIA_ROOT, 'published', 'full', item.id, 'video.mp4');
  const previewTarget = join(MEDIA_ROOT, 'published', 'previews', item.id, 'preview.mp4');
  await mkdir(dirname(fullTarget), { recursive: true });
  await mkdir(dirname(previewTarget), { recursive: true });
  await rename(fullWork, fullTarget);
  await rename(previewWork, previewTarget);
  for (const label of ['small', 'medium', 'large']) {
    const target = join(MEDIA_ROOT, 'published', 'thumbnails', item.id, label + '.webp');
    await mkdir(dirname(target), { recursive: true });
    await rename(join(itemRoot, label + '.webp'), target);
  }
  const fullStat = await stat(fullTarget);
  const previewStat = await stat(previewTarget);
  await api('/worker/items/' + item.id + '/complete', { method: 'POST', body: JSON.stringify({
    worker_id: WORKER_ID, source_key: sourceKey, work_key: 'work/' + item.id, source_name: item.source_name,
    source_sha256: sourceHash, source_size_bytes: sourceStat.size, source_mime: probeInfo.mime,
    source_duration_seconds: probeInfo.duration, source_codec: probeInfo.codec, output_key: item.id + '/video.mp4',
    preview_key: 'previews/' + item.id + '/preview.mp4', thumbnail_keys: thumbnailKeys,
    duration_seconds: fullInfo.duration, width: fullInfo.width, height: fullInfo.height,
    output_size_bytes: fullStat.size, preview_size_bytes: previewStat.size, processing_version: PROCESSING_VERSION,
    processing_config: { max_width: 1280, max_height: 720, video_bitrate: '2M', audio_bitrate: '96k', preset: 'veryfast' },
  }) });
  await rm(itemRoot, { recursive: true, force: true });
}

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  const input = createReadStream(filePath);
  input.on('data', (chunk) => hash.update(chunk));
  await once(input, 'end');
  return hash.digest('hex');
}

async function failItem(item, error) {
  const safeMessage = error?.message === 'LOW_DISK_SPACE' ? 'Low disk space; processing paused' : (error?.message || 'Processing failed').slice(0, 200);
  await api('/worker/items/' + item.id + '/fail', { method: 'POST', body: JSON.stringify({ worker_id: WORKER_ID, error: safeMessage }) });
}

async function main() {
  const job = await api('/worker/scan');
  const items = await inventory();
  await api('/worker/jobs/' + job.id + '/inventory', { method: 'POST', body: JSON.stringify({ items }) });
  let completed = 0;
  while (PROCESS_LIMIT === 0 || completed < PROCESS_LIMIT) {
    const claim = await api('/worker/items/claim', { method: 'POST', body: JSON.stringify({ worker_id: WORKER_ID }) });
    if (!claim.item) break;
    try {
      await processItem(claim.item);
      completed += 1;
      console.log('Published one media item; progress count=' + completed);
    } catch (error) {
      await failItem(claim.item, error);
      console.error('Media item failed; continuing with next leased item');
      if (error?.message === 'LOW_DISK_SPACE') break;
    }
  }
  console.log('Storage worker idle; processed=' + completed);
}

async function loop() {
  while (true) {
    try { await main(); } catch (error) { console.error('Storage worker cycle failed:', error?.message || 'unknown'); }
    await sleep(Number(process.env.POLL_INTERVAL_MS || 15_000));
  }
}

await loop();
