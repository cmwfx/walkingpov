import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { Video, VideoPreview } from '@/lib/supabase';
import { getDownloadUrl, getVideo, getVideoPreview, updateVideoThumbnail } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { PremiumBenefits } from '@/components/PremiumBenefits';
import { PremiumFaq } from '@/components/PremiumFaq';
import { DiscountTimer } from '@/components/DiscountTimer';
import { Download, Lock, Tag, Crown, ArrowLeft, ImagePlus, Sparkles } from 'lucide-react';
import { getResponsiveImageUrls, generateSrcSet, getPrimaryImageUrl } from '@/lib/imageUtils';
import { VideoPreviewPlayer } from '@/components/VideoPreviewPlayer';
import { trackAnalyticsEvent } from '@/lib/analytics';

type DownloadLink = { id: string; label: string; url: string };

export function VideoDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const currentVideoId = useRef<string | null>(id || null);
  const [video, setVideo] = useState<Video | null>(null);
  const [preview, setPreview] = useState<VideoPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadLinks, setDownloadLinks] = useState<DownloadLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const { isPremium, isAdmin, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const canAccessDownloads = isPremium || isAdmin;

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    if (video?.id === id) trackAnalyticsEvent('video_detail_view', { content_type: 'video' });
  }, [id, video?.id]);

  const backToBrowse = () => {
    const routeState = location.state as { from?: unknown } | null;
    const from = typeof routeState?.from === 'string' && routeState.from.startsWith('/') && !routeState.from.startsWith('//')
      ? routeState.from
      : null;
    if (!from) {
      navigate('/');
      return;
    }

    let hasSavedPosition = false;
    try {
      const saved = sessionStorage.getItem('candidfan:browse-return');
      if (saved) hasSavedPosition = (JSON.parse(saved) as { from?: string }).from === from;
    } catch {
      // Fall back to the known browse route if storage is unavailable.
    }

    if (hasSavedPosition) navigate(-1);
    else navigate(from);
  };

  useEffect(() => {
    currentVideoId.current = id || null;
    if (id) {
      fetchVideo(id);
      setDownloadLinks([]);
      setLinksLoading(false);
      if (canAccessDownloads) fetchDownloadLinks(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, canAccessDownloads]);

  useEffect(() => {
    setPreview(null);
    if (!id) return;
    let active = true;
    getVideoPreview(id).then((data) => {
      if (active) setPreview(data);
    }).catch(() => {
      if (active) setPreview(null);
    });
    return () => { active = false; };
  }, [id]);

  const fetchVideo = async (videoId: string) => {
    setLoading(true);
    try {
      const data = await getVideo(videoId);
      if (currentVideoId.current === videoId) {
        setVideo(data);
        setImageLoaded(false);
      }
    } catch {
      if (currentVideoId.current === videoId) {
        toast({
          title: 'Error',
          description: 'Failed to load video',
          variant: 'destructive',
        });
      }
    } finally {
      if (currentVideoId.current === videoId) setLoading(false);
    }
  };

  const handleThumbnailUpload = async () => {
    if (!id || !thumbnailFile) return;
    setThumbnailUploading(true);
    try {
      const result = await updateVideoThumbnail(id, thumbnailFile);
      setVideo((current) => current ? { ...current, thumbnail_url: result.thumbnail_url } : current);
      setThumbnailFile(null);
      toast({ title: 'Thumbnail updated', description: 'The new thumbnail is now live.' });
    } catch (error) {
      toast({
        title: 'Thumbnail update failed',
        description: error instanceof Error ? error.message : 'Unable to update the thumbnail.',
        variant: 'destructive',
      });
    } finally {
      setThumbnailUploading(false);
    }
  };

  const fetchDownloadLinks = async (videoId: string) => {
    setLinksLoading(true);
    try {
      const { url } = await getDownloadUrl(videoId);
      if (currentVideoId.current === videoId) setDownloadLinks([{ id: 'download', label: 'Download MP4', url }]);
    } catch (error) {
      if (currentVideoId.current === videoId) console.error('Error fetching download links:', error);
    } finally {
      if (currentVideoId.current === videoId) setLinksLoading(false);
    }
  };

  if (loading || (id && video?.id !== id)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Video not found</h1>
        <Link to="/">
          <Button>Back to Home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" className="mb-4" onClick={backToBrowse}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Browse
        </Button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              {preview ? (
                <VideoPreviewPlayer
                  key={preview.url}
                  preview={preview}
                  title={video.title}
                  canDownload={canAccessDownloads}
                  premiumActionHref={isAuthenticated ? '/payment' : '/signup'}
                  downloadUrl={downloadLinks[0]?.url}
                />
              ) : (
              <div className="aspect-video relative overflow-hidden bg-muted rounded-t-xl">
                {/* Blur placeholder */}
                {!imageLoaded && (
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 to-blue-900/40 animate-pulse" />
                )}
                
                {/* Responsive thumbnail image */}
                {(() => {
                  const responsiveUrls = getResponsiveImageUrls(video.thumbnail_url);
                  const primaryUrl = getPrimaryImageUrl(video.thumbnail_url);

                  return responsiveUrls ? (
                    <picture>
                      <source
                        type="image/avif"
                        srcSet={generateSrcSet(responsiveUrls, 'avif')}
                        sizes="(max-width: 1024px) 100vw, 66vw"
                      />
                      <source
                        type="image/webp"
                        srcSet={generateSrcSet(responsiveUrls, 'webp')}
                        sizes="(max-width: 1024px) 100vw, 66vw"
                      />
                      <img
                        src={primaryUrl}
                        alt={video.title}
                        className={`w-full h-full object-contain transition-opacity duration-500 ${
                          imageLoaded ? 'opacity-100' : 'opacity-0'
                        }`}
                        onLoad={() => setImageLoaded(true)}
                        onError={() => setImageLoaded(true)}
                      />
                    </picture>
                  ) : (
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className={`w-full h-full object-contain transition-opacity duration-500 ${
                        imageLoaded ? 'opacity-100' : 'opacity-0'
                      }`}
                      onLoad={() => setImageLoaded(true)}
                      onError={() => setImageLoaded(true)}
                    />
                  );
                })()}
              </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl md:text-3xl">{video.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {video.tags && video.tags.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground mt-1" />
                    <div className="flex flex-wrap gap-2">
                      {video.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {isAdmin && (
              <Card className="border-amber-400/20 bg-amber-400/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ImagePlus className="h-5 w-5 text-amber-300" />
                    Edit thumbnail
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Upload a JPG, PNG, or WebP image to replace the current thumbnail.</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setThumbnailFile(event.target.files?.[0] || null)}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
                  />
                  <Button type="button" disabled={!thumbnailFile || thumbnailUploading} onClick={() => void handleThumbnailUpload()}>
                    <ImagePlus className="mr-2 h-4 w-4" />
                    {thumbnailUploading ? 'Uploading...' : 'Upload thumbnail'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Download Links Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Download Links
                </CardTitle>
              </CardHeader>
              <CardContent>
                {canAccessDownloads ? (
                  linksLoading ? <div className="flex justify-center py-8"><div className="size-8 animate-spin rounded-full border-b-2 border-primary" /></div>
                    : downloadLinks.length > 0 ? <div className="space-y-3">{downloadLinks.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" onClick={() => trackAnalyticsEvent('download_link_click', { link_type: 'video_download' })} className="block"><Button variant="outline" className="w-full justify-start"><Download className="mr-2 size-4" />{link.label}</Button></a>)}</div>
                      : <p className="py-4 text-center text-sm text-muted-foreground">No download links available yet</p>
                ) : (
                  <div className="py-4 space-y-6">
                    <div className="text-center space-y-2">
                      <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 mb-2 ring-1 ring-primary/20">
                        <Lock className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
                        Premium Content
                      </h3>
                    </div>

                    <PremiumBenefits />

                    {isAuthenticated ? (
                      <Link to="/payment" onClick={() => trackAnalyticsEvent('premium_cta_click', { cta_location: 'download_sidebar' })}>
                        <Button className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 transition-all shadow-lg shadow-primary/25">
                          <Crown className="h-4 w-4 mr-2" />
                          Unlock from €50
                        </Button>
                      </Link>
                    ) : (
                      <div className="space-y-3">
                        <Link to="/signup" onClick={() => trackAnalyticsEvent('premium_cta_click', { cta_location: 'download_sidebar' })}>
                          <Button className="w-full h-auto py-4 flex-col gap-1 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 transition-all shadow-lg shadow-primary/25">
                            <div className="flex items-center gap-2 font-bold text-lg">
                              <Crown className="h-5 w-5" /> Get Lifetime Access - €50
                            </div>
                            <div className="flex items-center gap-2 text-xs opacity-90"><span className="line-through opacity-70">€200</span><span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">75% OFF</span></div>
                          </Button>
                        </Link>
                        <Link to="/login">
                          <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground text-sm">
                            Already a member? Login
                          </Button>
                        </Link>
                      </div>
                    )}
                    <div className="flex justify-center pt-2"><Sparkles className="mr-2 size-4 text-yellow-500" /><DiscountTimer /></div>
                  </div>
                )}
              </CardContent>
            </Card>
            {!canAccessDownloads && <PremiumFaq className="mt-6" />}
          </div>
        </div>
      </div>
    </div>
  );
}
