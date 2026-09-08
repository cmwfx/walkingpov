import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat, statfs } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { posix as remotePath } from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import os from 'node:os';
import SftpClient from 'ssh2-sftp-client';

const API_URL = (process.env.WEB_API_URL || 'https://candidfan.com/api').replace(/\/$/, '');
const WORKER_TOKEN = process.env.WORKER_TOKEN || '';
const WORKER_ID = process.env.WORKER_ID || 'candidfan-runpod-' + os.hostname();
const REMOTE_HOST = process.env.REMOTE_STORAGE_HOST || '';
const REMOTE_PORT = Number(process.env.REMOTE_STORAGE_PORT || 22);
const REMOTE_USER = process.env.REMOTE_STORAGE_USER || 'candidfan-processor';
const REMOTE_INBOX = remotePath.normalize(process.env.REMOTE_INBOX_ROOT || '/root/videos');
const REMOTE_MEDIA_ROOT = remotePath.normalize(process.env.REMOTE_MEDIA_ROOT || '/srv/candidfan-media');
const WORK_ROOT = resolve(process.env.WORK_ROOT || '/tmp/candidfan-runpod');
const PROCESSING_VERSION = 'candidfan-720p-v1';
const PROCESS_LIMIT = Number(process.env.PROCESS_LIMIT || 0);
const CPU_COUNT = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
const DEFAULT_FFMPEG_THREADS = Math.max(1, Math.min(4, CPU_COUNT));
const FFMPEG_THREADS = Math.max(1, Number(process.env.FFMPEG_THREADS || DEFAULT_FFMPEG_THREADS));
const PROCESS_CONCURRENCY = Math.max(1, Number(process.env.PROCESS_CONCURRENCY || Math.floor(CPU_COUNT / FFMPEG_THREADS)));
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 15_000);

if (!WORKER_TOKEN) throw new Error('WORKER_TOKEN is required');
if (!REMOTE_HOST) throw new Error('REMOTE_STORAGE_HOST is required');

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

async function loadPrivateKey() {
  if (process.env.REMOTE_STORAGE_PRIVATE_KEY) return process.env.REMOTE_STORAGE_PRIVATE_KEY;
  const keyPath = process.env.REMOTE_STORAGE_KEY_PATH;
  if (!keyPath) throw new Error('REMOTE_STORAGE_KEY_PATH or REMOTE_STORAGE_PRIVATE_KEY is required');
  return readFile(keyPath, 'utf8');
}

async function connectSftp() {
  const client = new SftpClient();
  try {
    await client.connect({
      host: REMOTE_HOST,
      port: REMOTE_PORT,
      username: REMOTE_USER,
      privateKey: await loadPrivateKey(),
      readyTimeout: 30_000,
      keepaliveInterval: 15_000,
    });
    return client;
  } catch (error) {
    await client.end().catch(() => {});
    throw new Error('REMOTE_CONNECT_FAILED');
  }
}

function withinRemoteRoot(root, candidate) {
  const normalizedRoot = remotePath.normalize(root).replace(/\/$/, '') || '/';
  const normalizedCandidate = remotePath.normalize(candidate);
  if (normalizedRoot === '/') return normalizedCandidate.startsWith('/');
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(normalizedRoot + '/');
}

function sourcePath(sourceName) {
  const candidate = remotePath.normalize(remotePath.join(REMOTE_INBOX, sourceName));
  if (!withinRemoteRoot(REMOTE_INBOX, candidate) || candidate === REMOTE_INBOX) throw new Error('INVALID_SOURCE_PATH');
  return candidate;
}

function mediaPath(key) {
  const candidate = remotePath.normalize(remotePath.join(REMOTE_MEDIA_ROOT, key));
  if (!withinRemoteRoot(REMOTE_MEDIA_ROOT, candidate)) throw new Error('INVALID_MEDIA_PATH');
  return candidate;
}

async function ensureRemoteDir(sftp, path) {
  try {
    await sftp.mkdir(path, true);
  } catch {
    throw new Error('REMOTE_TRANSFER_FAILED');
  }
}

async function downloadSource(sftp, item, destination) {
  const remoteSource = sourcePath(item.source_name);
  let before;
  try {
    before = await sftp.stat(remoteSource);
    if (Number(before.size) !== Number(item.source_size_bytes)) throw new Error('SOURCE_CHANGED');
    await sftp.fastGet(remoteSource, destination);
    const after = await sftp.stat(remoteSource);
    if (Number(after.size) !== Number(item.source_size_bytes) || Math.abs(Number(after.modifyTime || 0) - Number(item.source_mtime_ms)) > 2000) throw new Error('SOURCE_CHANGED');
    const local = await stat(destination);
    if (Number(local.size) !== Number(item.source_size_bytes)) throw new Error('SOURCE_CHANGED');
  } catch (error) {
    if (error?.message === 'SOURCE_CHANGED') throw error;
    throw new Error('REMOTE_TRANSFER_FAILED');
  }
  return before;
}

