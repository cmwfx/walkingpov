import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { Video, DownloadLink } from '@/lib/supabase';
import { getVideo, getDownloadLinks } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { PremiumBenefits } from '@/components/PremiumBenefits';
import { DiscountTimer } from '@/components/DiscountTimer';
import { Download, Lock, Tag, Calendar, Crown, ArrowLeft, Sparkles } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { getResponsiveImageUrls, generateSrcSet, getPrimaryImageUrl } from '@/lib/imageUtils';

export function VideoDetail() {
  const { id } = useParams<{ id: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [downloadLinks, setDownloadLinks] = useState<DownloadLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [linksLoading, setLinksLoading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const { isPremium, isAdmin, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const canAccessDownloads = isPremium || isAdmin;

  useEffect(() => {
    if (id) {
      fetchVideo();
      if (canAccessDownloads) {
        fetchDownloadLinks();
      }
    }
  }, [id, canAccessDownloads]);

  const fetchVideo = async () => {
    setLoading(true);
    try {
      const data = await getVideo(id!);
      setVideo(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load video',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDownloadLinks = async () => {
    setLinksLoading(true);
    try {
      const data = await getDownloadLinks(id!);
      setDownloadLinks(data);
    } catch (error) {
      console.error('Error fetching download links:', error);
    } finally {
      setLinksLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Video not found</h1>
        <Link to="/">
          <Button>Back to Home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <Link to="/">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Browse
          </Button>
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <div className="aspect-video relative overflow-hidden bg-muted rounded-t-xl">
                {/* Blur placeholder */}
                {!imageLoaded && (
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 to-blue-900/40 animate-pulse" />
                )}
                
                {/* Responsive thumbnail image */}
                {(() => {
                  const responsiveUrls = getResponsiveImageUrls(video.thumbnail_url);
                  const primaryUrl = getPrimaryImageUrl(video.thumbnail_url);

                  return responsiveUrls ? (
                    <picture>
                      <source
                        type="image/avif"
                        srcSet={generateSrcSet(responsiveUrls, 'avif')}
                        sizes="(max-width: 1024px) 100vw, 66vw"
                      />
                      <source
                        type="image/webp"
                        srcSet={generateSrcSet(responsiveUrls, 'webp')}
                        sizes="(max-width: 1024px) 100vw, 66vw"
                      />
                      <img
                        src={primaryUrl}
                        alt={video.title}
                        className={`w-full h-full object-cover transition-opacity duration-500 ${
                          imageLoaded ? 'opacity-100' : 'opacity-0'
                        }`}
                        onLoad={() => setImageLoaded(true)}
                        onError={() => setImageLoaded(true)}
                      />
                    </picture>
                  ) : (
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className={`w-full h-full object-cover transition-opacity duration-500 ${
                        imageLoaded ? 'opacity-100' : 'opacity-0'
                      }`}
                      onLoad={() => setImageLoaded(true)}
                      onError={() => setImageLoaded(true)}
                    />
                  );
                })()}
              </div>
              <CardHeader>
                <CardTitle className="text-2xl md:text-3xl">{video.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(video.created_at)}</span>
                  </div>
                </div>

                {video.tags && video.tags.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground mt-1" />
                    <div className="flex flex-wrap gap-2">
                      {video.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Download Links Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Download Links
                </CardTitle>
              </CardHeader>
              <CardContent>
                {canAccessDownloads ? (
                  linksLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : downloadLinks.length > 0 ? (
                    <div className="space-y-3">
                      {downloadLinks.map((link) => (
                        <a
                          key={link.id}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <Button variant="outline" className="w-full justify-start">
                            <Download className="h-4 w-4 mr-2" />
                            {link.label}
                          </Button>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No download links available yet
                    </p>
                  )
                ) : (
                  <div className="py-4 space-y-6">
                    <div className="text-center space-y-2">
                      <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 mb-2 ring-1 ring-primary/20">
                        <Lock className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
                        Premium Content
                      </h3>
                    </div>

                    <PremiumBenefits />

                    {isAuthenticated ? (
                      <Link to="/dashboard">
                        <Button className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 transition-all shadow-lg shadow-primary/25 animate-pulse">
                          <Crown className="h-4 w-4 mr-2" />
                          Upgrade Now
                        </Button>
                      </Link>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 mb-2 backdrop-blur-sm">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <Sparkles className="h-4 w-4 text-yellow-500" />
                            <span className="font-bold text-sm">Celebrating 10k Members!</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Special Offer Ends In</span>
                            <DiscountTimer />
                          </div>
                        </div>
                        <Link to="/signup">
                          <Button className="w-full h-auto py-4 flex-col gap-1 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 transition-all shadow-lg shadow-primary/25 hover:scale-[1.02]">
                            <div className="flex items-center gap-2 font-bold text-lg">
                              <Crown className="h-5 w-5" />
                              Get Lifetime Access - $30
                            </div>
                            <div className="flex items-center gap-2 text-xs opacity-90">
                              <span className="line-through opacity-70">$120</span>
                              <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] font-bold">75% OFF</span>
                            </div>
                          </Button>
                        </Link>
                        <Link to="/login">
                          <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground text-sm">
                            Already a member? Login
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
