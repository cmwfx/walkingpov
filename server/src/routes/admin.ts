import { NextFunction, Response, Router } from 'express';
import crypto from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import multer from 'multer';
import sharp from 'sharp';
import { AuthRequest, requireAdmin, verifyToken } from '../middleware/auth.js';
import { adminThumbnailUploadLimiter } from '../middleware/rateLimiter.js';
import { supabaseAdmin } from '../config/supabase.js';
import { signMediaKey } from '../services/mediaSignature.js';
import { getUnreadTicketIds } from '../services/supportUnread.js';

const router = Router();
const mediaBaseUrl = (process.env.MEDIA_BASE_URL || 'https://media.candidfan.com').replace(/\/$/, '');
const mediaSigningSecret = process.env.MEDIA_SIGNING_SECRET || '';
const maxThumbnailBytes = 12 * 1024 * 1024;
const thumbnailUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxThumbnailBytes, files: 1 },
});

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseThumbnailUpload(req: AuthRequest, res: Response, next: NextFunction) {
  thumbnailUpload.single('thumbnail')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Thumbnail must be 12 MB or smaller.' });
    }
    return res.status(400).json({ error: 'Unable to read the thumbnail upload.' });
  });
}

router.get('/stats', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  const [videos, users, payments, premium, support] = await Promise.all([
    supabaseAdmin.from('videos').select('id', { count: 'exact', head: true }).eq('status', 'ready'),
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('payment_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('membership_status', 'premium'),
    supabaseAdmin.from('support_tickets').select('id'),
  ]);
  if (videos.error || users.error || payments.error || premium.error || support.error) {
    console.error('admin-stats-read-failed');
    return res.status(500).json({ error: 'Unable to load admin statistics' });
  }
  try {
    const unreadSupport = await getUnreadTicketIds(req.user!.id, (support.data || []).map((ticket) => ticket.id));
    return res.json({ total_videos: videos.count || 0, total_users: users.count || 0, pending_payments: payments.count || 0, premium_users: premium.count || 0, unread_support: unreadSupport.size });
  } catch {
    console.error('admin-support-unread-read-failed');
    return res.status(500).json({ error: 'Unable to load admin notifications' });
  }
});

router.post('/videos/:id/thumbnail', adminThumbnailUploadLimiter, verifyToken, requireAdmin, parseThumbnailUpload, async (req: AuthRequest, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Video not found.' });
  if (!mediaSigningSecret) return res.status(503).json({ error: 'Thumbnail uploads are temporarily unavailable.' });
  if (!req.file?.buffer?.length) return res.status(400).json({ error: 'Choose a thumbnail image first.' });

  const detected = await fileTypeFromBuffer(req.file.buffer);
  if (!detected || !['jpg', 'png', 'webp'].includes(detected.ext)) {
    return res.status(400).json({ error: 'Use a JPG, PNG, or WebP image.' });
  }

  let normalized: Buffer;
  try {
    normalized = await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch {
    return res.status(400).json({ error: 'The thumbnail image could not be processed.' });
  }

  const { data: video, error: videoError } = await supabaseAdmin
    .from('videos')
    .select('id')
    .eq('id', req.params.id)
    .eq('status', 'ready')
    .maybeSingle();
  if (videoError) {
    console.error('thumbnail-video-read-failed');
    return res.status(500).json({ error: 'Unable to load the video.' });
  }
  if (!video) return res.status(404).json({ error: 'Video not found.' });

  const thumbnailKey = crypto.randomUUID();
  const expires = Math.floor(Date.now() / 1000) + 5 * 60;
  const signature = signMediaKey(thumbnailKey, expires, mediaSigningSecret);
  const uploadUrl = `${mediaBaseUrl}/upload-thumbnail/${thumbnailKey}?expires=${expires}&sig=${signature}`;

  try {
    const storageResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(normalized.length) },
      body: normalized,
      signal: AbortSignal.timeout(30_000),
    });
    if (!storageResponse.ok) {
      console.error('thumbnail-storage-upload-failed');
      return res.status(502).json({ error: 'Unable to store the thumbnail.' });
    }
  } catch {
    console.error('thumbnail-storage-upload-failed');
    return res.status(502).json({ error: 'Unable to store the thumbnail.' });
  }

  const thumbnailUrl = `${mediaBaseUrl}/thumb/${thumbnailKey}.jpg`;
  const { error: updateError } = await supabaseAdmin
    .from('videos')
    .update({ thumbnail_url: thumbnailUrl })
    .eq('id', video.id);
  if (updateError) {
    console.error('thumbnail-video-update-failed');
    return res.status(500).json({ error: 'Unable to update the video thumbnail.' });
  }

  const { error: auditError } = await supabaseAdmin.from('audit_logs').insert({
    actor_id: req.user!.id,
    action: 'thumbnail_updated',
    resource_type: 'video',
    resource_id: video.id,
    details: {},
  });
  if (auditError) console.error('thumbnail-audit-failed');

  return res.json({ thumbnail_url: thumbnailUrl });
});

router.post('/videos/:id/featured', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Video not found.' });
  if (typeof req.body?.is_featured !== 'boolean') return res.status(400).json({ error: 'Featured status is required.' });

  const { data, error } = await supabaseAdmin
    .from('videos')
    .update({ is_featured: req.body.is_featured })
    .eq('id', req.params.id)
    .eq('status', 'ready')
    .select('id, is_featured')
    .maybeSingle();
  if (error) {
    console.error('video-featured-update-failed');
    return res.status(500).json({ error: 'Unable to update the featured status.' });
  }
  if (!data) return res.status(404).json({ error: 'Video not found.' });

  const { error: auditError } = await supabaseAdmin.from('audit_logs').insert({
    actor_id: req.user!.id,
    action: req.body.is_featured ? 'video_featured' : 'video_unfeatured',
    resource_type: 'video',
    resource_id: data.id,
    details: { is_featured: data.is_featured },
  });
  if (auditError) console.error('video-featured-audit-failed');

  return res.json({ is_featured: data.is_featured });
});

router.get('/support', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .select('id, user_id, subject, status, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('admin-support-list-failed');
    return res.status(500).json({ error: 'Unable to load support tickets.' });
  }
  const ids = [...new Set((data || []).map((ticket) => ticket.user_id))];
  const owners = ids.length ? await supabaseAdmin.from('users').select('id, email').in('id', ids) : { data: [], error: null };
  if (owners.error) return res.status(500).json({ error: 'Unable to load ticket owners.' });
  const emailById = new Map((owners.data || []).map((owner) => [owner.id, owner.email]));
  try {
    const unread = await getUnreadTicketIds(req.user!.id, (data || []).map((ticket) => ticket.id));
    return res.json((data || []).map((ticket) => ({ ...ticket, email: emailById.get(ticket.user_id) || 'unknown', unread: unread.has(ticket.id) })));
  } catch {
    console.error('admin-support-unread-read-failed');
    return res.status(500).json({ error: 'Unable to load support notifications.' });
  }
});

export default router;
