import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video, Users, Clock, CheckCircle, PlusCircle, FileText, FileJson } from 'lucide-react';

export function AdminDashboard() {
  const [stats, setStats] = useState({
    totalVideos: 0,
    totalUsers: 0,
    pendingPayments: 0,
    premiumUsers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [videosResult, usersResult, paymentsResult, premiumResult] = await Promise.all([
        supabase.from('videos').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('payment_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('membership_status', 'premium'),
      ]);

      setStats({
        totalVideos: videosResult.count || 0,
        totalUsers: usersResult.count || 0,
        pendingPayments: paymentsResult.count || 0,
        premiumUsers: premiumResult.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Videos',
      value: stats.totalVideos,
      icon: Video,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900',
    },
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900',
    },
    {
      title: 'Pending Payments',
      value: stats.pendingPayments,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900',
    },
    {
      title: 'Premium Users',
      value: stats.premiumUsers,
      icon: CheckCircle,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900',
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage your WalkingPOV platform</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.title}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                      <Icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <PlusCircle className="h-5 w-5" />
                  <CardTitle>Create New Video</CardTitle>
                </div>
                <CardDescription>
                  Upload a new video with thumbnail and download links
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/admin/create-video">
                  <Button className="w-full">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Create Video
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileJson className="h-5 w-5" />
                  <CardTitle>Bulk Upload</CardTitle>
                </div>
                <CardDescription>
                  Upload multiple videos from a JSON file
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/admin/bulk-upload">
                  <Button variant="outline" className="w-full">
                    <FileJson className="h-4 w-4 mr-2" />
                    Bulk Upload
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  <CardTitle>Review Payments</CardTitle>
                </div>
                <CardDescription>
                  {stats.pendingPayments > 0 
                    ? `${stats.pendingPayments} payment${stats.pendingPayments > 1 ? 's' : ''} waiting for review`
                    : 'No pending payments'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/admin/review-payments">
                  <Button variant="outline" className="w-full">
                    <FileText className="h-4 w-4 mr-2" />
                    Review Payments
                    {stats.pendingPayments > 0 && (
                      <span className="ml-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-0.5 rounded-full text-xs font-semibold">
                        {stats.pendingPayments}
                      </span>
                    )}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
