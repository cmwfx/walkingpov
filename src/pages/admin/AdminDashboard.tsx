import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Film, LifeBuoy, RefreshCw, Settings2 } from 'lucide-react';
import { getAdminStats } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const load = () => void getAdminStats().then(setStats);
  useEffect(load, []);
  const job = stats?.import_job;
  return <div className="container mx-auto max-w-6xl px-4 py-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm uppercase tracking-[0.25em] text-violet-300">Operations</p><h1 className="mt-2 text-3xl font-bold text-white">CandidFan admin</h1></div><Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Published videos', stats?.published_videos || 0, Film], ['Users', stats?.users || 0, Settings2], ['Pending payments', stats?.pending_payments || 0, CreditCard], ['Open tickets', stats?.open_tickets || 0, LifeBuoy]].map(([label, value, Icon]: any) => <Card key={label} className="border-white/10 bg-white/5"><CardContent className="p-5"><Icon className="h-5 w-5 text-violet-300" /><p className="mt-4 text-sm text-slate-400">{label}</p><p className="mt-1 text-3xl font-bold text-white">{value}</p></CardContent></Card>)}</div>
    {job && <Card className="mt-6 border-white/10 bg-white/5"><CardHeader><CardTitle className="text-white">Latest import job: <span className="capitalize">{job.status}</span></CardTitle></CardHeader><CardContent><div className="grid gap-4 sm:grid-cols-4 text-sm">{[['Discovered', job.discovered_count], ['Processing', job.processing_count], ['Published', job.published_count], ['Failed', job.failed_count]].map(([label, value]) => <div key={label}><p className="text-slate-400">{label}</p><p className="text-xl font-semibold text-white">{value}</p></div>)}</div></CardContent></Card>}
    <div className="mt-8 grid gap-4 md:grid-cols-3"><Link to="/admin/review-payments"><Button className="w-full" variant="outline">Review gift-card payments</Button></Link><Link to="/admin/imports"><Button className="w-full" variant="outline">Manage video imports</Button></Link><Link to="/admin/support"><Button className="w-full" variant="outline">Open support inbox</Button></Link></div>
  </div>;
}

