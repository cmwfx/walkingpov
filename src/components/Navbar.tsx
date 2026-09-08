import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Film, LogOut, Menu, Shield, Sparkles, User, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from './ui/button';
import { ActiveUserCount } from './ActiveUserCount';

export function Navbar() {
  const { user, isAuthenticated, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  return <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
    <div className="container mx-auto px-4">
      <div className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold">
            <Film className="h-6 w-6 text-violet-400" />
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-sky-300 bg-clip-text text-transparent">CandidFan</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <Link to="/"><Button variant="ghost" size="sm">Browse</Button></Link>
            {isAuthenticated && <Link to="/support"><Button variant="ghost" size="sm">Support</Button></Link>}
            {isAdmin && <Link to="/admin"><Button variant="ghost" size="sm"><Shield className="mr-2 h-4 w-4" />Admin</Button></Link>}
          </div>
        </div>
        <ActiveUserCount />
        <div className="flex items-center gap-2">
          {isAuthenticated ? <><Link to="/dashboard" className="hidden md:block"><Button variant="ghost" size="sm"><User className="mr-2 h-4 w-4" />Dashboard</Button></Link><span className="hidden lg:inline text-xs text-gray-400">{user?.membership_status === 'premium' ? 'Premium member' : 'Free member'}</span><Button variant="ghost" size="sm" onClick={() => void signOut()} className="hidden md:flex"><LogOut className="mr-2 h-4 w-4" />Logout</Button><Button variant="ghost" size="sm" className="md:hidden" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</Button></> : <><Link to="/login"><Button variant="ghost" size="sm">Login</Button></Link><Link to="/signup"><Button size="sm" className="bg-gradient-to-r from-violet-600 to-sky-600"><Sparkles className="mr-2 h-4 w-4" />Join</Button></Link></>}
        </div>
      </div>
      {open && <div className="border-t border-white/10 py-3 md:hidden"><div className="flex flex-col gap-2"><Link to="/dashboard" onClick={() => setOpen(false)}><Button variant="ghost" className="w-full justify-start">Dashboard</Button></Link><Link to="/support" onClick={() => setOpen(false)}><Button variant="ghost" className="w-full justify-start">Support</Button></Link><Button variant="ghost" className="justify-start" onClick={() => { setOpen(false); void signOut(); }}><LogOut className="mr-2 h-4 w-4" />Logout</Button></div></div>}
    </div>
  </nav>;
}

