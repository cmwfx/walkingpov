import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyToken, requireAdmin, type AuthRequest } from '../middleware/auth.js';
import { requireWorker } from '../middleware/worker.js';

const router = Router();
const PROCESSING_POOLS = new Set(['local', 'remote']);

function parsePool(value: unknown) {
  return typeof value === 'string' && PROCESSING_POOLS.has(value) ? value : null;
}

async function refresh(jobId: string) {
  await supabaseAdmin.rpc('refresh_import_job_stats', { p_job_id: jobId });
}

router.get('/admin/jobs', verifyToken, requireAdmin, async (_req: AuthRequest, res) => {
  const { data, error } = await supabaseAdmin.from('import_jobs').select('id,status,processing_pool,worker_id,pause_requested,discovered_count,queued_count,processing_count,published_count,duplicate_count,failed_count,skipped_count,last_error,created_at,started_at,completed_at,updated_at').order('created_at', { ascending: false }).limit(50);
  if (error) return res.status(500).json({ error: 'Unable to load import jobs' });
  res.json(data || []);
});

router.get('/admin/jobs/:id', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  const { data: job, error } = await supabaseAdmin.from('import_jobs').select('*').eq('id', req.params.id).maybeSingle();
  if (error) return res.status(500).json({ error: 'Unable to load import job' });
  if (!job) return res.status(404).json({ error: 'Import job not found' });
  const { data: items, error: itemError } = await supabaseAdmin.from('import_items').select('id,status,source_size_bytes,source_mtime_ms,attempts,error_message,video_id,safe_to_delete,updated_at').eq('job_id', req.params.id).order('discovered_at').limit(5000);
  if (itemError) return res.status(500).json({ error: 'Unable to load import items' });
  res.json({ ...job, items: items || [] });
});

router.post('/admin/jobs', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  const { data, error } = await supabaseAdmin.from('import_jobs').insert({ requested_by: req.user!.id, status: 'queued' }).select('id,status,created_at').single();
  if (error) return res.status(500).json({ error: 'Unable to start import scan' });
  res.status(201).json(data);
});

router.patch('/admin/jobs/:id', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  const pause = req.body?.pause;
  if (typeof pause !== 'boolean') return res.status(400).json({ error: 'pause must be boolean' });
  const { data, error } = await supabaseAdmin.from('import_jobs').update({ pause_requested: pause, status: pause ? 'paused' : 'processing' }).eq('id', req.params.id).in('status', ['queued', 'scanning', 'processing', 'paused']).select('id,status,pause_requested').single();
  if (error) return res.status(500).json({ error: 'Unable to update import job' });
  res.json(data);
});

router.post('/admin/jobs/:id/retry', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  const { error } = await supabaseAdmin.from('import_items').update({ status: 'queued', error_message: null, attempts: 0, lease_until: null }).eq('job_id', req.params.id).eq('status', 'failed');
  if (error) return res.status(500).json({ error: 'Unable to retry failed imports' });
  await supabaseAdmin.from('import_jobs').update({ status: 'processing', pause_requested: false }).eq('id', req.params.id);
  await refresh(req.params.id);
  res.json({ success: true });
});

router.post('/admin/jobs/:id/offload', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  const { data: job, error: jobError } = await supabaseAdmin.from('import_jobs').select('id,status,processing_pool').eq('id', req.params.id).maybeSingle();
  if (jobError) return res.status(500).json({ error: 'Unable to load import job' });
  if (!job) return res.status(404).json({ error: 'Import job not found' });
  if (job.processing_pool === 'remote') return res.json({ ...job, processing_pool: 'remote' });
  if (!['queued', 'scanning', 'processing', 'paused'].includes(job.status)) return res.status(409).json({ error: 'Only an active import job can be offloaded' });
  const { count, error: countError } = await supabaseAdmin.from('import_items').select('id', { count: 'exact', head: true }).eq('job_id', req.params.id).eq('status', 'processing');
  if (countError) return res.status(500).json({ error: 'Unable to check active import leases' });
  if ((count || 0) > 0) return res.status(409).json({ error: 'Pause the storage worker and wait for active files to finish before offloading', active_count: count });
  const { data, error } = await supabaseAdmin.from('import_jobs').update({ processing_pool: 'remote', pause_requested: false, status: 'queued', worker_id: null, lease_until: null, heartbeat_at: null }).eq('id', req.params.id).select('id,status,processing_pool,pause_requested,queued_count,published_count,failed_count').single();
  if (error) return res.status(500).json({ error: 'Unable to assign import job to remote processing' });
  res.json(data);
});

router.post('/admin/jobs/:id/local', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  const { data: job, error: jobError } = await supabaseAdmin.from('import_jobs').select('id,status,processing_pool').eq('id', req.params.id).maybeSingle();
  if (jobError) return res.status(500).json({ error: 'Unable to load import job' });
  if (!job) return res.status(404).json({ error: 'Import job not found' });
  const { count, error: countError } = await supabaseAdmin.from('import_items').select('id', { count: 'exact', head: true }).eq('job_id', req.params.id).eq('status', 'processing');
  if (countError) return res.status(500).json({ error: 'Unable to check active import leases' });
  if ((count || 0) > 0) return res.status(409).json({ error: 'Wait for active remote files to finish before returning the job to local processing', active_count: count });
  const { data, error } = await supabaseAdmin.from('import_jobs').update({ processing_pool: 'local', pause_requested: false, status: 'queued', worker_id: null, lease_until: null, heartbeat_at: null }).eq('id', req.params.id).select('id,status,processing_pool,pause_requested,queued_count,published_count,failed_count').single();
  if (error) return res.status(500).json({ error: 'Unable to return import job to local processing' });
  res.json(data);
});

