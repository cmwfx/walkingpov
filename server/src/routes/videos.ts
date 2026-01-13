import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyToken, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get all videos with pagination (public)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    const searchTag = req.query.tag as string;

    let query = supabaseAdmin
      .from('videos')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (searchTag) {
      query = query.contains('tags', [searchTag]);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      videos: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// Get single video by ID (public)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('videos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// Get download links for a video (requires premium or admin)
router.get('/:id/downloads', verifyToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Check user membership status
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('membership_status, is_admin')
      .eq('id', req.user!.id)
      .single();

    if (userError) throw userError;

    if (!userData.is_admin && userData.membership_status !== 'premium') {
      return res.status(403).json({ 
        error: 'Premium membership required to access download links' 
      });
    }

    const { data, error } = await supabaseAdmin
      .from('download_links')
      .select('*')
      .eq('video_id', id)
      .order('order', { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Get download links error:', error);
    res.status(500).json({ error: 'Failed to fetch download links' });
  }
});

// Create new video (admin only)
router.post('/', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { title, thumbnail_url, tags, download_links } = req.body;

    if (!title || !thumbnail_url) {
      return res.status(400).json({ error: 'Title and thumbnail are required' });
    }

    // Insert video
    const { data: video, error: videoError } = await supabaseAdmin
      .from('videos')
      .insert({
        title,
        thumbnail_url,
        tags: tags || [],
        created_by: req.user!.id
      })
      .select()
      .single();

    if (videoError) throw videoError;

    // Insert download links if provided
    if (download_links && download_links.length > 0) {
      const linksToInsert = download_links.map((link: any, index: number) => ({
        video_id: video.id,
        label: link.label,
        url: link.url,
        order: index
      }));

      const { error: linksError } = await supabaseAdmin
        .from('download_links')
        .insert(linksToInsert);

      if (linksError) throw linksError;
    }

    res.status(201).json(video);
  } catch (error) {
    console.error('Create video error:', error);
    res.status(500).json({ error: 'Failed to create video' });
  }
});

// Update video (admin only)
router.put('/:id', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { title, thumbnail_url, tags } = req.body;

    const { data, error } = await supabaseAdmin
      .from('videos')
      .update({ title, thumbnail_url, tags })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Update video error:', error);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

// Delete video (admin only)
router.delete('/:id', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('videos')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

export default router;
