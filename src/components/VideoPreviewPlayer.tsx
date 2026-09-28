import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Maximize2, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { VideoPreview } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

type VideoPreviewPlayerProps = {
  preview: VideoPreview;
  title: string;
  canDownload: boolean;
  premiumActionHref: string;
  downloadUrl?: string;
};

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function VideoPreviewPlayer({ preview, title, canDownload, premiumActionHref, downloadUrl }: VideoPreviewPlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [playbackFailed, setPlaybackFailed] = useState(false);

  const sourceDuration = Math.max(0.01, preview.sourceDurationSeconds);
  const playableDuration = Math.max(0.01, Math.min(preview.previewDurationSeconds, sourceDuration, 10.05));
  const playablePercent = Math.min(100, (playableDuration / sourceDuration) * 100);
  const playedPercent = Math.min(playablePercent, (currentTime / sourceDuration) * 100);

  const stopAtPreviewEnd = () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      if (video.currentTime > playableDuration) video.currentTime = playableDuration;
    }
    setCurrentTime(playableDuration);
    setPlaying(false);
    setFinished(true);
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    setPlaybackFailed(false);
    if (finished) {
      video.currentTime = 0;
      setCurrentTime(0);
      setFinished(false);
    }
    if (video.paused) void video.play().catch(() => setPlaybackFailed(true));
    else video.pause();
  };

  const handleSeek = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    if (value >= playableDuration) {
      stopAtPreviewEnd();
      return;
    }
    video.currentTime = Math.max(0, value);
    setCurrentTime(Math.max(0, value));
    setFinished(false);
  };

  const toggleMuted = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const openFullscreen = () => {
    const player = playerRef.current;
    if (player && !document.fullscreenElement) void player.requestFullscreen().catch(() => undefined);
    else if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  };

  return (
    <div ref={playerRef} className="relative aspect-video overflow-hidden rounded-t-xl bg-black text-white">
      <video
        ref={videoRef}
        src={preview.url}
        title={title}
        preload="metadata"
        playsInline
        crossOrigin="anonymous"
        className="absolute inset-0 h-full w-full object-contain"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => {
          const time = event.currentTarget.currentTime;
          if (time >= playableDuration) stopAtPreviewEnd();
          else setCurrentTime(time);
        }}
        onSeeking={(event) => {
          if (event.currentTarget.currentTime > playableDuration) stopAtPreviewEnd();
        }}
        onEnded={stopAtPreviewEnd}
        onError={() => setPlaybackFailed(true)}
      />

      <div className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/65 px-3 py-1 text-xs font-bold tracking-wide backdrop-blur">
        10-SECOND PREVIEW
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/65 to-transparent px-3 pb-3 pt-12 sm:px-5 sm:pb-4">
        <div className="relative flex h-5 items-center">
          <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/25" />
          <div className="absolute left-0 h-1.5 rounded-l-full bg-white/40" style={{ width: `${playablePercent}%` }} />
          <div className="absolute left-0 h-1.5 rounded-l-full bg-violet-400" style={{ width: `${playedPercent}%` }} />
          <input
            aria-label="Video timeline; only the preview segment can be played"
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(sourceDuration)}; preview ends at ${formatTime(playableDuration)}`}
            type="range"
            min={0}
            max={sourceDuration}
            step={0.1}
            value={Math.min(currentTime, sourceDuration)}
            onChange={(event) => handleSeek(Number(event.target.value))}
            className="absolute inset-x-0 h-5 w-full cursor-pointer appearance-none bg-transparent accent-violet-400"
          />
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button type="button" onClick={togglePlayback} className="rounded p-1.5 hover:bg-white/15" aria-label={playing ? 'Pause preview' : 'Play preview'}>
            {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
          </button>
          <span className="min-w-[84px] text-xs tabular-nums text-white/90 sm:text-sm">
            {formatTime(currentTime)} / {formatTime(sourceDuration)}
          </span>
          <button type="button" onClick={toggleMuted} className="rounded p-1.5 hover:bg-white/15" aria-label={muted ? 'Unmute preview' : 'Mute preview'}>
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button type="button" onClick={openFullscreen} className="ml-auto rounded p-1.5 hover:bg-white/15" aria-label="Toggle fullscreen">
            <Maximize2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {(finished || playbackFailed) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-5 text-center backdrop-blur-sm">
          <div className="max-w-md space-y-3">
            {playbackFailed ? (
              <>
                <p className="text-lg font-bold">This preview could not be played.</p>
                <p className="text-sm text-white/75">Try refreshing the page or using a browser that supports this video format.</p>
              </>
            ) : canDownload ? (
              <>
                <p className="text-lg font-bold">Preview complete</p>
                <p className="text-sm text-white/75">Download the full 4K video with your premium access.</p>
                {downloadUrl ? (
                  <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
                    <Button className="bg-violet-600 hover:bg-violet-500">Download the full video</Button>
                  </a>
                ) : (
                  <p className="text-sm text-white/75">Use the Download Links panel to get the full video.</p>
                )}
              </>
            ) : (
              <>
                <p className="text-lg font-bold">Get Premium to watch the full 4K video</p>
                <p className="text-sm text-white/75">The preview is complete. Unlock lifetime access to download the full video.</p>
                <Link to={premiumActionHref} className="inline-block">
                  <Button className="bg-violet-600 hover:bg-violet-500">Get Premium</Button>
                </Link>
              </>
            )}
            {!playbackFailed && (
              <button type="button" onClick={togglePlayback} className="mx-auto flex items-center gap-2 rounded px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white">
                <RotateCcw className="h-4 w-4" /> Replay preview
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
