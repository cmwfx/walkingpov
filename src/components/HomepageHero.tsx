import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Crown, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { trackAnalyticsEvent } from '@/lib/analytics';

const HERO_VIDEOS = [
  '/hero/generated_video11x.mp4',
  '/hero/generated_video16.mp4',
  '/hero/generated_video4.mp4',
] as const;

type HomepageHeroProps = {
  premiumHref: string;
};

export function HomepageHero({ premiumHref }: HomepageHeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoIndex, setVideoIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));
  const [videoUnavailable, setVideoUnavailable] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const playWhenVisible = () => {
      if (reducedMotion || document.visibilityState === 'hidden') {
        video.pause();
        return;
      }

      void video.play().then(() => setVideoUnavailable(false)).catch(() => setVideoUnavailable(true));
    };

    playWhenVisible();
    document.addEventListener('visibilitychange', playWhenVisible);
    return () => document.removeEventListener('visibilitychange', playWhenVisible);
  }, [reducedMotion, videoIndex]);

  const showNextVideo = () => setVideoIndex((current) => (current + 1) % HERO_VIDEOS.length);
  const scrollToCatalog = () => {
    document.getElementById('home-catalog')?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  return (
    <section className="relative isolate flex min-h-screen min-h-[100svh] items-center justify-center overflow-hidden bg-slate-950 text-white">
      {!reducedMotion && !videoUnavailable && (
        <video
          key={HERO_VIDEOS[videoIndex]}
          ref={videoRef}
          className="absolute inset-0 z-0 h-full w-full object-cover"
          autoPlay
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          onEnded={showNextVideo}
          onError={() => setVideoUnavailable(true)}
        >
          <source src={HERO_VIDEOS[videoIndex]} type="video/mp4" />
        </video>
      )}

      <div className="absolute inset-0 z-10 bg-gradient-to-b from-slate-950/65 via-slate-950/50 to-slate-950/80" />
      <div className="absolute inset-0 z-10 bg-black/20" />

      <div className="relative z-20 mx-auto w-full max-w-6xl px-5 py-16 text-center sm:px-8">
        <div className="mx-auto mb-6 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-white/20 bg-black/35 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/90 backdrop-blur-md sm:text-sm">
          <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-300" /> Celebrating 10,000 members</span>
          <span className="hidden h-4 w-px bg-white/30 sm:block" aria-hidden="true" />
          <span className="text-amber-200">75% off</span>
        </div>

        <h1 className="mx-auto max-w-5xl text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          2,000+ videos worth over <span className="text-amber-300">€10,000</span>.
          <span className="mt-2 block">Lifetime access for <span className="text-violet-300">$30.</span></span>
        </h1>

        <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-slate-100 sm:text-lg md:text-xl">
          One payment, no subscription. That’s 75% off the <span className="text-white/75 line-through">$120</span> price.
          Preview the collection and compare the value for yourself.
        </p>

        <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Button
            size="lg"
            className="min-h-12 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-7 text-base font-bold shadow-lg shadow-violet-950/40 hover:from-violet-500 hover:to-fuchsia-500"
            asChild
          >
            <Link
              to={premiumHref}
              onClick={() => trackAnalyticsEvent('premium_cta_click', { cta_location: 'homepage_hero' })}
            >
              <Crown className="mr-2 h-5 w-5" /> See Premium
            </Link>
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={scrollToCatalog}
            className="min-h-12 border-white/30 bg-black/25 px-7 text-base font-semibold text-white backdrop-blur-sm hover:bg-white/10 hover:text-white"
          >
            <ArrowDown className="mr-2 h-5 w-5" /> Watch a preview
          </Button>
        </div>
      </div>
    </section>
  );
}
