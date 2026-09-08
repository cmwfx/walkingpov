/* eslint-disable react-hooks/set-state-in-effect */
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { ArrowRight, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { getVideos } from '@/lib/api';
import type { Video } from '@/lib/supabase';
import { VideoGrid } from '@/components/VideoGrid';
import { DiscountTimer } from '@/components/DiscountTimer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function Home() {
  const [params, setParams] = useSearchParams();
  const [videos, setVideos] = useState<Video[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const tag = params.get('tag') || '';
  const page = Number(params.get('page') || 1);
  const [search, setSearch] = useState(tag);

  useEffect(() => setSearch(tag), [tag]);
  useEffect(() => {
    setLoading(true);
    getVideos(page, tag).then((result) => { setVideos(result.videos); setTotalPages(result.pagination.totalPages); }).catch(() => setVideos([])).finally(() => setLoading(false));
  }, [page, tag]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams();
    if (search.trim()) next.set('tag', search.trim());
    next.set('page', '1');
    setParams(next);
  };

  return <div className="relative overflow-hidden">
    <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,.25),_transparent_38%),radial-gradient(circle_at_80%_20%,_rgba(14,165,233,.17),_transparent_30%)]" />
    <section className="container mx-auto px-4 pb-14 pt-16 md:pt-24">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/10 px-4 py-2 text-sm text-violet-200"><Sparkles className="h-4 w-4" />CandidFan premium library</div>
        <div className="mb-6 flex flex-wrap items-center justify-center gap-3"><span className="rounded-full bg-rose-500 px-4 py-1.5 text-xs font-black tracking-widest text-white">75% OFF</span><DiscountTimer /></div>
        <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl">Your private collection of <span className="bg-gradient-to-r from-fuchsia-300 via-violet-300 to-sky-300 bg-clip-text text-transparent">candid moments.</span></h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">Browse the public catalog, then unlock lifetime access for €50 when you are ready to download.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3"><Link to="/signup"><Button size="lg" className="bg-gradient-to-r from-violet-600 to-sky-600">Get lifetime access <ArrowRight className="ml-2 h-4 w-4" /></Button></Link><Link to="/login"><Button size="lg" variant="outline" className="border-white/15 bg-white/5 text-white">Member login</Button></Link></div>
        <div className="mt-8 flex flex-wrap justify-center gap-5 text-sm text-slate-400"><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" />Protected downloads</span><span>One payment</span><span>Private member support</span></div>
      </div>
    </section>
    <section className="container mx-auto px-4 pb-20">
      <form onSubmit={submit} className="mx-auto mb-10 flex max-w-3xl gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter by tag or category" className="h-11 border-white/10 bg-white/5 pl-10 text-white placeholder:text-slate-500" /></div><Button type="submit" className="h-11 bg-white/10 text-white hover:bg-white/15">Search</Button></form>
      {loading ? <div className="py-20 text-center text-slate-400">Loading the collection…</div> : <><VideoGrid videos={videos} />{videos.length === 0 && <div className="py-5 text-center text-slate-400">The collection is being prepared. Check back soon.</div>}{totalPages > 1 && <div className="mt-10 flex justify-center gap-2">{Array.from({ length: totalPages }, (_, index) => index + 1).map((value) => <Button key={value} size="sm" variant={value === page ? 'default' : 'outline'} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(value)); setParams(next); }}>{value}</Button>)}</div>}</>}
    </section>
  </div>;
}