router.get('/worker/scan', requireWorker, async (req, res) => {
  const pool = parsePool(req.query.pool) || 'local';
  const { data: current } = await supabaseAdmin.from('import_jobs').select('id,status,processing_pool').eq('processing_pool', pool).in('status', ['queued', 'scanning', 'processing']).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (current) return res.json(current);
  if (pool === 'remote') return res.json({ id: null, status: 'idle', processing_pool: 'remote' });
  const { data, error } = await supabaseAdmin.from('import_jobs').insert({ status: 'scanning', processing_pool: 'local' }).select('id,status,processing_pool').single();
  if (error) return res.status(500).json({ error: 'Unable to create scan job' });
  res.status(201).json(data);
});

router.post('/worker/jobs/:id/inventory', requireWorker, async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length > 5000) return res.status(413).json({ error: 'Inventory batch is too large' });
  const rows = items.map((item: any) => ({
    job_id: req.params.id,
    source_name: typeof item?.source_name === 'string' ? item.source_name.slice(0, 1000) : '',
    source_size_bytes: Number(item?.source_size_bytes),
    source_mtime_ms: Number(item?.source_mtime_ms),
    fingerprint: typeof item?.fingerprint === 'string' ? item.fingerprint.slice(0, 300) : '',
    status: 'queued',
  })).filter((item: any) => item.source_name && Number.isSafeInteger(item.source_size_bytes) && item.source_size_bytes >= 0 && Number.isSafeInteger(item.source_mtime_ms) && item.fingerprint);
  const { error } = rows.length ? await supabaseAdmin.from('import_items').upsert(rows, { onConflict: 'job_id,fingerprint', ignoreDuplicates: true }) : { error: null };
  if (error) return res.status(500).json({ error: 'Unable to record inventory' });
  await refresh(req.params.id);
  res.json({ job_id: req.params.id, discovered: rows.length });
});

router.post('/worker/items/claim', requireWorker, async (req, res) => {
  const workerId = typeof req.body?.worker_id === 'string' ? req.body.worker_id.slice(0, 100) : '';
  if (!workerId) return res.status(400).json({ error: 'worker_id is required' });
  const pool = parsePool(req.body?.pool) || 'local';
  const { data, error } = await supabaseAdmin.rpc('claim_import_item', { p_worker_id: workerId, p_lease_seconds: 900, p_pool: pool });
  if (error) return res.status(500).json({ error: 'Unable to claim import item' });
  res.json({ item: data || null });
});

router.post('/worker/items/:id/heartbeat', requireWorker, async (req, res) => {
  const workerId = typeof req.body?.worker_id === 'string' ? req.body.worker_id : '';
  const { data, error } = await supabaseAdmin.from('import_items').update({ heartbeat_at: new Date().toISOString(), lease_until: new Date(Date.now() + 15 * 60 * 1000).toISOString() }).eq('id', req.params.id).eq('worker_id', workerId).eq('status', 'processing').select('id').maybeSingle();
  if (error) return res.status(500).json({ error: 'Unable to renew import lease' });
  if (!data) return res.status(409).json({ error: 'Import lease is no longer valid' });
  res.json({ success: true });
});

router.post('/worker/items/:id/complete', requireWorker, async (req, res) => {
  const b = req.body || {};
  const workerId = typeof b.worker_id === 'string' ? b.worker_id : '';
  const { data, error } = await supabaseAdmin.rpc('publish_import_item', {
    p_item_id: req.params.id, p_worker_id: workerId,
    p_source_key: b.source_key, p_work_key: b.work_key, p_source_name: b.source_name,
    p_source_sha256: b.source_sha256, p_source_size_bytes: b.source_size_bytes,
    p_source_mime: b.source_mime || null, p_source_duration_seconds: b.source_duration_seconds || null,
    p_source_codec: b.source_codec || null, p_output_key: b.output_key, p_preview_key: b.preview_key,
    p_thumbnail_keys: b.thumbnail_keys || {}, p_duration_seconds: b.duration_seconds,
    p_width: b.width, p_height: b.height, p_output_size_bytes: b.output_size_bytes,
    p_preview_size_bytes: b.preview_size_bytes, p_processing_version: b.processing_version,
    p_processing_config: b.processing_config || {},
  });
  if (error) {
    console.error('import publication failed', error);
    return res.status(409).json({ error: 'Unable to publish import item' });
  }
  const { data: item } = await supabaseAdmin.from('import_items').select('job_id').eq('id', req.params.id).maybeSingle();
  if (item?.job_id) await refresh(item.job_id);
  res.json(data);
});

router.post('/worker/items/:id/fail', requireWorker, async (req, res) => {
  const workerId = typeof req.body?.worker_id === 'string' ? req.body.worker_id : '';
  const message = typeof req.body?.error === 'string' ? req.body.error.slice(0, 2000) : 'Processing failed';
  const { data: item, error } = await supabaseAdmin.from('import_items').select('job_id,attempts,max_attempts').eq('id', req.params.id).eq('worker_id', workerId).maybeSingle();
  if (error || !item) return res.status(409).json({ error: 'Import item not found or lease expired' });
  const nextStatus = item.attempts >= item.max_attempts ? 'failed' : 'queued';
  await supabaseAdmin.from('import_items').update({ status: nextStatus, error_message: message, lease_until: null }).eq('id', req.params.id).eq('worker_id', workerId);
  await supabaseAdmin.from('import_jobs').update({ last_error: message }).eq('id', item.job_id);
  await refresh(item.job_id);
  res.json({ success: true, status: nextStatus });
});

export default router;
