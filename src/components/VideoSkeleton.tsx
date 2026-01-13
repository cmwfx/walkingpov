import { Card } from '@/components/ui/card';

export function VideoSkeleton() {
  return (
    <Card className="overflow-hidden border-white/10 bg-white/5 backdrop-blur-sm h-full">
      <div className="aspect-[16/10] bg-gradient-to-br from-purple-900/20 to-blue-900/20 animate-pulse relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
        {/* Skeleton badges */}
        <div className="absolute top-4 right-4 w-24 h-8 bg-white/10 rounded-full" />
        <div className="absolute top-4 left-4 w-12 h-7 bg-white/10 rounded-lg" />
        {/* Skeleton title area */}
        <div className="absolute bottom-0 left-0 right-0 p-5 space-y-2">
          <div className="h-6 bg-white/20 rounded w-3/4 animate-pulse" />
          <div className="h-6 bg-white/20 rounded w-1/2 animate-pulse" />
          <div className="flex gap-2 mt-3">
            <div className="h-7 bg-white/20 rounded-full w-24 animate-pulse" />
            <div className="h-7 bg-white/20 rounded-full w-20 animate-pulse" />
          </div>
        </div>
      </div>
      <div className="p-5">
        <div className="flex gap-2">
          <div className="h-7 bg-white/10 rounded-full animate-pulse w-16" />
          <div className="h-7 bg-white/10 rounded-full animate-pulse w-20" />
          <div className="h-7 bg-white/10 rounded-full animate-pulse w-14" />
        </div>
      </div>
    </Card>
  );
}

export function VideoGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
      {Array.from({ length: 6 }).map((_, i) => (
        <VideoSkeleton key={i} />
      ))}
    </div>
  );
}
