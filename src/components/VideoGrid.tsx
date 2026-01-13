import type { Video } from '@/lib/supabase';
import { VideoCard } from './VideoCard';
import { Film } from 'lucide-react';

interface VideoGridProps {
  videos: Video[];
}

export function VideoGrid({ videos }: VideoGridProps) {
  if (videos.length === 0) {
    return (
      <div className="text-center py-24">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 mb-6">
          <Film className="h-10 w-10 text-gray-400" />
        </div>
        <p className="text-gray-400 text-lg mb-2">No videos found</p>
        <p className="text-gray-500 text-sm">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}
