import { useEffect, useState } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform, useVelocity } from 'motion/react';
import type { MotionValue } from 'motion/react';
import pasteDrop from '../assets/paste-drop.webp';
import splash from '../assets/splash.webp';

/**
 * Scroll-scrubbed liquid film in five acts (desktop ≥1280px, decor only):
 *  1. a drop falls down the page centre, wobbling and stretching with
 *     scroll velocity, growing as it "accumulates";
 *  2. it merges into the big drop in Ingredients;
 *  3. scrolling on, it re-emerges, hits the stats band and SPLASHES —
 *     crown splash, flying droplets and a smear along the band edge;
 *  4. the liquid then streams down through the middle of the price list,
 *     meandering through the whitespace, and slides to the right gutter;
 *  5. finally it pours into the storage jar with a splash and a ripple.
 * Every beat is tied to scrollY, so scrolling scrubs the film back and forth.
 */

interface Geometry {
  vw: number;
  vh: number;
  arriveX: number;
  arriveY: number;
  arriveScale: number;
  ingBottom: number;
  impactY: number;
  statsBottom: number;
  servicesTop: number;
  servicesBottom: number;
  gapX: number;
  gutterX: number;
  jarX: number;
  jarMouthY: number;
}

const DROP_BASE_W = 110;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** The liquid "front" rides at 62% of the viewport height. */
const FRONT = 0.62;

const IMPACT_SPAN = 140; // px of scroll over which the splash plays

const DROPLETS = [
  { dx: -1, dist: 46, up: 34, size: 7 },
  { dx: -1, dist: 78, up: 22, size: 5 },
  { dx: -1, dist: 110, up: 12, size: 4 },
  { dx: 1, dist: 52, up: 30, size: 6 },
  { dx: 1, dist: 88, up: 18, size: 5 },
  { dx: 1, dist: 122, up: 10, size: 4 },
];

