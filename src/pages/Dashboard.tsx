import { Link } from 'react-router-dom';
import { CheckCircle, Crown, LifeBuoy, Lock, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PremiumBenefits } from '@/components/PremiumBenefits';

export function Dashboard() {
  const { user, isPremium, isAdmin } = useAuth();
  return <div className="container mx-auto max-w-5xl px-4 py-10"><div className="mb-8"><p className="text-sm uppercase tracking-[0.25em] text-violet-300">Account</p><h1 className="mt-2 text-3xl font-bold text-white">Welcome to CandidFan</h1><p className="mt-2 text-slate-400">{user?.email}</p></div>
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="border-white/10 bg-white/5"><CardHeader><CardTitle className="flex items-center gap-2 text-white">{isPremium || isAdmin ? <CheckCircle className="h-5 w-5 text-emerald-300" /> : <Lock className="h-5 w-5 text-violet-300" />}{isPremium || isAdmin ? 'Lifetime access is active' : 'Your account is ready'}</CardTitle></CardHeader><CardContent className="space-y-5">{isPremium || isAdmin ? <><p className="text-slate-300">You can now start full playback from any video page. Links expire and refresh during playback for safer delivery.</p><Link to="/"><Button><Crown className="mr-2 h-4 w-4" />Browse the library</Button></Link></> : <><p className="text-slate-300">Complete the one-time €50 gift-card review to unlock lifetime streaming access.</p><Link to="/payment"><Button className="bg-gradient-to-r from-violet-600 to-sky-600"><Sparkles className="mr-2 h-4 w-4" />Submit payment proof</Button></Link></>}</CardContent></Card>
      <Card className="border-white/10 bg-white/5"><CardHeader><CardTitle className="text-white">Included with membership</CardTitle></CardHeader><CardContent><PremiumBenefits /></CardContent></Card>
    </div>
    <div className="mt-6 flex flex-wrap gap-3"><Link to="/support"><Button variant="outline"><LifeBuoy className="mr-2 h-4 w-4" />Open support</Button></Link>{isAdmin && <Link to="/admin"><Button variant="outline">Open admin</Button></Link>}</div>
  </div>;
}

