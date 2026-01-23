import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Users, Crown } from 'lucide-react';

interface UserCounts {
  total: number;
  free: number;
  premium: number;
}

export function ActiveUserCount({ mobile = false }: { mobile?: boolean }) {
  const { isPremium, loading } = useAuth();
  const [counts, setCounts] = useState<UserCounts>({ total: 0, free: 0, premium: 0 });

  useEffect(() => {
    // Generate random base numbers
    // Target: ~1465 total, ~247 free, ~1191 premium
    // Fluctuation: +/- 10 on refresh
    
    // Base numbers
    const baseTotal = 1465;
    const baseFree = 247;
    
    // Add random fluctuation +/- 10
    const fluctuationTotal = Math.floor(Math.random() * 21) - 10; // -10 to +10
    const fluctuationFree = Math.floor(Math.random() * 7) - 3;    // -3 to +3
    
    const total = baseTotal + fluctuationTotal;
    const free = baseFree + fluctuationFree;
    const premium = total - free;

    setCounts({ total, free, premium });
  }, []);

  // Don't show while auth is loading to prevent flash
  // Don't show if user is premium
  if (loading || isPremium) return null;

  if (mobile) {
    return (
      <div className="w-full bg-black/20 border-t border-white/5 py-1.5 px-4 flex justify-center items-center text-xs md:hidden animate-in fade-in slide-in-from-top-2 duration-700">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-purple-400" />
            <span className="font-medium text-gray-300 flex items-center gap-1.5">
              {counts.total.toLocaleString()} 
              <div className="flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                </span>
                <span className="text-gray-500">online</span>
              </div>
            </span>
          </div>
          <div className="h-3 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-gray-500">{counts.free} free</span>
            <span className="text-gray-600">/</span>
            <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent font-medium flex items-center gap-1">
              {counts.premium.toLocaleString()} premium
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Desktop View
  return (
    <div className="hidden md:flex items-center gap-4 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mx-4 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-purple-400" />
        <span className="text-sm font-medium text-gray-200 flex items-center gap-1.5">
          {counts.total.toLocaleString()} 
          <span className="text-gray-400 font-normal flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            online
          </span>
        </span>
      </div>
      
      <div className="h-4 w-px bg-white/10" />
      
      <div className="flex items-center gap-3 text-xs">
        <span className="text-gray-400">
          <span className="text-gray-300 font-medium">{counts.free}</span> free
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-600">/</span>
          <Crown className="h-3 w-3 text-yellow-500" />
          <span className="font-semibold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
            {counts.premium.toLocaleString()} premium
          </span>
        </div>
      </div>
    </div>
  );
}