/** One droplet flying out of the impact, scrubbed by the impact progress. */
function ImpactDroplet({
  impactP,
  originX,
  dx,
  dist,
  up,
  size,
}: {
  impactP: MotionValue<number>;
  originX: number;
  dx: number;
  dist: number;
  up: number;
  size: number;
}) {
  const x = useTransform(impactP, (v) => dx * dist * easeInOut(v));
  const y = useTransform(impactP, (v) => -up * Math.sin(Math.PI * clamp(v, 0, 1)) + 8 * v * v);
  const opacity = useTransform(impactP, [0, 0.1, 0.7, 1], [0, 1, 0.9, 0]);
  return (
    <motion.span
      style={{ left: originX, width: size, height: size * 1.3, x, y, opacity }}
      className="absolute top-[-6px] rounded-full bg-[#C08A4F]"
    />
  );
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
      const stats = document.getElementById('stats-band');
      const services = document.getElementById('services');
      const receipt = document.getElementById('receipt-card');
      const jar = document.getElementById('jar-anchor');
      if (!anchor || !ingredients || !stats || !services || !receipt || !jar) return;
      const sy = window.scrollY;
      const a = anchor.getBoundingClientRect();
      const g = ingredients.getBoundingClientRect();
      const st = stats.getBoundingClientRect();
      const sv = services.getBoundingClientRect();
      const rc = receipt.getBoundingClientRect();
      const j = jar.getBoundingClientRect();
      const vw = window.innerWidth;
      const gutter = Math.max(48, (vw - 1152) / 2);
      setGeom({
        vw,
        vh: window.innerHeight,
        arriveX: a.left + a.width / 2,
        arriveY: a.top + sy + a.height * 0.55,
        arriveScale: clamp((a.height * 0.75) / (DROP_BASE_W * 1.65), 0.8, 2),
        ingBottom: g.bottom + sy,
        impactY: st.top + sy + 4,
        statsBottom: st.bottom + sy,
        servicesTop: sv.top + sy,
        servicesBottom: sv.bottom + sy,
        gapX: rc.left - 30,
        gutterX: vw - gutter / 2,
        jarX: j.left + j.width / 2,
        jarMouthY: j.top + sy + j.height * 0.12,
      });
    };
    measure();
    const t1 = setTimeout(measure, 600);
    const t2 = setTimeout(measure, 2000);
    // Debounced: resize events fire before layout settles — measuring
    // immediately captures stale rects from the previous viewport width.
    let deb: ReturnType<typeof setTimeout>;
    const requestMeasure = () => {
      clearTimeout(deb);
      deb = setTimeout(measure, 350);
    };
    window.addEventListener('resize', requestMeasure);
    window.addEventListener('load', requestMeasure);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(deb);
      window.removeEventListener('resize', requestMeasure);
      window.removeEventListener('load', requestMeasure);
    };
  }, []);

  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);

  // ---- Act 1-2: centre fall + merge ------------------------------------
  const path = (s: number) => {
    if (!geom) return { x: window.innerWidth / 2, y: -160, scale: 0.22, opacity: 0 };
    const arriveScroll = Math.max(1, geom.arriveY - geom.vh * 0.52);
    const blendStart = arriveScroll * 0.6;
    const fallT = clamp(s / Math.max(1, blendStart), 0, 1);
    const fallY = 84 + fallT * geom.vh * 0.34;
    const fallScale = 0.24 + fallT * 0.5;
    const t = easeInOut(clamp((s - blendStart) / Math.max(1, arriveScroll - blendStart), 0, 1));
    const targetY = geom.arriveY - s;
    const y = fallY * (1 - t) + targetY * t;
    const scale = fallScale * (1 - t) + geom.arriveScale * t;
    const opacity = t < 0.82 ? 0.96 : 0.96 * (1 - (t - 0.82) / 0.18);
    return { x: geom.arriveX, y, scale, opacity: clamp(opacity, 0, 1) };
  };

  const dropX = useSpring(useTransform(scrollY, (s) => path(s).x), { stiffness: 90, damping: 20 });
  const dropY = useSpring(useTransform(scrollY, (s) => path(s).y), { stiffness: 90, damping: 20 });
  const dropScale = useSpring(useTransform(scrollY, (s) => path(s).scale), { stiffness: 80, damping: 18 });
  const dropOpacity = useTransform(scrollY, (s) => path(s).opacity);
  const dropRotate = useTransform(scrollY, (s) => Math.sin(s / 70) * 2.5);
  // Fluid stretch keyed to scroll velocity: fast scroll = elongated drop.
  const stretch = useSpring(useTransform(velocity, [-2600, 0, 2600], [-0.14, 0, 0.22]), {
    stiffness: 240,
    damping: 26,
  });
  const stretchY = useTransform(stretch, (v) => 1 + v);
  const stretchX = useTransform(stretch, (v) => 1 - v * 0.55);

  // ---- Act 3: re-emerge and hit the stats band -------------------------
  const front = (s: number) => (geom ? s + geom.vh * FRONT : 0);
  const impactP = useTransform(scrollY, (s) =>
    geom ? clamp((front(s) - geom.impactY) / IMPACT_SPAN, 0, 1) : 0,
  );
  const drop2Y = useTransform(scrollY, (s) => {
    if (!geom) return -300;
    return Math.min(geom.vh * FRONT, geom.impactY - s); // pins onto the band
  });
  const drop2Opacity = useTransform(scrollY, (s) => {
    if (!geom) return 0;
    const f = front(s);
    const fadeIn = clamp((f - (geom.ingBottom + 40)) / 90, 0, 1);
    const gone = clamp((f - geom.impactY) / (IMPACT_SPAN * 0.35), 0, 1);
    return fadeIn * (1 - gone) * 0.96;
  });
  const drop2ScaleY = useTransform(impactP, (p) => 0.52 * (1 - 0.72 * clamp(p / 0.3, 0, 1)));
  const drop2ScaleX = useTransform(impactP, (p) => 0.52 * (1 + 1.1 * clamp(p / 0.3, 0, 1)));

  const splashScale = useTransform(impactP, [0, 1], [0.5, 1.08]);
  const splashOpacity = useTransform(impactP, [0, 0.08, 0.3, 0.78, 1], [0, 0.4, 1, 1, 0]);
  const smearScaleX = useTransform(impactP, (p) => easeInOut(p));
  const smearOpacity = useTransform(impactP, [0, 0.15, 0.85, 1], [0, 0.9, 0.85, 0.55]);

  // ---- Act 4: the stream ------------------------------------------------
  const streamProgress = useSpring(
    useTransform(scrollY, (s) => {
      if (!geom) return 0;
      const span = Math.max(1, geom.jarMouthY - 60 - geom.impactY);
      return clamp((front(s) - geom.impactY - IMPACT_SPAN * 0.55) / span, 0, 1);
    }),
    { stiffness: 70, damping: 22 },
  );

  // ---- Act 5: jar splash ------------------------------------------------
  const jarP = useTransform(scrollY, (s) =>
    geom ? clamp((front(s) - (geom.jarMouthY - 80)) / 100, 0, 1) : 0,
  );
  const jarSplashOpacity = useTransform(jarP, [0, 0.15, 0.45, 0.9, 1], [0, 0.5, 1, 0.9, 0.6]);
  const jarSplashScale = useTransform(jarP, [0, 1], [0.22, 0.5]);
  const rippleScale = useTransform(jarP, [0, 1], [0.3, 1.5]);
  const rippleOpacity = useTransform(jarP, [0, 0.3, 1], [0, 0.55, 0]);

  if (reduced || !geom) return null;

  // Stream route: band centre → curve into the price-list gap → meander
  // through the whitespace → slide to the right gutter → pour into the jar.
  const T = geom.impactY;
  const H = geom.jarMouthY - T;
  const cx = geom.arriveX;
  const bandOut = geom.statsBottom - T + 16;
  const svcIn = geom.servicesTop - T + 150;
  const svcOut = geom.servicesBottom - T - 40;
  const third = (svcOut - svcIn) / 3;
  const g = geom.gapX;
  const d = [
    `M ${cx} 0`,
    `L ${cx} ${bandOut}`,
    `C ${cx} ${bandOut + 90}, ${g} ${svcIn - 90}, ${g} ${svcIn}`,
    `C ${g + 16} ${svcIn + third * 0.5}, ${g - 16} ${svcIn + third * 0.7}, ${g} ${svcIn + third}`,
    `C ${g + 14} ${svcIn + third * 1.5}, ${g - 14} ${svcIn + third * 1.7}, ${g} ${svcIn + third * 2}`,
    `C ${g + 12} ${svcIn + third * 2.5}, ${g - 12} ${svcIn + third * 2.7}, ${g} ${svcOut}`,
    `C ${g} ${svcOut + 130}, ${geom.gutterX} ${svcOut + 150}, ${geom.gutterX} ${svcOut + 280}`,
    `L ${geom.gutterX} ${H - 170}`,
    `C ${geom.gutterX} ${H - 60}, ${geom.jarX} ${H - 110}, ${geom.jarX} ${H}`,
  ].join(' ');

  return (
    <>
      {/* Act 1-2: the falling drop (fixed, page centre) */}
      <motion.div
        aria-hidden
        style={{ x: dropX, y: dropY, rotate: dropRotate, scale: dropScale, opacity: dropOpacity }}
        className="pointer-events-none fixed left-0 top-0 z-30"
      >
        <motion.img
          src={pasteDrop}
          alt=""
          draggable={false}
          style={{ width: DROP_BASE_W, scaleY: stretchY, scaleX: stretchX, translateX: '-50%', translateY: '-50%' }}
          className="select-none"
        />
      </motion.div>

      {/* Act 3: second fall + impact (fixed drop, absolute splash) */}
      <motion.img
        src={pasteDrop}
        alt=""
        aria-hidden
        draggable={false}
        style={{
          x: geom.arriveX,
          y: drop2Y,
          scaleX: drop2ScaleX,
          scaleY: drop2ScaleY,
          opacity: drop2Opacity,
          width: DROP_BASE_W,
          translateX: '-50%',
          translateY: '-92%',
        }}
        className="pointer-events-none fixed left-0 top-0 z-30 select-none origin-bottom"
      />
      <div aria-hidden className="pointer-events-none absolute left-0 z-20 w-full" style={{ top: geom.impactY }}>
        {/* crown splash */}
        <motion.img
          src={splash}
          alt=""
          draggable={false}
          style={{ x: geom.arriveX, scale: splashScale, opacity: splashOpacity, width: 300, translateX: '-50%', translateY: '-86%' }}
          className="absolute left-0 top-0 select-none"
        />
        {/* smear spreading along the band edge */}
        <motion.div
          style={{ x: geom.arriveX, scaleX: smearScaleX, opacity: smearOpacity, width: 380, translateX: '-50%' }}
          className="absolute top-[-2px] h-[5px] rounded-full bg-gradient-to-r from-transparent via-[#C08A4F] to-transparent"
        />
        {/* flying droplets */}
        {DROPLETS.map((p, i) => (
          <ImpactDroplet key={i} impactP={impactP} originX={geom.arriveX} {...p} />
        ))}
      </div>

      {/* Act 4: the stream */}
      <svg
        aria-hidden
        className="pointer-events-none absolute left-0 z-20 overflow-visible"
        style={{ top: T, width: geom.vw, height: H }}
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
        <motion.path d={d} stroke="#C08A4F" strokeWidth={11} strokeLinecap="round" opacity={0.18} style={{ pathLength: streamProgress }} />
        <motion.path d={d} stroke="url(#stream-amber)" strokeWidth={5} strokeLinecap="round" style={{ pathLength: streamProgress }} />
        <motion.path d={d} stroke="#F2D9AC" strokeWidth={1.6} strokeLinecap="round" opacity={0.8} style={{ pathLength: streamProgress }} />
      </svg>

      {/* Act 5: splash + ripple at the jar mouth */}
      <div aria-hidden className="pointer-events-none absolute left-0 z-20 w-full" style={{ top: geom.jarMouthY }}>
        <motion.img
          src={splash}
          alt=""
          draggable={false}
          style={{ x: geom.jarX, scale: jarSplashScale, opacity: jarSplashOpacity, width: 300, translateX: '-50%', translateY: '-78%' }}
          className="absolute left-0 top-0 select-none"
        />
        <motion.div
          style={{ x: geom.jarX, scale: rippleScale, opacity: rippleOpacity, translateX: '-50%', translateY: '-50%' }}
          className="absolute left-0 top-1 h-10 w-24 rounded-[100%] border-2 border-[#C08A4F]"
        />
      </div>
    </>
  );
}
