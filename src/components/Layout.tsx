import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Toaster } from './ui/toaster';
import { Heart } from 'lucide-react';

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="relative border-t border-white/10 py-8 bg-slate-950/50 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-purple-950/20" />
        <div className="container mx-auto px-4 relative">
          <div className="text-center space-y-3">
            <p className="text-sm text-gray-400 flex items-center justify-center gap-2">
              Made with <Heart className="h-4 w-4 text-red-500 fill-red-500" /> for premium content lovers
            </p>
            <p className="text-xs text-gray-500">
              &copy; 2026 WalkingPOV. All rights reserved. Lifetime Premium Access for just $30.
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-gray-600">
              <span>Privacy Policy</span>
              <span>•</span>
              <span>Terms of Service</span>
              <span>•</span>
              <span>Contact</span>
            </div>
          </div>
        </div>
      </footer>
      <Toaster />
    </div>
  );
}
