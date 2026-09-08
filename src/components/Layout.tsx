import { Heart } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Toaster } from './ui/toaster';

export function Layout() {
  return <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100"><Navbar /><main className="flex-1"><Outlet /></main><footer className="border-t border-white/10 bg-slate-950/80 py-8"><div className="container mx-auto px-4 text-center"><p className="text-sm text-slate-400 flex justify-center items-center gap-2">Made with <Heart className="h-4 w-4 text-rose-400 fill-rose-400" /> for premium content lovers</p><p className="mt-2 text-xs text-slate-500">© 2026 CandidFan. Lifetime membership access for €50.</p></div></footer><Toaster /></div>;
}
