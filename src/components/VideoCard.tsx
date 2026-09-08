import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import type { Video } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Clock, Tag, Play, Sparkles } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { getResponsiveImageUrls, generateSrcSet, getPrimaryImageUrl } from '@/lib/imageUtils';

interface VideoCardProps {
  video: Video;
}

export function VideoCard({ video }: VideoCardProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

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
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.01
      }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, [video.thumbnail_url]);

  const responsiveUrls = getResponsiveImageUrls(video.thumbnail_url);
  const primaryUrl = getPrimaryImageUrl(video.thumbnail_url);

  return (
    <Link to={`/video/${video.id}`} className="group block">
      <Card className="overflow-hidden border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-500/30 h-full">
        {/* Large Thumbnail Section */}
        <div ref={imgRef} className="aspect-[16/10] relative overflow-hidden bg-gradient-to-br from-purple-900/20 to-blue-900/20">
          {/* Blur placeholder */}
          {!imageLoaded && imageSrc && (
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 to-blue-900/40 animate-pulse" />
          )}
          
          {/* Thumbnail Image with responsive sources */}
          {imageSrc && responsiveUrls ? (
            <picture>
              <source
                type="image/avif"
                srcSet={generateSrcSet(responsiveUrls, 'avif')}
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              <source
                type="image/webp"
                srcSet={generateSrcSet(responsiveUrls, 'webp')}
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              <img
                src={primaryUrl}
                alt={video.title}
                className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageLoaded(true)}
              />
            </picture>
          ) : imageSrc ? (
            <img
              src={imageSrc}
              alt={video.title}
              className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
            />
          ) : null}
          
          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-10">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500 rounded-full blur-2xl opacity-50" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-md border-2 border-white/60 flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300 shadow-2xl">
                <Play className="h-10 w-10 text-white ml-1.5" fill="white" />
              </div>
            </div>
          </div>

          {/* Quality Badge */}
          <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/20 z-20">
            <span className="text-xs font-semibold text-white">4K</span>
          </div>

          {/* Bottom Content Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
            <div className="transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
              {/* Title */}
              <h3 className="text-white font-bold line-clamp-2 text-lg md:text-xl mb-3 drop-shadow-2xl leading-tight">
                {video.title}
              </h3>
              
              {/* Metadata Row */}
              <div className="flex items-center gap-3 text-sm text-gray-200">
                <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="font-medium">{formatDate(video.created_at)}</span>
                </div>
                <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
                  <span className="font-medium">Exclusive</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card Footer with Tags */}
        <div className="p-5">
          {video.tags && video.tags.length > 0 && (
            <div className="flex items-start gap-2.5">
              <Tag className="h-4 w-4 text-purple-400 mt-1 flex-shrink-0" />
              <div className="flex items-center gap-2 flex-wrap">
                {video.tags.slice(0, 4).map((tag, index) => (
                  <span
                    key={index}
                    className="text-xs font-medium bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-300 px-3 py-1.5 rounded-full border border-purple-500/30 hover:border-purple-400/60 hover:bg-purple-500/30 transition-all cursor-pointer"
                  >
                    {tag}
                  </span>
                ))}
                {video.tags.length > 4 && (
                  <span className="text-xs text-gray-400 font-medium px-2">
                    +{video.tags.length - 4}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
