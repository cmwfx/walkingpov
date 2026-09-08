import { createHash } from 'node:crypto';
import { lstat, opendir } from 'node:fs/promises';
import path from 'node:path';

const originalsDir = path.resolve(process.env.ORIGINALS_DIR || '/root/videos');
const thumbnailDir = path.resolve(process.env.THUMBNAIL_DIR || process.cwd());
const websiteUrl = (process.env.WEBSITE_INTERNAL_URL || 'https://candidfan.com').replace(/\/$/, '');
const importerToken = process.env.IMPORTER_TOKEN || '';
const mediaBaseUrl = (process.env.MEDIA_BASE_URL || 'https://media.candidfan.com').replace(/\/$/, '');
const imageExtensions = new Set(['.avif', '.bmp', '.gif', '.ico', '.jfif', '.jpeg', '.jpg', '.png', '.tif', '.tiff', '.webp']);

if (!importerToken) throw new Error('IMPORTER_TOKEN is required');

function matchKey(value) {
  return path.parse(value).name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function sourceIdentity(relative, size, mtimeMs) {
  return createHash('sha256').update(`${relative}\0${size}\0${mtimeMs}`).digest('hex');
}

async function walk(root, relativeRoot, predicate) {
  const result = [];
  async function visit(directory, relativeDirectory) {
    const handle = await opendir(directory);
    for await (const entry of handle) {
      const absolute = path.join(directory, entry.name);
      const relative = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) await visit(absolute, relative);
      else if (entry.isFile() && predicate(entry.name)) result.push({ absolute, relative });
    }
  }
  await visit(root, relativeRoot);
  return result;
}

async function updateThumbnail(video, image) {
  const details = await lstat(video.absolute);
  const identity = sourceIdentity(video.relative, details.size, details.mtimeMs);
  const imageUrl = `${mediaBaseUrl}/thumb/${image.relative.split(path.sep).map(encodeURIComponent).join('/')}`;
  const response = await fetch(`${websiteUrl}/api/import/items/thumbnail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${importerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ source_identity: identity, thumbnail_url: imageUrl }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) return false;
  return true;
}

const videos = await walk(originalsDir, '', (name) => path.extname(name).toLowerCase() === '.mp4');
const images = await walk(thumbnailDir, '', (name) => {
  const lower = name.toLowerCase();
  return name !== 'placeholder.jpg' && imageExtensions.has(path.extname(lower));
});

const videoByKey = new Map();
const imageByKey = new Map();
for (const video of videos) {
  const key = matchKey(video.relative);
  const entries = videoByKey.get(key) || [];
  entries.push(video);
  videoByKey.set(key, entries);
}
for (const image of images) {
  const key = matchKey(image.relative);
  const entries = imageByKey.get(key) || [];
  entries.push(image);
  imageByKey.set(key, entries);
}

let matches = 0;
let updated = 0;
let missingImages = 0;
let ambiguous = 0;
let errors = 0;
for (const [key, matchingVideos] of videoByKey) {
  const matchingImages = imageByKey.get(key) || [];
  if (matchingVideos.length !== 1 || matchingImages.length !== 1) {
    if (matchingImages.length === 0) missingImages += matchingVideos.length;
    else ambiguous += matchingVideos.length;
    continue;
  }
  matches += 1;
  try {
    if (await updateThumbnail(matchingVideos[0], matchingImages[0])) updated += 1;
    else errors += 1;
  } catch {
    errors += 1;
  }
}

console.log(`thumbnail_sync_videos=${videos.length}`);
console.log(`thumbnail_sync_images=${images.length}`);
console.log(`thumbnail_sync_matches=${matches}`);
console.log(`thumbnail_sync_updated=${updated}`);
console.log(`thumbnail_sync_missing_images=${missingImages}`);
console.log(`thumbnail_sync_ambiguous=${ambiguous}`);
console.log(`thumbnail_sync_errors=${errors}`);
