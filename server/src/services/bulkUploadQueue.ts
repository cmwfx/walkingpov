import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import fetch from 'node-fetch';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export interface BulkUploadJob {
  id: string;
  userId: string;
  totalVideos: number;
  processed: number;
  successful: number;
  failed: number;
  status: 'processing' | 'completed' | 'failed';
  errors: Array<{
    index: number;
    title: string;
    error: string;
  }>;
  startedAt: Date;
  completedAt?: Date;
}

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

class BulkUploadQueue {
  private jobs: Map<string, BulkUploadJob> = new Map();
  private processingQueue: Array<{
    jobId: string;
    videos: JsonVideoEntry[];
    userId: string;
    uploadDir: string;
    baseUrl: string;
  }> = [];
  private isProcessing = false;
  private readonly JOB_RETENTION_MS = 60 * 60 * 1000; // 1 hour
  private readonly MAX_CONCURRENT_JOBS = 100;

  constructor() {
    // Start cleanup interval
    setInterval(() => this.cleanupOldJobs(), 5 * 60 * 1000); // Every 5 minutes
  }

  createJob(
    videos: JsonVideoEntry[],
    userId: string,
    uploadDir: string,
    baseUrl: string
  ): string {
    // Check concurrent job limit
    const activeJobs = Array.from(this.jobs.values()).filter(
      job => job.status === 'processing'
    );

    if (activeJobs.length >= this.MAX_CONCURRENT_JOBS) {
      throw new Error('Too many concurrent uploads. Please try again later.');
    }

    const jobId = randomUUID();
    const job: BulkUploadJob = {
      id: jobId,
      userId,
      totalVideos: videos.length,
      processed: 0,
      successful: 0,
      failed: 0,
      status: 'processing',
      errors: [],
      startedAt: new Date(),
    };

    this.jobs.set(jobId, job);
    this.processingQueue.push({ jobId, videos, userId, uploadDir, baseUrl });

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return jobId;
  }

  getJob(jobId: string): BulkUploadJob | undefined {
    return this.jobs.get(jobId);
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const queueItem = this.processingQueue.shift();
      if (!queueItem) break;

      await this.processJob(queueItem);
    }

