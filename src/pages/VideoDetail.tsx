import { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, Download, Lock, Tag } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getDownloadUrl, getVideo } from '@/lib/api';
import type { Video } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function VideoDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isPremium, isAdmin } = useAuth();
  const [video, setVideo] = useState<Video | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { getVideo(id).then(setVideo).catch(() => setError('This catalog item is unavailable.')); }, [id]);
  const download = async () => { if (!isAuthenticated) return navigate('/login'); if (!isPremium && !isAdmin) return navigate('/payment'); setBusy(true); setError(''); try { const result = await getDownloadUrl(id); window.location.assign(result.url); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Download is temporarily unavailable.'); } finally { setBusy(false); } };
  if (error && !video) return <div className="container mx-auto px-4 py-24 text-center text-slate-300">{error}</div>;
  if (!video) return <div className="container mx-auto px-4 py-24 text-center text-slate-300">Loading catalog item…</div>;
  return <div className="container mx-auto max-w-5xl px-4 py-10"><Link to="/"><Button variant="ghost" className="mb-6 text-slate-300"><ArrowLeft className="mr-2 h-4 w-4" />Back to collection</Button></Link><Card className="overflow-hidden border-white/10 bg-white/[0.04] text-white"><div className="aspect-video bg-slate-900"><img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" /></div><CardHeader><div className="flex flex-wrap items-center gap-3 text-sm text-slate-400"><span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />{new Date(video.created_at).toLocaleDateString()}</span><span>Exclusive catalog item</span></div><CardTitle className="pt-2 text-2xl md:text-3xl">{video.title}</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-2">{video.tags.map((tag) => <span key={tag} className="flex items-center gap-1 rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-sm text-violet-200"><Tag className="h-3.5 w-3.5" />{tag}</span>)}</div><div className="mt-8 rounded-xl border border-white/10 bg-black/20 p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Download access</h2><p className="mt-1 text-sm text-slate-400">{isPremium || isAdmin ? 'Your protected download link expires after 15 minutes.' : 'Lifetime membership is required to download this item.'}</p></div><Button onClick={() => void download()} disabled={busy} className="bg-gradient-to-r from-violet-600 to-sky-600">{isPremium || isAdmin ? <><Download className="mr-2 h-4 w-4" />{busy ? 'Preparing…' : 'Download MP4'}</> : <><Lock className="mr-2 h-4 w-4" />Unlock for €50</>}</Button></div>{error && <p className="mt-3 text-sm text-rose-300">{error}</p>}</div></CardContent></Card></div>;
}
