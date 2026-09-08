import { Crown, LifeBuoy, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function Dashboard() {
  const { user } = useAuth();
  const status = user?.membership_status;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8">
        <p className="text-sm text-violet-300">Member dashboard</p>
        <h1 className="mt-2 text-3xl font-black">Welcome back</h1>
        <p className="mt-2 text-slate-400">{user?.email}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="border-white/10 bg-white/[0.05] text-white md:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-amber-300" />Membership</CardTitle></CardHeader>
          <CardContent>
            <p className="text-lg font-semibold capitalize">{status}</p>
            <p className="mt-2 text-sm text-slate-400">{status === 'premium' ? 'Lifetime access is active. Protected downloads are available from each catalog item.' : status === 'pending' ? 'Your gift card proof is awaiting manual review.' : status === 'denied' ? 'Your last review was not approved. You can submit new proof when ready.' : 'Unlock lifetime access to download the collection.'}</p>
            {status !== 'premium' && <Link to="/payment"><Button className="mt-5 bg-gradient-to-r from-violet-600 to-sky-600">{status === 'pending' ? 'View payment details' : 'Unlock for €50'}</Button></Link>}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.05] text-white">
          <CardHeader><CardTitle>Need help?</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-slate-400">Contact the owner privately from your member account.</p><Link to="/support"><Button variant="outline" className="mt-5 border-white/15 text-white"><LifeBuoy className="mr-2 h-4 w-4" />Open support</Button></Link></CardContent>
        </Card>
      </div>

      <div className="mt-5">
        <Link to="/" className="block max-w-sm">
          <Card className="h-full border-white/10 bg-white/[0.05] transition hover:bg-white/[0.08]">
            <CardContent className="p-6"><LockKeyhole className="h-5 w-5 text-violet-300" /><h2 className="mt-4 font-semibold">Browse catalog</h2><p className="mt-1 text-sm text-slate-400">See every ready item.</p></CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
