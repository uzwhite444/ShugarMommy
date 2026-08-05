import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { domAnimation, LazyMotion } from 'motion/react';
import App from './App';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

// `domAnimation` covers animations, exit and hover/tap/focus/inView gestures —
// everything this site uses. It deliberately excludes the layout-projection and
// drag engines, which is where the bundle saving comes from. `strict` makes any
// leftover `motion.*` proxy throw instead of silently pulling those back in.
createRoot(rootEl).render(
  <StrictMode>
    <LazyMotion features={domAnimation} strict>
      <App />
    </LazyMotion>
  </StrictMode>,
);
