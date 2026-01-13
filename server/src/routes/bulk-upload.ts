import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyToken, requireAdmin, AuthRequest } from '../middleware/auth.js';
import fetch from 'node-fetch';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface JsonVideoEntry {
  title: string;
  category?: string;
  url?: string;
  downloads: Array<{
    name: string;
    link: string;
  }>;
  images: string[];
}

interface BulkUploadResponse {
  success: boolean;
  results: {
    successful: number;
    failed: number;
    errors: Array<{
      index: number;
      title: string;
      error: string;
    }>;
  };
}

// Helper function to download image from URL
async function downloadImage(imageUrl: string, uploadDir: string, baseUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const buffer = await response.buffer();
    
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const baseFilename = `thumbnail-${uniqueSuffix}`;

    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Define responsive image sizes
    const sizes = [
      { width: 400, suffix: 'small' },
      { width: 800, suffix: 'medium' },
      { width: 1200, suffix: 'large' }
    ];

    // Process and generate images in multiple formats and sizes
    for (const size of sizes) {
      const height = Math.round(size.width * 9 / 16); // 16:9 aspect ratio

      // Generate WebP version
      await sharp(buffer)
        .resize(size.width, height, { fit: 'cover', position: 'center' })
        .webp({ quality: 85 })
        .toFile(path.join(uploadDir, `${baseFilename}-${size.suffix}.webp`));

      // Generate AVIF version
      await sharp(buffer)
        .resize(size.width, height, { fit: 'cover', position: 'center' })
        .avif({ quality: 80 })
        .toFile(path.join(uploadDir, `${baseFilename}-${size.suffix}.avif`));
    }

    // Return the medium WebP URL as the primary thumbnail
    return `${baseUrl}/uploads/${baseFilename}-medium.webp`;
  } catch (error) {
    console.error('Image download error:', error);
    throw new Error(`Failed to download image from ${imageUrl}`);
  }
}

// Process single video entry
async function processVideoEntry(
  entry: JsonVideoEntry, 
  userId: string, 
  uploadDir: string,
  baseUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate entry
    if (!entry.title || !entry.images || entry.images.length === 0) {
      throw new Error('Missing required fields: title or images');
    }

    if (!entry.downloads || entry.downloads.length === 0) {
      throw new Error('No download links provided');
    }

    // Download and save the first image as thumbnail
    const thumbnailUrl = await downloadImage(entry.images[0], uploadDir, baseUrl);

    // Prepare tags from category if available
    const tags = entry.category ? [entry.category] : [];

    // Insert video
    const { data: video, error: videoError } = await supabaseAdmin
      .from('videos')
      .insert({
        title: entry.title,
        thumbnail_url: thumbnailUrl,
        tags: tags,
        created_by: userId
      })
      .select()
      .single();

    if (videoError) throw videoError;

    // Insert download links
    const linksToInsert = entry.downloads.map((download, index) => ({
      video_id: video.id,
      label: download.name,
      url: download.link,
      order: index
    }));

    const { error: linksError } = await supabaseAdmin
      .from('download_links')
      .insert(linksToInsert);

    if (linksError) throw linksError;

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Bulk upload from JSON
router.post('/json', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { videos } = req.body;

    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid request. Expected an array of videos in the request body.' 
      });
    }

    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    // Construct the base URL for uploaded files
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    const results: BulkUploadResponse['results'] = {
      successful: 0,
      failed: 0,
      errors: []
    };

    // Process each video entry
    for (let i = 0; i < videos.length; i++) {
      const entry = videos[i];
      console.log(`Processing video ${i + 1}/${videos.length}: ${entry.title}`);

      const result = await processVideoEntry(entry, req.user!.id, uploadDir, baseUrl);

      if (result.success) {
        results.successful++;
      } else {
        results.failed++;
        results.errors.push({
          index: i,
          title: entry.title || 'Unknown',
          error: result.error || 'Unknown error'
        });
      }
    }

    const response: BulkUploadResponse = {
      success: results.failed === 0,
      results
    };

    res.json(response);
  } catch (error: any) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ 
      error: 'Failed to process bulk upload',
      details: error.message 
    });
  }
});

export default router;
