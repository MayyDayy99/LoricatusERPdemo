/**
 * Money Rain — pénzeső animáció a számlázás task létrehozásakor.
 * 140 db SVG bankjegy + érme zápor egy fixed overlay-en, ~4 mp után auto-cleanup.
 * `prefers-reduced-motion` esetén egy zöld pipa-pulse helyettesíti.
 *
 * Forrás: az ügyfél által feltöltött "Money Rain _standalone_.html" — itt
 * TypeScript-modulba portolva, a CSS-t első hívásra injekt-álja a <head>-be.
 */

const STYLE_ID = 'money-rain-style';

const STYLES = `
.money-rain-overlay {
  position: fixed; inset: 0; width: 100%; height: 100%;
  pointer-events: none; overflow: hidden; z-index: 9999;
  background: transparent;
  animation: mrOverlayFadeOut 600ms ease 3600ms forwards;
}
.money-rain-overlay .item {
  position: absolute; top: -10vh; left: var(--x, 50%);
  transform: translate3d(-50%, -20vh, 0) scale(var(--scale, 1)) rotate(var(--rotate, 0deg));
  will-change: transform, opacity;
  opacity: 0;
  animation: mrFall var(--duration, 3200ms) cubic-bezier(0.22, 1, 0.36, 1) var(--delay, 0ms) forwards;
  filter: drop-shadow(0 6px 8px rgba(15, 23, 42, 0.18));
}
.money-rain-overlay .item .flutter-wrap {
  display: block; transform-origin: 50% 50%;
  animation: mrFlutter var(--flutterDur, 1400ms) ease-in-out var(--delay, 0ms) infinite alternate;
}
.money-rain-overlay .item.coin .flutter-wrap {
  animation: mrCoinSpin var(--spinDur, 900ms) linear var(--delay, 0ms) infinite;
}
.money-rain-overlay .item.layer-back  { filter: drop-shadow(0 4px 6px rgba(15,23,42,0.14)) blur(0.3px); opacity: 0.85; }
.money-rain-overlay .item.layer-front { filter: drop-shadow(0 10px 14px rgba(15,23,42,0.22)); }
@keyframes mrFall {
  0% { transform: translate3d(-50%, -20vh, 0) scale(var(--scale, 1)) rotate(var(--rotate, 0deg)); opacity: 0; }
  8% { opacity: 1; }
  92% { opacity: 1; }
  100% { transform: translate3d(calc(-50% + var(--drift, 0px)), 120vh, 0) scale(var(--scale, 1)) rotate(calc(var(--rotate, 0deg) + var(--rotEnd, 360deg))); opacity: 0; }
}
@keyframes mrFlutter {
  0%   { transform: rotateZ(-6deg) rotateY(-22deg) skewX(-2deg); }
  100% { transform: rotateZ(6deg)  rotateY(22deg)  skewX(2deg); }
}
@keyframes mrCoinSpin {
  0%   { transform: rotateY(0deg) scaleX(1); }
  50%  { transform: rotateY(180deg) scaleX(-1); }
  100% { transform: rotateY(360deg) scaleX(1); }
}
@keyframes mrOverlayFadeOut { to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .money-rain-overlay .item { display: none !important; }
  .money-rain-overlay { animation: mrOverlayFadeOut 600ms ease 2200ms forwards; }
  .money-rain-overlay .reduced-motion-burst {
    position: absolute; left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    width: 140px; height: 140px;
    display: grid; place-items: center;
    animation: mrRmPulse 1400ms ease-out forwards;
    filter: drop-shadow(0 8px 18px rgba(22,163,74,0.25));
  }
}
.money-rain-overlay .reduced-motion-burst { display: none; }
@media (prefers-reduced-motion: reduce) {
  .money-rain-overlay .reduced-motion-burst { display: grid; }
}
@keyframes mrRmPulse {
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
  30%  { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.1); }
}
@media (max-width: 600px) {
  .money-rain-overlay .item { --scale-mult: 0.78; transform: translate3d(-50%, -20vh, 0) scale(calc(var(--scale, 1) * var(--scale-mult))) rotate(var(--rotate, 0deg)); }
}
`;

function ensureStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

function billSVG(variant: number): string {
  const palettes = [
    { base: '#bfe3c8', mid: '#7fb98b', deep: '#3f7a4f', stroke: '#2f5e3c', accent: '#eaf6ed' },
    { base: '#c9e7c9', mid: '#86c08a', deep: '#3a6f47', stroke: '#2b5536', accent: '#f0f8f1' },
  ];
  const p = palettes[variant % palettes.length];
  return `
<svg width="84" height="42" viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="mrBg${variant}" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${p.base}"/>
      <stop offset="1" stop-color="${p.mid}"/>
    </linearGradient>
    <linearGradient id="mrSheen${variant}" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0.75" y="0.75" width="118.5" height="58.5" rx="5" fill="url(#mrBg${variant})" stroke="${p.stroke}" stroke-opacity="0.5" stroke-width="1"/>
  <rect x="4" y="4" width="112" height="52" rx="3" fill="none" stroke="${p.deep}" stroke-opacity="0.55" stroke-width="0.8"/>
  <circle cx="60" cy="30" r="14" fill="${p.accent}" fill-opacity="0.55" stroke="${p.deep}" stroke-opacity="0.5" stroke-width="0.7"/>
  <circle cx="60" cy="30" r="9"  fill="none" stroke="${p.deep}" stroke-opacity="0.55" stroke-width="0.6"/>
  <circle cx="60" cy="30" r="4"  fill="${p.deep}" fill-opacity="0.35"/>
  <text x="10" y="16" font-family="Georgia, serif" font-size="9" fill="${p.deep}" fill-opacity="0.8">100</text>
  <text x="110" y="50" font-family="Georgia, serif" font-size="9" fill="${p.deep}" fill-opacity="0.8" text-anchor="end">100</text>
  <g stroke="${p.deep}" stroke-opacity="0.35" stroke-width="0.5" fill="none">
    <path d="M8 24 C 20 20, 28 28, 40 24"/>
    <path d="M8 30 C 20 26, 28 34, 40 30"/>
    <path d="M8 36 C 20 32, 28 40, 40 36"/>
    <path d="M80 24 C 92 20, 100 28, 112 24"/>
    <path d="M80 30 C 92 26, 100 34, 112 30"/>
    <path d="M80 36 C 92 32, 100 40, 112 36"/>
  </g>
  <rect x="0.75" y="0.75" width="118.5" height="58.5" rx="5" fill="url(#mrSheen${variant})" opacity="0.5"/>
</svg>`;
}

function coinSVG(variant: number): string {
  const palettes = [
    { rim: '#a8761a', face: '#f3c14b', shine: '#fff3c4', deep: '#7a4d0d' },
    { rim: '#b88321', face: '#f6cd5a', shine: '#fff6cf', deep: '#7d520f' },
  ];
  const p = palettes[variant % palettes.length];
  return `
<svg width="38" height="38" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="mrCoinFace${variant}" cx="0.35" cy="0.35" r="0.8">
      <stop offset="0" stop-color="${p.shine}"/>
      <stop offset="0.55" stop-color="${p.face}"/>
      <stop offset="1" stop-color="${p.rim}"/>
    </radialGradient>
    <linearGradient id="mrCoinSheen${variant}" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.7"/>
      <stop offset="0.4" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <circle cx="30" cy="30" r="28" fill="url(#mrCoinFace${variant})" stroke="${p.deep}" stroke-opacity="0.55" stroke-width="1"/>
  <circle cx="30" cy="30" r="23" fill="none" stroke="${p.deep}" stroke-opacity="0.45" stroke-width="0.8"/>
  <g fill="${p.deep}" fill-opacity="0.55">
    <path d="M30 14 L32 28 L46 30 L32 32 L30 46 L28 32 L14 30 L28 28 Z"/>
  </g>
  <ellipse cx="22" cy="20" rx="10" ry="5" fill="url(#mrCoinSheen${variant})"/>
</svg>`;
}

function buildOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = 'money-rain-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const rm = document.createElement('div');
  rm.className = 'reduced-motion-burst';
  rm.innerHTML = `
<svg width="140" height="140" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="mrRmGrad" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#dcfce7"/>
      <stop offset="0.7" stop-color="#86efac" stop-opacity="0.6"/>
      <stop offset="1" stop-color="#16a34a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="70" cy="70" r="60" fill="url(#mrRmGrad)"/>
  <path d="M48 72 l16 16 l30 -36" stroke="#16a34a" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
  overlay.appendChild(rm);

  const COUNT = 140;
  const COIN_RATIO = 0.26;
  const BURST_WINDOW = 900;
  const PEAK_CENTER = 450;
  const PEAK_WIDTH = 280;

  function clusteredDelay(): number {
    const u1 = Math.random() || 1e-6;
    const u2 = Math.random();
    const g = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const d = PEAK_CENTER + g * (PEAK_WIDTH / 2);
    return Math.max(0, Math.min(BURST_WINDOW, d));
  }

  for (let i = 0; i < COUNT; i++) {
    const isCoin = Math.random() < COIN_RATIO;
    const item = document.createElement('div');
    item.className = 'item ' + (isCoin ? 'coin' : 'bill');

    const depthRoll = Math.random();
    let depthClass = '';
    let scale = 1;
    if (depthRoll < 0.22) { depthClass = 'layer-back'; scale = 0.68 + Math.random() * 0.18; }
    else if (depthRoll > 0.62) { depthClass = 'layer-front'; scale = 1.15 + Math.random() * 0.35; }
    else { scale = 0.9 + Math.random() * 0.25; }
    if (depthClass) item.classList.add(depthClass);

    const x = (Math.random() * 100).toFixed(2) + '%';
    const drift = ((Math.random() - 0.5) * 260).toFixed(1) + 'px';
    const delay = i < 12 ? Math.floor((i / 12) * 250) : Math.floor(clusteredDelay());
    const baseDur = isCoin ? 2400 : 2700;
    const duration = baseDur + Math.floor(Math.random() * 900) + (depthClass === 'layer-back' ? 250 : 0);
    const rotate = Math.floor((Math.random() - 0.5) * 80);
    const rotEnd = (isCoin ? 540 : 240) + Math.floor((Math.random() - 0.5) * 180);
    const flutterDur = 1100 + Math.floor(Math.random() * 700);
    const spinDur = 700 + Math.floor(Math.random() * 500);

    item.style.setProperty('--x', x);
    item.style.setProperty('--drift', drift);
    item.style.setProperty('--delay', delay + 'ms');
    item.style.setProperty('--duration', duration + 'ms');
    item.style.setProperty('--scale', scale.toFixed(3));
    item.style.setProperty('--rotate', rotate + 'deg');
    item.style.setProperty('--rotEnd', rotEnd + 'deg');
    item.style.setProperty('--flutterDur', flutterDur + 'ms');
    item.style.setProperty('--spinDur', spinDur + 'ms');

    const inner = document.createElement('span');
    inner.className = 'flutter-wrap';
    inner.innerHTML = isCoin ? coinSVG(i) : billSVG(i);
    item.appendChild(inner);

    overlay.appendChild(item);
  }

  return overlay;
}

export function triggerMoneyRain(): void {
  if (typeof document === 'undefined') return;
  ensureStyles();
  // Rapid-click védelem: ha már fut egy overlay, leszedjük az új előtt
  document.querySelector('.money-rain-overlay')?.remove();
  const overlay = buildOverlay();
  document.body.appendChild(overlay);
  window.setTimeout(() => {
    overlay.remove();
  }, 4200);
}
