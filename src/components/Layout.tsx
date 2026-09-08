import { Outlet } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Navbar } from './Navbar';
import { Toaster } from './ui/toaster';

export function Layout() {
  return <div className="min-h-screen flex flex-col bg-slate-950">
    <Navbar />
    <main className="flex-1"><Outlet /></main>
    <footer className="border-t border-white/10 bg-slate-950/80 py-8">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm text-gray-400 flex items-center justify-center gap-2"><span>Made with</span><Heart className="h-4 w-4 text-pink-500 fill-pink-500" /><span>for CandidFan members</span></p>
        <p className="mt-2 text-xs text-gray-500">© 2026 CandidFan. Lifetime streaming access for €50.</p>
        <p className="mt-3 text-xs text-gray-600">Questions? Sign in and open a support ticket. hello@candidfan.com is outgoing-only.</p>
      </div>
    </footer>
    <Toaster />
  </div>;
}

