import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, User, Shield, Video, Crown, Sparkles, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { ActiveUserCount } from './ActiveUserCount';

export function Navbar() {
  const { user, isAuthenticated, isAdmin, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-900/80 backdrop-blur-xl supports-[backdrop-filter]:bg-slate-900/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 font-bold text-xl group">
              <div className="relative">
                <Video className="h-6 w-6 text-purple-400 group-hover:text-purple-300 transition-colors" />
                <div className="absolute inset-0 blur-md bg-purple-400 opacity-0 group-hover:opacity-50 transition-opacity" />
              </div>
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent group-hover:from-purple-300 group-hover:via-pink-300 group-hover:to-blue-300 transition-all">
                WalkingPOV
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-2">
              <Link to="/">
                <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white hover:bg-white/10">
                  Browse
                </Button>
              </Link>
              {isAdmin && (
                <Link to="/admin">
                  <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white hover:bg-white/10">
                    <Shield className="h-4 w-4 mr-2" />
                    Admin
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <ActiveUserCount />

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {/* Desktop menu items */}
                <Link to="/dashboard" className="hidden md:block">
                  <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white hover:bg-white/10">
                    <User className="h-4 w-4 mr-2" />
                    Dashboard
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => signOut()}
                  className="hidden md:flex text-gray-300 hover:text-white hover:bg-white/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
                {user && (
                  <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 text-sm">
                    <span className="text-gray-400 text-xs">Status:</span>
                    {user.membership_status === 'premium' ? (
                      <div className="flex items-center gap-1.5">
                        <Crown className="h-3.5 w-3.5 text-yellow-400" />
                        <span className="font-semibold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                          Premium
                        </span>
                      </div>
                    ) : user.membership_status === 'pending' ? (
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
                        <span className="font-medium text-yellow-400">
                          Pending
                        </span>
                      </div>
                    ) : (
                      <span className="font-medium text-gray-400 capitalize">
                        {user.membership_status}
                      </span>
                    )}
                  </div>
                )}
                
                {/* Mobile hamburger menu button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden text-gray-300 hover:text-white hover:bg-white/10"
                >
                  {mobileMenuOpen ? (
                    <X className="h-5 w-5" />
                  ) : (
                    <Menu className="h-5 w-5" />
                  )}
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white hover:bg-white/10">
                    Login
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg shadow-purple-500/30">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile active user count */}
        <div className="-mx-4 md:hidden">
          <ActiveUserCount mobile />
        </div>

        {/* Mobile menu */}
        {isAuthenticated && mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10">
            <div className="px-4 py-4 space-y-3 bg-slate-900/95 backdrop-blur-xl">
              {/* User status badge - mobile */}
              {user && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
                  <span className="text-gray-400 text-xs">Status:</span>
                  {user.membership_status === 'premium' ? (
                    <div className="flex items-center gap-1.5">
                      <Crown className="h-3.5 w-3.5 text-yellow-400" />
                      <span className="font-semibold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                        Premium
                      </span>
                    </div>
                  ) : user.membership_status === 'pending' ? (
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
                      <span className="font-medium text-yellow-400">
                        Pending
                      </span>
                    </div>
                  ) : (
                    <span className="font-medium text-gray-400 capitalize text-sm">
                      {user.membership_status}
                    </span>
                  )}
                </div>
              )}

              {/* Menu items */}
              <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start text-gray-300 hover:text-white hover:bg-white/10">
                  <User className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>

              {isAdmin && (
                <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start text-gray-300 hover:text-white hover:bg-white/10">
                    <Shield className="h-4 w-4 mr-2" />
                    Admin
                  </Button>
                </Link>
              )}

              <Button 
                variant="ghost" 
                onClick={() => {
                  setMobileMenuOpen(false);
                  signOut();
                }}
                className="w-full justify-start text-gray-300 hover:text-white hover:bg-white/10"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
