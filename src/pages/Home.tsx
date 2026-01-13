import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { VideoGrid } from '@/components/VideoGrid';
import { VideoGridSkeleton } from '@/components/VideoSkeleton';
import { Pagination } from '@/components/Pagination';
import { Input } from '@/components/ui/input';
import type { Video } from '@/lib/supabase';
import { getVideos } from '@/lib/api';
import { Search, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [videos, setVideos] = useState<Video[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchTag, setSearchTag] = useState('');
  const { toast } = useToast();

  // Read initial state from URL
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const filterTag = searchParams.get('tag') || '';

  useEffect(() => {
    // Sync search input with URL filter tag
    if (filterTag) {
      setSearchTag(filterTag);
    }
  }, [filterTag]);

  useEffect(() => {
    fetchVideos(currentPage, filterTag);
  }, [currentPage, filterTag]);

  const fetchVideos = async (page: number, tag?: string) => {
    setLoading(true);
    try {
      const data = await getVideos(page, tag);
      setVideos(data.videos);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load videos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const newParams = new URLSearchParams();
    if (searchTag) {
      newParams.set('tag', searchTag);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handlePageChange = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', page.toString());
    setSearchParams(newParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearFilter = () => {
    setSearchTag('');
    setSearchParams(new URLSearchParams());
  };

  return (
    <div className="min-h-screen">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900" />
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob" />
        <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Search Bar */}
        <div className="max-w-4xl mx-auto mb-12 pt-4">
          <form onSubmit={handleSearch} className="relative">
            <div className="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden hover:bg-white/10 transition-all">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search videos by tag or category..."
                value={searchTag}
                onChange={(e) => setSearchTag(e.target.value)}
                className="pl-12 pr-12 py-6 bg-transparent border-0 text-white placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-purple-500"
              />
              {filterTag && (
                <button
                  type="button"
                  onClick={clearFilter}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-white transition-colors"
                  aria-label="Clear search"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            {filterTag && (
              <p className="text-sm text-gray-400 mt-2">
                Showing results for:{' '}
                <span className="font-semibold text-purple-400">{filterTag}</span>
              </p>
            )}
          </form>
        </div>

        {/* Video Grid */}
        <div>
          {loading ? (
            <VideoGridSkeleton />
          ) : videos.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-gray-400 text-lg mb-4">No videos found</div>
              {filterTag && (
                <button
                  onClick={clearFilter}
                  className="text-purple-400 hover:text-purple-300 underline"
                >
                  Clear search and show all videos
                </button>
              )}
            </div>
          ) : (
            <>
              <VideoGrid videos={videos} />
              {totalPages > 1 && (
                <div className="mt-12">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
