import { createHash, randomUUID } from 'node:crypto';
import { copyFile, mkdir, opendir, rename, stat, lstat, access } from 'node:fs/promises';
import path from 'node:path';

const websiteUrl = (process.env.WEBSITE_INTERNAL_URL || 'https://candidfan.com').replace(/\/$/, '');
const token = process.env.IMPORTER_TOKEN || '';
const originalsDir = process.env.ORIGINALS_DIR || '/root/videos';
const intakeDir = process.env.INTAKE_DIR || '/srv/candidfan/intake';
const mediaDir = process.env.MEDIA_DIR || '/srv/candidfan/media';
const thumbnailDir = process.env.THUMBNAIL_DIR || '/srv/candidfan/thumbnails';
const placeholderKey = '00000000-0000-4000-8000-000000000000';

if (!token) throw new Error('IMPORTER_TOKEN is required');

type Candidate = { absolute: string; relative: string; size: number; mtimeMs: number };

async function findCandidates(root: string): Promise<Candidate[]> {
  const result: Candidate[] = [];
  async function visit(directory: string, relativeRoot: string) {
    const handle = await opendir(directory);
    for await (const entry of handle) {
      const absolute = path.join(directory, entry.name);
      const relative = path.join(relativeRoot, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute, relative);
      } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.mp4') {
        const details = await lstat(absolute);
        if (details.isFile() && details.size > 0) result.push({ absolute, relative, size: details.size, mtimeMs: details.mtimeMs });
      }
    }
  }
  await visit(root, '');
  return result;
}

function identity(candidate: Candidate) {
  return createHash('sha256').update(`${candidate.relative}\0${candidate.size}\0${candidate.mtimeMs}`).digest('hex');
}

function titleFor(candidate: Candidate) {
  return path.basename(candidate.relative, path.extname(candidate.relative)).replace(/-/g, ' ').slice(0, 500);
}

function errorCode(error: unknown) {
  return (error instanceof Error ? error.message : 'processing_failed').toLowerCase().replace(/[^a-z_]/g, '').slice(0, 60) || 'processing_failed';
}

async function api(pathname: string, init: RequestInit = {}) {
  const response = await fetch(`${websiteUrl}${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'api_failed');
  return body;
}

async function stableCopy(candidate: Candidate, storageKey: string) {
  const before = await lstat(candidate.absolute);
  if (!before.isFile() || before.size !== candidate.size) throw new Error('source_changed');
  const finalPath = path.join(mediaDir, `${storageKey}.mp4`);
  try {
    const existing = await stat(finalPath);
    if (existing.size === candidate.size) return;
  } catch { /* file does not exist */ }
  const temporaryPath = path.join(mediaDir, `.${storageKey}.part`);
  await copyFile(candidate.absolute, temporaryPath);
  const after = await lstat(candidate.absolute);
  const copied = await stat(temporaryPath);
  if (!after.isFile() || after.size !== candidate.size || copied.size !== candidate.size) throw new Error('source_changed');
  await rename(temporaryPath, finalPath);
}

async function processJob(job: { id: string; source_kind: 'originals' | 'intake' }) {
  const sourceRoot = job.source_kind === 'intake' ? intakeDir : originalsDir;
  const candidates = await findCandidates(sourceRoot);
  await api(`/api/import/jobs/${job.id}/scan`, { method: 'POST', body: JSON.stringify({ total_items: candidates.length, total_bytes: candidates.reduce((sum, item) => sum + item.size, 0) }) });
  await access(path.join(thumbnailDir, 'placeholder.jpg'));
  let successful = 0;
  let failed = 0;
  for (const candidate of candidates) {
    const itemIdentity = identity(candidate);
    let claim: { item_id: string; status: string; storage_key: string; thumbnail_key: string } | undefined;
    try {
      claim = await api('/api/import/items/claim', {
        method: 'POST',
        body: JSON.stringify({ job_id: job.id, source_identity: itemIdentity, title: titleFor(candidate), source_size_bytes: candidate.size, storage_key: randomUUID(), thumbnail_key: placeholderKey }),
      });
      if (!claim) throw new Error('claim_failed');
      if (claim.status === 'completed') { successful += 1; continue; }
      await stableCopy(candidate, claim.storage_key);
      await api(`/api/import/items/${claim.item_id}/publish`, { method: 'POST', body: JSON.stringify({ size_bytes: candidate.size }) });
      successful += 1;
    } catch (error) {
      failed += 1;
      const failureCode = errorCode(error);
      console.error('import-item-failed', failureCode);
      try {
        if (claim) await api(`/api/import/items/${claim.item_id}/fail`, { method: 'POST', body: JSON.stringify({ error_code: failureCode }) });
      } catch { console.error('import-failure-record-failed'); }
    }
  }
  const result = await api(`/api/import/jobs/${job.id}/complete`, { method: 'POST', body: JSON.stringify({}) });
  console.log('import-job-complete', JSON.stringify({ successful, failed, processed: result.processed }));
}

async function main() {
  await mkdir(mediaDir, { recursive: true });
  await mkdir(thumbnailDir, { recursive: true });
  console.log('candidfan-importer-ready');
  while (true) {
    try {
      const response = await api('/api/import/jobs/next');
      if (response.job) await processJob(response.job);
    } catch (error) {
      console.error('importer-cycle-failed', errorCode(error));
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
}

void main().catch(() => {
  console.error('importer-stopped');
  process.exitCode = 1;
});
