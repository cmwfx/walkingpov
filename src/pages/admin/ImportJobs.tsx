import { useEffect, useState } from 'react';
import { ArrowLeft, FolderSync, Play, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getImportJobs, resumeImport, startImport } from '@/lib/api';
import type { ImportJob } from '@/lib/supabase';
import { formatBytes } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ImportJobs() {
  const [jobs, setJobs] = useState<ImportJob[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const load = async () => { try { setJobs(await getImportJobs()); } catch { setError('Unable to load import jobs.'); } };
  useEffect(() => { void load(); }, []);
  const start = async () => { setBusy(true); setError(''); try { await startImport(); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to start import.'); } finally { setBusy(false); } };
  const resume = async (id: string) => { setBusy(true); try { await resumeImport(id); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to resume import.'); } finally { setBusy(false); } };
  return <div className="container mx-auto max-w-4xl px-4 py-10"><Link to="/admin"><Button variant="ghost" className="text-slate-300"><ArrowLeft className="mr-2 h-4 w-4" />Admin</Button></Link><Card className="mt-5 border-white/10 bg-white/[0.05] text-white"><CardHeader><CardTitle className="flex items-center gap-2"><FolderSync className="h-5 w-5 text-violet-300" />Folder import</CardTitle><p className="text-sm text-slate-400">The importer reads its fixed server folder, copies media independently, and publishes only completed items. Filenames stay inside the importer.</p></CardHeader><CardContent><Button disabled={busy} onClick={() => void start()} className="bg-gradient-to-r from-violet-600 to-sky-600"><Play className="mr-2 h-4 w-4" />Start import</Button>{error && <p className="mt-4 text-sm text-rose-300">{error}</p>}<div className="mt-6 space-y-3">{jobs.map((job) => <div className="rounded-xl border border-white/10 bg-black/20 p-4" key={job.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold capitalize">{job.source_kind} · {job.status}</p><p className="mt-1 text-xs text-slate-500">{job.successful_items} ready · {job.failed_items} failed · {formatBytes(job.total_bytes)}</p></div>{['completed', 'failed'].includes(job.status) && <Button size="sm" variant="outline" className="border-white/15 text-white" disabled={busy} onClick={() => void resume(job.id)}><RotateCcw className="mr-2 h-4 w-4" />Resume</Button>}</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-violet-500 to-sky-400" style={{ width: `${job.total_items ? Math.min(100, (job.processed_items / job.total_items) * 100) : 0}%` }} /></div><p className="mt-2 text-xs text-slate-500">{job.processed_items} / {job.total_items} processed</p></div>)}{jobs.length === 0 && <p className="text-sm text-slate-500">No import has been started.</p>}</div></CardContent></Card></div>;
}
