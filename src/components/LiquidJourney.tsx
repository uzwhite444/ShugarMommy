import { useEffect, useState } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import pasteDrop from '../assets/paste-drop.webp';

/**
 * Scroll-driven liquid narrative:
 *  1. a small drop hangs under the header and falls/grows as you scroll;
 *  2. it merges into the big drop in the Ingredients section;
 *  3. below, an amber stream flows down the right page gutter in sync with
 *     scrolling and curves into the storage jar at the bottom.
 * Desktop (≥1280px) only — narrower viewports have no free gutter, and the
 * effect must never sit on top of content. Everything is pointer-events-none.
 */

interface Geometry {
  vw: number;
  vh: number;
  /** Document coords of the big drop's centre (arrival point). */
  arriveX: number;
  arriveY: number;
  arriveScale: number;
  /** Stream span in document coords. */
  streamTop: number;
  streamHeight: number;
  /** Jar mouth centre in document coords. */
  jarX: number;
  gutterX: number;
}

const DROP_BASE_W = 110; // px, at scale 1 (image is 461x760)

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export default function LiquidJourney() {
  const reduced = useReducedMotion();
  const [geom, setGeom] = useState<Geometry | null>(null);

  useEffect(() => {
    const measure = () => {
      if (window.innerWidth < 1280) {
        setGeom(null);
        return;
      }
      const anchor = document.getElementById('paste-anchor');
      const ingredients = document.getElementById('ingredients');
      const jar = document.getElementById('jar-anchor');
      if (!anchor || !ingredients || !jar) return;
      const sy = window.scrollY;
      const a = anchor.getBoundingClientRect();
      const g = ingredients.getBoundingClientRect();
      const j = jar.getBoundingClientRect();
      const vw = window.innerWidth;
      const gutter = Math.max(48, (vw - 1152) / 2);
      const streamTop = g.bottom + sy - 40;
      setGeom({
        vw,
        vh: window.innerHeight,
        arriveX: a.left + a.width / 2,
        arriveY: a.top + sy + a.height * 0.55,
        arriveScale: clamp((a.height * 0.75) / (DROP_BASE_W * 1.65), 0.8, 2),
        streamTop,
        streamHeight: j.top + sy + j.height * 0.12 - streamTop,
        jarX: j.left + j.width / 2,
        gutterX: vw - gutter / 2,
      });
    };
    measure();
    // Re-measure after images/layout settle.
    const t1 = setTimeout(measure, 600);
    const t2 = setTimeout(measure, 2000);
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', measure);
      window.removeEventListener('load', measure);
    };
  }, []);

  const { scrollY } = useScroll();

  // --- Phase 1-2: the falling drop (fixed element) ----------------------
  const path = (s: number) => {
    // Before geometry settles: park offscreen just above the gutter, so the
    // spring glides in from the top-right — reads as the drop falling in.
    if (!geom) return { x: window.innerWidth - 90, y: -160, scale: 0.22, opacity: 0 };
    const arriveScroll = Math.max(1, geom.arriveY - geom.vh * 0.52);
    const blendStart = arriveScroll * 0.6;
    // Falling: drift down the viewport and grow.
    const fallT = clamp(s / Math.max(1, blendStart), 0, 1);
    const fallY = 84 + fallT * geom.vh * 0.34;
    const fallX = geom.gutterX;
    const fallScale = 0.24 + fallT * 0.5;
    // Approach: converge onto the big drop's live viewport position.
    const t = easeInOut(clamp((s - blendStart) / Math.max(1, arriveScroll - blendStart), 0, 1));
    const targetY = geom.arriveY - s;
    const x = fallX * (1 - t) + geom.arriveX * t;
    const y = fallY * (1 - t) + targetY * t;
    const scale = fallScale * (1 - t) + geom.arriveScale * t;
    // Dissolve into the big drop right at arrival.
    const opacity = t < 0.82 ? 0.95 : 0.95 * (1 - (t - 0.82) / 0.18);
    return { x, y, scale, opacity: clamp(opacity, 0, 1) };
  };

  const dropX = useSpring(useTransform(scrollY, (s) => path(s).x), { stiffness: 90, damping: 20 });
  const dropY = useSpring(useTransform(scrollY, (s) => path(s).y), { stiffness: 90, damping: 20 });
  const dropScale = useSpring(useTransform(scrollY, (s) => path(s).scale), { stiffness: 80, damping: 18 });
  const dropOpacity = useTransform(scrollY, (s) => path(s).opacity);

  // --- Phase 3: the stream, drawn on as the scroll front passes ---------
  const streamProgress = useSpring(
    useTransform(scrollY, (s) => {
      if (!geom) return 0;
      // The liquid front sits at ~62% of the viewport height.
      const front = s + geom.vh * 0.62 - geom.streamTop;
      return clamp(front / Math.max(1, geom.streamHeight), 0, 1);
    }),
    { stiffness: 70, damping: 22 },
  );

  if (reduced || !geom) return null;

  // Stream path: straight down the gutter, then a smooth curve into the jar.
  const H = geom.streamHeight;
  const bendStart = H - 170;
  const d = `M ${geom.gutterX} 0 L ${geom.gutterX} ${bendStart} C ${geom.gutterX} ${H - 60}, ${geom.jarX} ${H - 110}, ${geom.jarX} ${H}`;

  return (
    <>
      {/* Falling drop */}
      <motion.img
        src={pasteDrop}
        alt=""
        aria-hidden
        draggable={false}
        style={{
          x: dropX,
          y: dropY,
          scale: dropScale,
          opacity: dropOpacity,
          width: DROP_BASE_W,
          translateX: '-50%',
          translateY: '-50%',
        }}
        className="pointer-events-none fixed left-0 top-0 z-30 select-none"
      />

      {/* Stream into the jar */}
      <svg
        aria-hidden
        className="pointer-events-none absolute left-0 z-20 overflow-visible"
        style={{ top: geom.streamTop, width: geom.vw, height: H }}
        viewBox={`0 0 ${geom.vw} ${H}`}
        fill="none"
      >
        <defs>
          <linearGradient id="stream-amber" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E0A95F" />
            <stop offset="55%" stopColor="#C08A4F" />
            <stop offset="100%" stopColor="#A9713C" />
          </linearGradient>
        </defs>
        {/* soft glow underlay */}
        <motion.path
          d={d}
          stroke="#C08A4F"
          strokeWidth={11}
          strokeLinecap="round"
          opacity={0.18}
          style={{ pathLength: streamProgress }}
        />
        <motion.path
          d={d}
          stroke="url(#stream-amber)"
          strokeWidth={5}
          strokeLinecap="round"
          style={{ pathLength: streamProgress }}
        />
        {/* thin inner highlight — makes the stream read as glossy liquid */}
        <motion.path
          d={d}
          stroke="#F2D9AC"
          strokeWidth={1.6}
          strokeLinecap="round"
          opacity={0.8}
          style={{ pathLength: streamProgress }}
        />
      </svg>
    </>
  );
}
