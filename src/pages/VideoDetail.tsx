import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Crown, Lock, Play, Tag } from 'lucide-react';
import { getPlaybackUrl, getVideo } from '@/lib/api';
import type { Video } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PremiumBenefits } from '@/components/PremiumBenefits';
import { formatDate, formatDuration } from '@/lib/utils';

export function VideoDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, isPremium, isAdmin } = useAuth();
  const [video, setVideo] = useState<Video | null>(null);
  const [src, setSrc] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [ended, setEnded] = useState(false);
  const [loading, setLoading] = useState(true);
  const player = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (id) getVideo(id).then(setVideo).finally(() => setLoading(false)); }, [id]);
  useEffect(() => {
    if (!src || !expiresAt || !id) return;
    const wait = Math.max(10_000, new Date(expiresAt).getTime() - Date.now() - 60_000);
    const timer = window.setTimeout(async () => {
      const position = player.current?.currentTime || 0; const playing = player.current ? !player.current.paused : false;
      try { const next = await getPlaybackUrl(id); setSrc(next.url); setExpiresAt(next.expires_at); window.setTimeout(() => { if (player.current) { player.current.currentTime = position; if (playing) void player.current.play(); } }, 50); } catch { setSrc(''); }
    }, wait);
    return () => window.clearTimeout(timer);
  }, [src, expiresAt, id]);
  if (loading) return <div className="container mx-auto py-24 text-center text-slate-400">Loading video…</div>;
  if (!video) return <div className="container mx-auto py-24 text-center"><p className="text-white">Video not found.</p><Link to="/"><Button className="mt-4">Back to library</Button></Link></div>;
  const premium = isPremium || isAdmin;
  return <div className="container mx-auto max-w-5xl px-4 py-8">
    <Link to="/" className="inline-flex items-center text-sm text-slate-400 hover:text-white"><ArrowLeft className="mr-2 h-4 w-4" />Back to library</Link>
    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div><div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl"><video ref={player} className="aspect-video w-full" controls playsInline preload="metadata" poster={video.thumbnail_url || undefined} src={src || video.preview_url || undefined} onEnded={() => setEnded(true)}><track kind="captions" /></video></div><div className="mt-6"><h1 className="text-3xl font-bold text-white">{video.title}</h1><div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-400"><span>{formatDuration(video.duration_seconds)}</span><span>•</span><span>{formatDate(video.created_at)}</span>{video.width && video.height && <><span>•</span><span>720p-ready</span></>}</div>{video.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{video.tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs text-violet-200"><Tag className="h-3 w-3" />{tag}</span>)}</div>}</div></div>
      <Card className="h-fit border-white/10 bg-white/5"><CardHeader><CardTitle className="flex items-center gap-2 text-white">{premium ? <Crown className="h-5 w-5 text-amber-300" /> : <Lock className="h-5 w-5 text-violet-300" />}{premium ? 'Full playback' : 'Five-second preview'}</CardTitle></CardHeader><CardContent className="space-y-5">{premium ? <><p className="text-sm text-slate-300">Your expiring playback link refreshes automatically while you watch.</p><Button className="w-full" onClick={async () => { const data = await getPlaybackUrl(video.id); setSrc(data.url); setExpiresAt(data.expires_at); setEnded(false); }}><Play className="mr-2 h-4 w-4" />{src ? 'Refresh playback' : 'Start full video'}</Button>{src && <p className="text-xs text-slate-500">Downloads are not offered; playback stays inside the secure player.</p>}</> : <><p className="text-sm text-slate-300">This preview is limited at the media server. Upgrade once for lifetime access to the full library.</p><PremiumBenefits />{ended && <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">Preview finished. Unlock the full video to keep watching.</p>}<Link to={isAuthenticated ? '/payment' : '/signup'}><Button className="w-full bg-gradient-to-r from-violet-600 to-sky-600"><Crown className="mr-2 h-4 w-4" />Unlock for €50</Button></Link>{!isAuthenticated && <Link to="/login" className="block text-center text-sm text-slate-400 hover:text-white">Already a member? Sign in</Link>}</>}</CardContent></Card>
    </div>
  </div>;
}
