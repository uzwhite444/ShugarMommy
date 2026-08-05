import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { subscribeScroll } from '../../lib/scrollState';

interface LiquidVideoProps {
  src: string;
  /** Shown before the video loads. */
  poster?: string;
  className?: string;
  loop?: boolean;
  /** Accessible description of the clip. */
  label: string;
  /**
   * Rendered instead of the video if the file fails to load — and as the
   * reduced-motion still, which is what "the first frame is shown instead"
   * always claimed to do but never actually did: nothing was ever passed a
   * poster, so the promise rested on `preload="metadata"` decoding a frame.
   */
  fallback?: React.ReactNode;
}

/**
 * Ambient product video: muted, inline, plays only while on screen and
 * (for non-looping clips) restarts each time it re-enters. Visibility is
 * checked directly against the viewport — more reliable than
 * IntersectionObserver across embedded/webview contexts — but the check now
 * rides the page's single rAF-coalesced scroll frame instead of its own
 * unthrottled listener, which was reading layout once per scroll EVENT for the
 * whole 14,000px document, including while the clip sat 10,000px away.
 *
 * `mix-blend-mode: darken` melts the clip's cream backdrop into the page
 * canvas, so it reads as an object and not a rectangle. That blend is isolated
 * by ANY stacking context on an ancestor — a filter, a transform, an opacity
 * below 1 — so nothing above this element may rest on those channels.
 */
export default function LiquidVideo({ src, poster, className, loop = false, label, fallback }: LiquidVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const showStill = (failed || reduced === true) && Boolean(fallback);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || showStill || reduced) return;

    let wasVisible = false;
    return subscribeScroll(({ vh }) => {
      const r = video.getBoundingClientRect();
      const visible = r.bottom > vh * 0.08 && r.top < vh * 0.92;
      if (visible && !wasVisible) {
        if (!loop) video.currentTime = 0;
        video.play().catch(() => {
          // Autoplay blocked — the first frame stays, which is fine.
        });
      } else if (!visible && wasVisible) {
        video.pause();
      }
      wasVisible = visible;
    });
  }, [showStill, reduced, loop]);

  if (showStill) return <>{fallback}</>;

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      muted
      playsInline
      loop={loop}
      preload="metadata"
      aria-label={label}
      onError={() => setFailed(true)}
      className={`liquid-video ${className ?? ''}`}
    />
  );
}
