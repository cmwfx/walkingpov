import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { AuthRequest, verifyToken } from '../middleware/auth.js';
import { signMediaKey } from '../services/mediaSignature.js';

const router = Router();
const pageSize = 24;
const DOWNLOAD_LINK_VALIDITY_SECONDS = 60 * 60;
const mediaBaseUrl = (process.env.MEDIA_BASE_URL || 'https://media.candidfan.com').replace(/\/$/, '');
const mediaSigningSecret = process.env.MEDIA_SIGNING_SECRET || '';

const videoSelect = 'id, title, thumbnail_url, tags, is_featured, created_at, updated_at';

function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function videoMatchesSearch(video: { title: string; tags?: string[] | null }, search: string) {
  const needle = normalizeSearchText(search);
  if (!needle) return true;
  return [video.title, ...(video.tags || [])].some((value) => normalizeSearchText(value).includes(needle));
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

router.get('/', async (req, res) => {
  const requestedPage = Number(req.query.page || 1);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const search = typeof req.query.search === 'string'
    ? req.query.search.trim().slice(0, 80)
    : typeof req.query.tag === 'string'
      ? req.query.tag.trim().slice(0, 80)
      : '';

  if (search) {
    const { data, error } = await supabaseAdmin
      .from('videos')
      .select(videoSelect)
      .eq('status', 'ready')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      console.error('catalog-search-failed');
      return res.status(500).json({ error: 'Unable to search the catalog' });
    }

    const matches = (data || []).filter((video) => videoMatchesSearch(video, search));
    const start = (page - 1) * pageSize;
    return res.json({
      videos: matches.slice(start, start + pageSize),
      pagination: { page, limit: pageSize, total: matches.length, totalPages: Math.max(1, Math.ceil(matches.length / pageSize)) },
    });
  }

  let query = supabaseAdmin
    .from('videos')
    .select(videoSelect, { count: 'exact' })
    .eq('status', 'ready')
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  const { data, error, count } = await query;
  if (error) {
    console.error('catalog-read-failed');
    return res.status(500).json({ error: 'Unable to load the catalog' });
  }
  return res.json({
    videos: data || [],
    pagination: { page, limit: pageSize, total: count || 0, totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)) },
  });
});

router.get('/:id', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Video not found' });
  const { data, error } = await supabaseAdmin
    .from('videos')
    .select(videoSelect)
    .eq('id', req.params.id)
    .eq('status', 'ready')
    .maybeSingle();
  if (error) {
    console.error('catalog-item-read-failed');
    return res.status(500).json({ error: 'Unable to load the catalog item' });
  }
  if (!data) return res.status(404).json({ error: 'Video not found' });
  return res.json(data);
});

router.get('/:id/download', verifyToken, async (req: AuthRequest, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Video not found' });
  if (!mediaSigningSecret) return res.status(503).json({ error: 'Downloads are temporarily unavailable' });
  if (!req.user?.is_admin && req.user?.membership_status !== 'premium') {
    return res.status(403).json({ error: 'Lifetime membership is required for downloads' });
  }
  const { data, error } = await supabaseAdmin
    .from('media_assets')
    .select('storage_key, content_type, size_bytes')
    .eq('video_id', req.params.id)
    .maybeSingle();
  if (error || !data) return res.status(404).json({ error: 'Video file is not ready' });
  const expires = Math.floor(Date.now() / 1000) + DOWNLOAD_LINK_VALIDITY_SECONDS;
  const key = String(data.storage_key);
  const signature = signMediaKey(key, expires, mediaSigningSecret);
  return res.json({
    url: `${mediaBaseUrl}/download/${encodeURIComponent(key)}?expires=${expires}&sig=${signature}`,
    expires_at: new Date(expires * 1000).toISOString(),
  });
});

export default router;
