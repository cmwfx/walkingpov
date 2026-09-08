import { NextFunction, Request, Response, Router } from 'express';
import crypto from 'node:crypto';
import { AuthRequest, requireAdmin, verifyToken } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = Router();
const importerToken = process.env.IMPORTER_TOKEN || '';
const internalSource = process.env.IMPORT_SOURCE_KIND || 'originals';

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function internalAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  if (!importerToken || !header.startsWith('Bearer ') || header.slice(7) !== importerToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

function code(error: unknown) {
  return (error instanceof Error ? error.message : '').replace(/[^a-z_]/g, '').slice(0, 80);
}

router.get('/admin/jobs', verifyToken, requireAdmin, async (_req: AuthRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('import_jobs')
    .select('id, source_kind, status, total_items, processed_items, successful_items, failed_items, total_bytes, processed_bytes, started_at, completed_at, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) {
    console.error('import-jobs-read-failed');
    return res.status(500).json({ error: 'Unable to load import jobs.' });
  }
  return res.json(data || []);
});

router.post('/admin/jobs', verifyToken, requireAdmin, async (_req: AuthRequest, res) => {
  const { data, error } = await supabaseAdmin.from('import_jobs').insert({ source_kind: internalSource, status: 'queued' }).select('id, source_kind, status, created_at').single();
  if (error) {
    console.error('import-job-create-failed');
    return res.status(500).json({ error: 'Unable to start import.' });
  }
  return res.status(201).json(data);
});

router.post('/admin/jobs/:id/resume', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  const { data, error } = await supabaseAdmin.from('import_jobs').update({ status: 'queued', completed_at: null }).eq('id', req.params.id).in('status', ['failed', 'completed']).select('id, status').maybeSingle();
  if (error) {
    console.error('import-job-resume-failed');
    return res.status(500).json({ error: 'Unable to resume import.' });
  }
  if (!data) return res.status(404).json({ error: 'Import job not found or still active.' });
  return res.json(data);
});

router.get('/jobs/next', internalAuth, async (_req, res) => {
  const { data, error } = await supabaseAdmin.from('import_jobs').select('id, source_kind').eq('status', 'queued').order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (error) return res.status(500).json({ error: 'import_jobs_unavailable' });
  if (!data) return res.json({ job: null });
  const { data: claimed, error: claimError } = await supabaseAdmin.from('import_jobs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', data.id).eq('status', 'queued').select('id, source_kind').maybeSingle();
  if (claimError) return res.status(500).json({ error: 'import_job_claim_failed' });
  return res.json({ job: claimed || null });
});

router.post('/jobs/:id/scan', internalAuth, async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'import_job_not_found' });
  const totalItems = Number.isSafeInteger(req.body?.total_items) ? req.body.total_items : 0;
  const totalBytes = Number.isSafeInteger(req.body?.total_bytes) ? req.body.total_bytes : 0;
  if (totalItems < 0 || totalBytes < 0) return res.status(400).json({ error: 'invalid_scan' });
  const { error } = await supabaseAdmin.from('import_jobs').update({ total_items: totalItems, total_bytes: totalBytes }).eq('id', req.params.id).eq('status', 'running');
  if (error) return res.status(500).json({ error: 'import_scan_failed' });
  return res.json({ ok: true });
});

router.post('/items/claim', internalAuth, async (req, res) => {
  if (!isUuid(req.body?.job_id)) return res.status(400).json({ error: 'invalid_import_job' });
  const sourceIdentity = typeof req.body?.source_identity === 'string' ? req.body.source_identity : '';
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const sourceSize = req.body?.source_size_bytes;
  if (!/^[a-f0-9]{64}$/.test(sourceIdentity) || !title || title.length > 500 || !Number.isSafeInteger(sourceSize) || sourceSize <= 0) {
    return res.status(400).json({ error: 'invalid_import_item' });
  }
  const storageKey = crypto.randomUUID();
  const thumbnailKey = '00000000-0000-4000-8000-000000000000';
  const { data, error } = await supabaseAdmin.rpc('claim_import_item', {
    p_job_id: req.body.job_id,
    p_source_identity: sourceIdentity,
    p_title: title,
    p_source_size_bytes: sourceSize,
    p_storage_key: storageKey,
    p_thumbnail_key: thumbnailKey,
  });
  if (error || !data?.[0]) {
    console.error('import-item-claim-failed');
    return res.status(500).json({ error: 'import_item_claim_failed' });
  }
  return res.json({ item_id: data[0].item_id, status: data[0].item_status, storage_key: data[0].claimed_storage_key, thumbnail_key: data[0].claimed_thumbnail_key });
});

router.post('/items/:id/publish', internalAuth, async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'import_item_not_found' });
  const sizeBytes = req.body?.size_bytes;
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) return res.status(400).json({ error: 'invalid_size' });
  const { data, error } = await supabaseAdmin.rpc('publish_import_item', { p_item_id: req.params.id, p_size_bytes: sizeBytes });
  if (error) {
    const failureCode = code(error);
    if (failureCode.includes('size_mismatch')) return res.status(409).json({ error: 'size_mismatch' });
    console.error('import-item-publish-failed');
    return res.status(500).json({ error: 'import_item_publish_failed' });
  }
  return res.json({ ok: true, published: Boolean(data) });
});

router.post('/items/:id/fail', internalAuth, async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'import_item_not_found' });
  const failureCode = typeof req.body?.error_code === 'string' ? req.body.error_code.replace(/[^a-z_]/g, '').slice(0, 80) : 'processing_failed';
  const { error } = await supabaseAdmin.rpc('record_import_failure', { p_item_id: req.params.id, p_error_code: failureCode || 'processing_failed' });
  if (error) return res.status(500).json({ error: 'import_item_failure_record_failed' });
  return res.json({ ok: true });
});

router.post('/jobs/:id/complete', internalAuth, async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'import_job_not_found' });
  const { data: counts, error: countError } = await supabaseAdmin.from('import_items').select('status, source_size_bytes').eq('job_id', req.params.id);
  if (countError) return res.status(500).json({ error: 'import_counts_failed' });
  const rows = counts || [];
  const processed = rows.filter((row) => ['completed', 'failed'].includes(row.status));
  const successful = rows.filter((row) => row.status === 'completed');
  const failed = rows.filter((row) => row.status === 'failed');
  const { error } = await supabaseAdmin.from('import_jobs').update({
    status: failed.length && !successful.length ? 'failed' : 'completed',
    processed_items: processed.length,
    successful_items: successful.length,
    failed_items: failed.length,
    processed_bytes: successful.reduce((sum, row) => sum + Number(row.source_size_bytes), 0),
    completed_at: new Date().toISOString(),
  }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'import_complete_failed' });
  return res.json({ processed: processed.length, successful: successful.length, failed: failed.length });
});

export default router;
