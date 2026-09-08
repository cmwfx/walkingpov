import { Calendar, ChevronRight, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Video } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { Card } from './ui/card';

export function VideoCard({ video }: { video: Video }) {
  return <Link to={`/video/${video.id}`} className="group block"><Card className="h-full overflow-hidden border-white/10 bg-white/[0.04] text-white transition duration-300 hover:-translate-y-1 hover:bg-white/[0.08] hover:shadow-2xl hover:shadow-violet-950/50"><div className="relative aspect-[16/10] overflow-hidden bg-slate-900"><img src={video.thumbnail_url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" /><div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" /><div className="absolute bottom-0 p-5"><h3 className="line-clamp-2 text-lg font-bold">{video.title}</h3><div className="mt-3 flex items-center gap-1.5 text-xs text-slate-300"><Calendar className="h-3.5 w-3.5" />{formatDate(video.created_at)}</div></div><div className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/40 p-2 opacity-0 transition group-hover:opacity-100"><ChevronRight className="h-5 w-5" /></div></div><div className="p-4">{video.tags?.length ? <div className="flex flex-wrap gap-2"><Tag className="mt-0.5 h-4 w-4 text-violet-300" />{video.tags.slice(0, 4).map((tag) => <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-xs text-violet-200" key={tag}>{tag}</span>)}</div> : <span className="text-xs text-slate-500">CandidFan exclusive</span>}</div></Card></Link>;
}
