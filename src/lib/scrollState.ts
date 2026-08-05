/* ---------------------------------------------------------------------------
   One scroll source for the whole page.

   There used to be three independent `scroll` listeners — the header wanting
   direction, the sticky bar wanting "hero gone / near bottom", the ambient
   video wanting "in band" — and only one of them coalesced its work into a
   frame. Measured over ~20 programmatic scroll steps that was ~100 forced
   layout reads from the video alone, plus another ~100 rect + scrollHeight
   pairs from the sticky bar even on desktop where the bar cannot appear.

   This publishes one rAF-coalesced snapshot. Subscribers run inside that single
   frame, so N effects cost one listener and one layout flush, and the next
   scroll effect added to the page costs zero new listeners.
--------------------------------------------------------------------------- */

export interface ScrollSnapshot {
  /** window.scrollY at the time of the frame. */
  y: number;
  /** Signed delta since the previous published frame. */
  dy: number;
  /** Viewport height. */
  vh: number;
}

type Listener = (snapshot: ScrollSnapshot) => void;

const listeners = new Set<Listener>();

let snapshot: ScrollSnapshot = { y: 0, dy: 0, vh: 0 };
let frame = 0;
let attached = false;

function read(): void {
  frame = 0;
  const y = window.scrollY;
  snapshot = { y, dy: y - snapshot.y, vh: window.innerHeight };
  for (const listener of listeners) listener(snapshot);
}

function schedule(): void {
  if (frame) return;
  frame = requestAnimationFrame(read);
}

function attach(): void {
  if (attached) return;
  attached = true;
  snapshot = { y: window.scrollY, dy: 0, vh: window.innerHeight };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
}

function detach(): void {
  if (!attached) return;
  attached = false;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  window.removeEventListener('scroll', schedule);
  window.removeEventListener('resize', schedule);
}

/**
 * Subscribe to the shared scroll frame. The listener is called once
 * immediately with the current snapshot, then at most once per animation
 * frame. Returns an unsubscribe function; the underlying listeners are
 * removed when the last subscriber leaves.
 */
export function subscribeScroll(listener: Listener): () => void {
  attach();
  listeners.add(listener);
  listener({ ...snapshot, dy: 0 });
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) detach();
  };
}

/** Force a re-read on the next frame — for callers that changed layout. */
export function pokeScroll(): void {
  if (attached) schedule();
}
