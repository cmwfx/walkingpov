import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyToken, type AuthRequest } from '../middleware/auth.js';
import { createSignedMediaUrl } from '../services/mediaSigning.js';

const router = Router();
const mediaBase = () => (process.env.MEDIA_PUBLIC_URL || 'https://media.candidfan.com').replace(/\/$/, '');
const publicUrl = (kind: 'previews' | 'thumbnails', key: string | null) => key ? mediaBase() + '/media/' + kind + '/' + key.replace(/^\/+/, '').replace(new RegExp('^' + kind + '/'), '') : null;
const publicFields = 'id,title,tags,status,duration_seconds,width,height,public_preview_key,public_thumbnail_key,created_at,published_at';

function present(video: Record<string, unknown>) {
  return {
    id: video.id,
    title: video.title,
    tags: video.tags || [],
    duration_seconds: video.duration_seconds,
    width: video.width,
    height: video.height,
    thumbnail_url: publicUrl('thumbnails', video.public_thumbnail_key as string | null),
    preview_url: publicUrl('previews', video.public_preview_key as string | null),
    created_at: video.created_at,
    published_at: video.published_at,
  };
}

router.get('/', async (req, res) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(48, Math.max(1, Number.parseInt(String(req.query.limit || '24'), 10) || 24));
  const tag = typeof req.query.tag === 'string' ? req.query.tag.trim() : '';
  const query = supabaseAdmin
    .from('videos')
    .select(publicFields, { count: 'exact' })
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  if (tag) query.contains('tags', [tag]);
  const { data, error, count } = await query;
  if (error) {
    console.error('video listing failed', error);
    return res.status(500).json({ error: 'Unable to load videos' });
  }
  res.json({
    videos: (data || []).map(present),
    pagination: { page, limit, total: count || 0, totalPages: Math.max(1, Math.ceil((count || 0) / limit)) },
  });
});

router.get('/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('videos').select(publicFields).eq('id', req.params.id).eq('status', 'published').maybeSingle();
  if (error) {
    console.error('video lookup failed', error);
    return res.status(500).json({ error: 'Unable to load video' });
  }
  if (!data) return res.status(404).json({ error: 'Video not found' });
  res.json(present(data));
});

router.post('/:id/playback', verifyToken, async (req: AuthRequest, res) => {
  const user = req.user!;
  if (!user.is_admin && user.membership_status !== 'premium') return res.status(403).json({ error: 'Premium membership required' });
  const { data, error } = await supabaseAdmin
    .from('videos')
    .select('id,full_asset_key,duration_seconds,status')
    .eq('id', req.params.id)
    .eq('status', 'published')
    .maybeSingle();
  if (error) {
    console.error('playback lookup failed', error);
    return res.status(500).json({ error: 'Unable to authorize playback' });
  }
  if (!data?.full_asset_key) return res.status(404).json({ error: 'Video media is unavailable' });
  const signed = createSignedMediaUrl(data.full_asset_key, Number(data.duration_seconds || 0));
  res.json({ url: signed.url, expires_at: signed.expiresAt, duration_seconds: data.duration_seconds, mime_type: 'video/mp4' });
});

export default router;