async function uploadVerified(sftp, localPath, key) {
  try {
    const local = await stat(localPath);
    await ensureRemoteDir(sftp, dirname(mediaPath(key)).split(sep).join('/'));
    await sftp.fastPut(localPath, mediaPath(key));
    const remote = await sftp.stat(mediaPath(key));
    if (Number(remote.size) !== Number(local.size)) throw new Error('REMOTE_SIZE_MISMATCH');
    return Number(local.size);
  } catch (error) {
    if (error?.message === 'REMOTE_SIZE_MISMATCH') throw error;
    throw new Error('REMOTE_TRANSFER_FAILED');
  }
}

async function run(command, args, timeoutMs) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
  const [code] = await once(child, 'close');
  clearTimeout(timer);
  if (code !== 0) throw new Error(command + '_FAILED');
  return stdout;
}

async function probe(filePath) {
  const output = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath], 120_000);
  const parsed = JSON.parse(output);
  const video = (parsed.streams || []).find((stream) => stream.codec_type === 'video');
  if (!video) throw new Error('NO_VIDEO_STREAM');
  return {
    duration: Number(parsed.format?.duration || video.duration || 0),
    width: Number(video.width || 0),
    height: Number(video.height || 0),
    codec: String(video.codec_name || 'unknown'),
    mime: 'video/' + (extname(filePath).slice(1).toLowerCase() || 'unknown'),
  };
}

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  const input = createReadStream(filePath);
  input.on('data', (chunk) => hash.update(chunk));
  await once(input, 'end');
  return hash.digest('hex');
}

async function diskIsHealthy() {
  await mkdir(WORK_ROOT, { recursive: true });
  const fsStats = await statfs(WORK_ROOT);
  return Number(fsStats.bavail) / Number(fsStats.blocks) >= 0.15;
}

async function clearStaleWork() {
  await mkdir(WORK_ROOT, { recursive: true });
  for (const entry of await readdir(WORK_ROOT, { withFileTypes: true })) {
    await rm(join(WORK_ROOT, entry.name), { recursive: true, force: true });
  }
}

async function processItem(sftp, item) {
  if (!(await diskIsHealthy())) throw new Error('LOW_DISK_SPACE');
  const itemRoot = join(WORK_ROOT, item.id);
  const sourceExtension = extname(item.source_name).toLowerCase() || '.media';
  const sourceFile = join(itemRoot, 'source' + sourceExtension);
  const sourceKey = 'sources/' + item.id + '/source' + sourceExtension;
  await mkdir(itemRoot, { recursive: true });
  try {
    await downloadSource(sftp, item, sourceFile);
    const sourceHash = await hashFile(sourceFile);
    await uploadVerified(sftp, sourceFile, sourceKey);
    const probeInfo = await probe(sourceFile);
    const fullWork = join(itemRoot, 'full.mp4');
    const previewWork = join(itemRoot, 'preview.mp4');
    const filter = "scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p";
    const baseArgs = ['-hide_banner', '-loglevel', 'error', '-y', '-threads', String(FFMPEG_THREADS), '-filter_threads', '1', '-filter_complex_threads', '1', '-i', sourceFile, '-map', '0:v:0', '-map', '0:a:0?', '-vf', filter, '-fpsmax', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-maxrate', '2M', '-bufsize', '4M', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart'];
    await run('ffmpeg', [...baseArgs, fullWork], 6 * 60 * 60 * 1000);
    await run('ffmpeg', [...baseArgs, '-t', '5', previewWork], 30 * 60 * 1000);
    const fullInfo = await probe(fullWork);
    const previewInfo = await probe(previewWork);
    if (previewInfo.duration > 5.2 || fullInfo.duration <= 0) throw new Error('OUTPUT_VALIDATION_FAILED');
    const thumbnailKeys = {};
    for (const [label, width] of [['small', 320], ['medium', 640], ['large', 960]]) {
      const file = join(itemRoot, label + '.webp');
      await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-threads', String(FFMPEG_THREADS), '-ss', String(Math.min(1, Math.max(0, fullInfo.duration / 2))), '-i', fullWork, '-frames:v', '1', '-vf', "scale=w='min(" + width + ",iw)':h=-2:force_original_aspect_ratio=decrease", '-c:v', 'libwebp', '-q:v', '78', file], 120_000);
      thumbnailKeys[label] = 'thumbnails/' + item.id + '/' + label + '.webp';
    }
    const fullKey = 'published/full/' + item.id + '/video.mp4';
    const previewKey = 'published/previews/' + item.id + '/preview.mp4';
    await uploadVerified(sftp, fullWork, fullKey);
    await uploadVerified(sftp, previewWork, previewKey);
    for (const label of ['small', 'medium', 'large']) await uploadVerified(sftp, join(itemRoot, label + '.webp'), 'published/thumbnails/' + item.id + '/' + label + '.webp');
    const fullStat = await stat(fullWork);
    const previewStat = await stat(previewWork);
    await api('/worker/items/' + item.id + '/complete', { method: 'POST', body: JSON.stringify({
      worker_id: item.worker_id || WORKER_ID, source_key: sourceKey, work_key: 'work/' + item.id, source_name: item.source_name,
      source_sha256: sourceHash, source_size_bytes: Number(item.source_size_bytes), source_mime: probeInfo.mime,
      source_duration_seconds: probeInfo.duration, source_codec: probeInfo.codec, output_key: item.id + '/video.mp4',
      preview_key: 'previews/' + item.id + '/preview.mp4', thumbnail_keys: thumbnailKeys,
      duration_seconds: fullInfo.duration, width: fullInfo.width, height: fullInfo.height,
      output_size_bytes: fullStat.size, preview_size_bytes: previewStat.size, processing_version: PROCESSING_VERSION,
      processing_config: { max_width: 1280, max_height: 720, video_bitrate: '2M', audio_bitrate: '96k', preset: 'veryfast', threads_per_item: FFMPEG_THREADS, processing_pool: 'remote' },
    }) });
  } finally {
    await rm(itemRoot, { recursive: true, force: true });
  }
}