    this.isProcessing = false;
  }

  private validateImageUrl(url: string): void {
    try {
      const parsedUrl = new URL(url);

      // Whitelist allowed protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol. Only HTTP/HTTPS allowed.');
      }

      // Blacklist private IP ranges
      const hostname = parsedUrl.hostname;
      const privateIpRanges = [
        /^127\./, // Loopback
        /^10\./, // Private Class A
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private Class B
        /^192\.168\./, // Private Class C
        /^169\.254\./, // Link-local
        /^::1$/, // IPv6 loopback
        /^fe80:/i, // IPv6 link-local
        /^fc00:/i, // IPv6 unique local
      ];

      if (privateIpRanges.some(regex => regex.test(hostname))) {
        throw new Error('Private IP addresses not allowed.');
      }

      // Blacklist cloud metadata endpoints
      const blockedHosts = [
        'metadata.google.internal',
        '169.254.169.254',
        'metadata',
        'metadata.azure.com',
        'metadata.aws.com',
      ];

      if (blockedHosts.some(host => hostname.toLowerCase().includes(host))) {
        throw new Error('Blocked hostname.');
      }

      // Blacklist localhost
      if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
        throw new Error('Localhost access not allowed.');
      }

    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Invalid URL format.');
      }
      throw error;
    }
  }

  private async processJob(queueItem: {
    jobId: string;
    videos: JsonVideoEntry[];
    userId: string;
    uploadDir: string;
    baseUrl: string;
  }) {
    const job = this.jobs.get(queueItem.jobId);
    if (!job) return;

    const { videos, userId, uploadDir, baseUrl } = queueItem;
    const BATCH_SIZE = 5;

    try {
      for (let i = 0; i < videos.length; i += BATCH_SIZE) {
        const batch = videos.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map((entry, batchIndex) => {
          const globalIndex = i + batchIndex;
          console.log(`[Job ${job.id}] Processing video ${globalIndex + 1}/${videos.length}: ${entry.title}`);
          return this.processVideoEntry(entry, userId, uploadDir, baseUrl)
            .then(result => ({ ...result, index: globalIndex, title: entry.title }));
        });

        const batchResults = await Promise.all(batchPromises);

        // Update job progress after each batch
        batchResults.forEach(result => {
          job.processed++;
          if (result.success) {
            job.successful++;
          } else {
            job.failed++;
            job.errors.push({
              index: result.index,
              title: result.title || 'Unknown',
              error: result.error || 'Unknown error',
            });
          }
        });

        // Update job in map
        this.jobs.set(job.id, { ...job });
      }

      // Mark job as completed
      job.status = 'completed';
      job.completedAt = new Date();
      this.jobs.set(job.id, { ...job });
      console.log(`[Job ${job.id}] Completed: ${job.successful} successful, ${job.failed} failed`);
    } catch (error: any) {
      console.error(`[Job ${job.id}] Fatal error:`, error);
      job.status = 'failed';
      job.completedAt = new Date();
      this.jobs.set(job.id, { ...job });
    }
  }

  private async downloadImage(imageUrl: string, uploadDir: string, baseUrl: string): Promise<string> {
    try {
      // Validate URL to prevent SSRF attacks
      this.validateImageUrl(imageUrl);

      const response = await fetch(imageUrl, {
        timeout: 10000, // 10 second timeout
      } as any);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Generate unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const baseFilename = `thumbnail-${uniqueSuffix}`;

      // Ensure upload directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Define responsive image sizes
      const sizes = [
        { width: 400, suffix: 'small' },
        { width: 800, suffix: 'medium' },
        { width: 1200, suffix: 'large' },
      ];

      // Parallelize image generation for better performance
      const imagePromises = sizes.flatMap(size => {
        const height = Math.round(size.width * 9 / 16); // 16:9 aspect ratio

        return [
          // Generate WebP version
          sharp(buffer)
            .resize(size.width, height, { fit: 'cover', position: 'center' })
            .webp({ quality: 85 })
            .toFile(path.join(uploadDir, `${baseFilename}-${size.suffix}.webp`)),

          // Generate AVIF version
          sharp(buffer)
            .resize(size.width, height, { fit: 'cover', position: 'center' })
            .avif({ quality: 80 })
            .toFile(path.join(uploadDir, `${baseFilename}-${size.suffix}.avif`)),
        ];
      });

      await Promise.all(imagePromises);

      // Return the medium WebP URL as the primary thumbnail
      return `${baseUrl}/uploads/${baseFilename}-medium.webp`;
    } catch (error) {
      console.error('Image download error:', error);
      throw new Error(`Failed to download image from ${imageUrl}`);
    }
  }

  private async processVideoEntry(
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
      const thumbnailUrl = await this.downloadImage(entry.images[0], uploadDir, baseUrl);

      // Prepare tags from category if available
      const tags = entry.category ? [entry.category] : [];

      // Insert video
      const { data: video, error: videoError } = await supabaseAdmin
        .from('videos')
        .insert({
          title: entry.title,
          thumbnail_url: thumbnailUrl,
          tags: tags,
          created_by: userId,
        })
        .select()
        .single();

      if (videoError) throw videoError;

      // Insert download links
      const linksToInsert = entry.downloads.map((download, index) => ({
        video_id: video.id,
        label: download.name,
        url: download.link,
        order: index,
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

  private cleanupOldJobs() {
    const now = Date.now();
    const jobsToDelete: string[] = [];

    for (const [jobId, job] of this.jobs.entries()) {
      // Only cleanup completed/failed jobs
      if (job.status !== 'processing') {
        const jobAge = now - job.startedAt.getTime();
        if (jobAge > this.JOB_RETENTION_MS) {
          jobsToDelete.push(jobId);
        }
      }
    }

    jobsToDelete.forEach(jobId => {
      console.log(`Cleaning up old job: ${jobId}`);
      this.jobs.delete(jobId);
    });

    if (jobsToDelete.length > 0) {
      console.log(`Cleaned up ${jobsToDelete.length} old job(s)`);
    }
  }
}

// Singleton instance
export const bulkUploadQueue = new BulkUploadQueue();
