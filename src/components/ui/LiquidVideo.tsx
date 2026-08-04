import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

interface LiquidVideoProps {
  src: string;
  /** Shown before the video loads and as the reduced-motion still. */
  poster?: string;
  className?: string;
  loop?: boolean;
  /** Accessible description of the clip. */
  label: string;
  /** Rendered instead of the video if the file fails to load. */
  fallback?: React.ReactNode;
}

/**
 * Ambient product video: muted, inline, plays only while on screen and
 * (for non-looping clips) restarts each time it re-enters. Visibility is
 * checked directly against the viewport on scroll — more reliable than
 * IntersectionObserver across embedded/webview contexts.
 * `mix-blend-multiply` melts the clip's cream background into the page
 * canvas, so it reads as an object, not a rectangle. Under
 * prefers-reduced-motion the first frame is shown instead.
 */
export default function LiquidVideo({ src, poster, className, loop = false, label, fallback }: LiquidVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduced || failed) return;

    let wasVisible = false;
    const check = () => {
      const r = video.getBoundingClientRect();
      const vh = window.innerHeight;
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
    };

    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [reduced, failed, loop]);

  if (failed && fallback) return <>{fallback}</>;

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
      className={`liquid-video mix-blend-multiply ${className ?? ''}`}
    />
  );
}