function safeFailure(error) {
  const code = String(error?.message || 'REMOTE_PROCESSING_FAILED');
  if (['LOW_DISK_SPACE', 'SOURCE_CHANGED', 'INVALID_SOURCE_PATH', 'NO_VIDEO_STREAM', 'OUTPUT_VALIDATION_FAILED'].includes(code)) return code;
  if (code.includes('CONNECT') || code.includes('TRANSFER') || code.includes('SIZE_MISMATCH')) return 'REMOTE_TRANSFER_FAILED';
  if (code.includes('FFMPEG') || code.includes('FFPROBE')) return 'MEDIA_PROCESSING_FAILED';
  return 'REMOTE_PROCESSING_FAILED';
}

async function failItem(item, error, workerId) {
  await api('/worker/items/' + item.id + '/fail', { method: 'POST', body: JSON.stringify({ worker_id: workerId, error: safeFailure(error) }) });
}

async function withHeartbeat(item, workerId, task) {
  const timer = setInterval(() => {
    void api('/worker/items/' + item.id + '/heartbeat', { method: 'POST', body: JSON.stringify({ worker_id: workerId }) }).catch(() => {});
  }, 5 * 60 * 1000);
  try {
    return await task();
  } finally {
    clearInterval(timer);
  }
}

async function processLoop(index) {
  const workerId = WORKER_ID + '-v' + String(index + 1);
  let completed = 0;
  let sftp = null;
  try {
    while (PROCESS_LIMIT === 0 || completed < PROCESS_LIMIT) {
      const claim = await api('/worker/items/claim', { method: 'POST', body: JSON.stringify({ worker_id: workerId, pool: 'remote' }) });
      if (!claim.item) break;
      try {
        if (!sftp) sftp = await connectSftp();
        await withHeartbeat(claim.item, workerId, () => processItem(sftp, { ...claim.item, worker_id: workerId }));
        completed += 1;
        console.log('Remote processor published one media item; worker=' + String(index + 1) + ' progress=' + completed);
      } catch (error) {
        await failItem(claim.item, error, workerId).catch(() => {});
        console.error('Remote processor item failed; continuing with next leased item');
        await sftp?.end().catch(() => {});
        sftp = null;
        if (error?.message === 'LOW_DISK_SPACE') break;
      }
    }
  } finally {
    await sftp?.end().catch(() => {});
  }
  return completed;
}

async function main() {
  const job = await api('/worker/scan?pool=remote');
  if (!job.id) return 0;
  const results = await Promise.all(Array.from({ length: PROCESS_CONCURRENCY }, (_, index) => processLoop(index)));
  return results.reduce((sum, value) => sum + value, 0);
}

async function loop() {
  await clearStaleWork();
  console.log('RunPod processor ready; concurrency=' + PROCESS_CONCURRENCY + ' ffmpeg_threads=' + FFMPEG_THREADS + ' detected_vcpu=' + CPU_COUNT);
  while (true) {
    try {
      const processed = await main();
      if (processed > 0) console.log('RunPod processor cycle complete; processed=' + processed);
    } catch (error) {
      console.error('RunPod processor cycle failed:', safeFailure(error));
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

await loop();
