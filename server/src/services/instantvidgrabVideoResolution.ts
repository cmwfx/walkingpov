import { createHash } from 'node:crypto';

const walkingPOVUserIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const instantVidGrabUserIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;
const videoIdPattern = walkingPOVUserIdPattern;
const mediaKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MEDIA_LINK_VALIDITY_SECONDS = 60 * 60;

export type VideoResolutionStore = {
  readIdentityLink(walkingpovUserId: string): Promise<{
    instantvidgrabUserId: string;
    state: string;
  } | null>;
  readUser(walkingpovUserId: string): Promise<{
    membershipStatus: string;
    isAdmin: boolean;
  } | null>;
  readReadyVideo(videoId: string): Promise<{ updatedAt: string } | null>;
  readMediaAsset(videoId: string): Promise<{
    storageKey: string;
    contentType: string;
    sizeBytes: number;
  } | null>;
};

export class VideoResolutionError extends Error {
  readonly status: 400 | 403 | 404 | 409 | 503;
  readonly code: string;

  constructor(status: VideoResolutionError['status'], code: string) {
    super('This video is not available for download.');
    this.name = 'VideoResolutionError';
    this.status = status;
    this.code = code;
  }
}

function safeMediaOrigin(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new VideoResolutionError(503, 'media_unavailable');
  }
  const localDevelopmentHost = process.env.NODE_ENV !== 'production'
    && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !localDevelopmentHost)
    || url.username
    || url.password
    || url.pathname !== '/'
    || url.search
    || url.hash
    || !(url.hostname === 'media.candidfan.com' || url.hostname.endsWith('.candidfan.com') || localDevelopmentHost)
  ) {
    throw new VideoResolutionError(503, 'media_unavailable');
  }
  return url.origin;
}

export async function resolveAuthorizedWalkingPOVVideo(input: {
  walkingpovUserId: string;
  instantvidgrabUserId: string;
  videoId: string;
  mediaOrigin: string;
  mediaSigningSecret: string;
  now?: Date;
  store: VideoResolutionStore;
  signMediaKey: (key: string, expires: number, secret: string) => string;
}) {
  if (
    !walkingPOVUserIdPattern.test(input.walkingpovUserId)
    || !instantVidGrabUserIdPattern.test(input.instantvidgrabUserId)
    || !videoIdPattern.test(input.videoId)
  ) {
    throw new VideoResolutionError(400, 'invalid_video_request');
  }
  if (input.mediaSigningSecret.length < 32) throw new VideoResolutionError(503, 'media_unavailable');

  const link = await input.store.readIdentityLink(input.walkingpovUserId);
  if (!link || link.state !== 'verified' || link.instantvidgrabUserId !== input.instantvidgrabUserId) {
    throw new VideoResolutionError(409, 'identity_link_conflict');
  }

  const user = await input.store.readUser(input.walkingpovUserId);
  if (!user || (!user.isAdmin && user.membershipStatus !== 'premium')) {
    throw new VideoResolutionError(403, 'walkingpov_access_required');
  }

  const video = await input.store.readReadyVideo(input.videoId);
  if (!video) throw new VideoResolutionError(404, 'video_not_found');
  const asset = await input.store.readMediaAsset(input.videoId);
  if (
    !asset
    || !mediaKeyPattern.test(asset.storageKey)
    || asset.contentType.toLowerCase() !== 'video/mp4'
    || !Number.isSafeInteger(asset.sizeBytes)
    || asset.sizeBytes <= 0
    || !video.updatedAt
  ) {
    throw new VideoResolutionError(404, 'video_not_found');
  }

  const mediaOrigin = safeMediaOrigin(input.mediaOrigin);
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1_000);
  const expires = nowSeconds + MEDIA_LINK_VALIDITY_SECONDS;
  const signature = input.signMediaKey(asset.storageKey, expires, input.mediaSigningSecret);
  const downloadUrl = new URL(`/download/${encodeURIComponent(asset.storageKey)}`, mediaOrigin);
  downloadUrl.searchParams.set('expires', String(expires));
  downloadUrl.searchParams.set('sig', signature);
  const sourceVersion = createHash('sha256')
    .update(`${input.videoId}\n${asset.storageKey}\n${asset.sizeBytes}\n${video.updatedAt}`, 'utf8')
    .digest('hex');

  return {
    downloadUrl: downloadUrl.toString(),
    expiresAt: new Date(expires * 1_000).toISOString(),
    sizeBytes: asset.sizeBytes,
    contentType: 'video/mp4' as const,
    sourceVersion,
    etag: null,
    lastModified: null,
  };
}
