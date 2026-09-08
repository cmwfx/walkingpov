import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import type { Video } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { setVideoFeatured } from '@/lib/api';
import { Tag, Play, Sparkles, Heart } from 'lucide-react';
import { getResponsiveImageUrls, generateSrcSet, getPrimaryImageUrl } from '@/lib/imageUtils';
import { useToast } from '@/components/ui/use-toast';

interface VideoCardProps {
  video: Video;
  onFeaturedChange?: (videoId: string, isFeatured: boolean) => void;
}

export function VideoCard({ video, onFeaturedChange }: VideoCardProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [featuredBusy, setFeaturedBusy] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setImageSrc(video.thumbnail_url);
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '50px', threshold: 0.01 },
    );

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [video.thumbnail_url]);

  const responsiveUrls = getResponsiveImageUrls(video.thumbnail_url);
  const primaryUrl = getPrimaryImageUrl(video.thumbnail_url);

  const toggleFeatured = async () => {
    if (featuredBusy) return;
    const nextValue = !video.is_featured;
    setFeaturedBusy(true);
    try {
      const result = await setVideoFeatured(video.id, nextValue);
      onFeaturedChange?.(video.id, result.is_featured);
    } catch (reason) {
      toast({
        title: 'Unable to update featured posts',
        description: reason instanceof Error ? reason.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setFeaturedBusy(false);
    }
  };

  return (
    <div className="group relative h-full">
      <Card className="relative overflow-hidden border-white/10 bg-white/5 backdrop-blur-sm transition-all duration-500 hover:bg-white/10 hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-500/30">
        <Link to={`/video/${video.id}`} className="block">
        <div ref={imgRef} className="aspect-[16/10] relative overflow-hidden bg-gradient-to-br from-purple-900/20 to-blue-900/20">
          {!imageLoaded && imageSrc && <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 to-blue-900/40 animate-pulse" />}

          {imageSrc && responsiveUrls ? (
            <picture>
              <source type="image/avif" srcSet={generateSrcSet(responsiveUrls, 'avif')} sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" />
              <source type="image/webp" srcSet={generateSrcSet(responsiveUrls, 'webp')} sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" />
              <img src={primaryUrl} alt={video.title} className={`h-full w-full object-contain transition-opacity duration-700 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`} onLoad={() => setImageLoaded(true)} onError={() => setImageLoaded(true)} />
            </picture>
          ) : imageSrc ? (
            <img src={imageSrc} alt={video.title} className={`h-full w-full object-contain transition-opacity duration-700 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`} onLoad={() => setImageLoaded(true)} onError={() => setImageLoaded(true)} />
          ) : null}

          <div className="absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-purple-500 opacity-50 blur-2xl" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/60 bg-gradient-to-br from-white/30 to-white/10 shadow-2xl backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
                <Play className="ml-1.5 h-10 w-10 text-white" fill="white" />
              </div>
            </div>
          </div>

          <div className="absolute left-4 top-4 z-20 rounded-lg border border-white/20 bg-black/60 px-3 py-1.5 backdrop-blur-md">
            <span className="text-xs font-semibold text-white">4K</span>
          </div>

        </div>
        </Link>

        {isAdmin && (
          <button type="button" aria-label={video.is_featured ? 'Remove featured status' : 'Feature this post'} aria-pressed={video.is_featured} disabled={featuredBusy} onClick={() => void toggleFeatured()} className={`absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition ${video.is_featured ? 'border-rose-300/50 bg-rose-500/25 text-rose-200' : 'border-white/20 bg-black/60 text-white hover:border-rose-300/50 hover:bg-rose-500/20 hover:text-rose-200'} disabled:cursor-wait disabled:opacity-60`}>
            <Heart className="h-5 w-5" fill={video.is_featured ? 'currentColor' : 'none'} />
          </button>
        )}
      </Card>

      <Link to={`/video/${video.id}`} className="block px-1 pt-4">
        {video.is_featured && !isAdmin && (
          <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-yellow-300/30 bg-yellow-300/10 px-3 py-1 text-xs font-medium text-yellow-200">
            <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
            <span>Featured</span>
          </div>
        )}
        <h3 className="mb-3 line-clamp-2 text-lg font-bold leading-tight text-white md:text-xl">{video.title}</h3>
        <div className="mb-4 flex items-center gap-3 text-sm text-gray-200">
          <div className="flex items-center gap-1 rounded-full bg-black/30 px-3 py-1 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
            <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
            <span className="font-medium">Exclusive</span>
          </div>
        </div>
        {video.tags && video.tags.length > 0 && (
          <div className="flex items-start gap-2.5">
            <Tag className="mt-1 h-4 w-4 flex-shrink-0 text-purple-400" />
            <div className="flex flex-wrap items-center gap-2">
              {video.tags.slice(0, 4).map((tag, index) => (
                <span key={index} className="rounded-full border border-purple-500/30 bg-gradient-to-r from-purple-500/20 to-blue-500/20 px-3 py-1.5 text-xs font-medium text-purple-300 transition-all hover:border-purple-400/60 hover:bg-purple-500/30">{tag}</span>
              ))}
              {video.tags.length > 4 && <span className="px-2 text-xs font-medium text-gray-400">+{video.tags.length - 4}</span>}
            </div>
          </div>
        )}
      </Link>
    </div>
  );
}
