import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Sparkles, Video } from 'lucide-react';
import type { Video as VideoType } from '@/lib/supabase';
import { getVideos } from '@/lib/api';
import { VideoGrid } from '@/components/VideoGrid';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/Pagination';
import { formatDuration } from '@/lib/utils';

export function Home() {
  const [params, setParams] = useSearchParams();
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState(params.get('tag') || '');
  const [loading, setLoading] = useState(true);
  const page = Number(params.get('page') || 1);
  const tag = params.get('tag') || '';
  useEffect(() => { setLoading(true); getVideos(page, tag).then((data) => { setVideos(data.videos); setTotalPages(data.pagination.totalPages); }).finally(() => setLoading(false)); }, [page, tag]);
  return <div className="min-h-screen">
    <section className="relative overflow-hidden border-b border-white/10">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-slate-950 to-sky-950" />
      <div className="relative container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-3xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-sm text-violet-200"><Sparkles className="h-4 w-4" />CandidFan streaming library</p>
          <h1 className="text-4xl font-black tracking-tight text-white md:text-6xl">Watch the moments<br /><span className="text-violet-300">you came for.</span></h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-300">Browse previews for free. Members unlock the full 720p library with one €50 lifetime payment.</p>
          <form className="mt-8 flex max-w-2xl gap-2" onSubmit={(event) => { event.preventDefault(); setParams(query ? { tag: query, page: '1' } : {}); }}>
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tags" className="border-white/15 bg-white/10 pl-10 text-white placeholder:text-slate-400" /></div>
            <Button type="submit">Search</Button>
          </form>
        </div>
      </div>
    </section>
    <section className="container mx-auto px-4 py-10">
      <div className="mb-6 flex items-end justify-between"><div><p className="text-sm uppercase tracking-[0.25em] text-violet-300">Library</p><h2 className="mt-1 flex items-center gap-2 text-2xl font-bold text-white"><Video className="h-5 w-5 text-violet-300" />Latest releases</h2></div>{tag && <Button variant="ghost" onClick={() => { setQuery(''); setParams({}); }}>Clear filter</Button>}</div>
      {loading ? <div className="py-24 text-center text-slate-400">Loading the library…</div> : <VideoGrid videos={videos} />}
      {!loading && totalPages > 1 && <div className="mt-10"><Pagination currentPage={page} totalPages={totalPages} onPageChange={(next) => setParams({ ...(tag ? { tag } : {}), page: String(next) })} /></div>}
      {!loading && videos.length > 0 && <p className="mt-6 text-center text-xs text-slate-500">Preview clips are limited to five seconds. Video duration examples: {formatDuration(videos[0].duration_seconds)}.</p>}
    </section>
  </div>;
}

