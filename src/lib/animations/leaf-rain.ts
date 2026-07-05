/**
 * Leaf Rain — élénk-zöld levél-eső animáció a Zöldfelületi sablonú projekt
 * létrehozásakor. Forrás: az ügyfél által feltöltött "Leaf Rain _standalone_.html".
 * 90 levél, gauss-eloszlású stagger, sway + 3D flutter + fall. ~5.5s lifecycle.
 * `prefers-reduced-motion` esetén egy statikus levél-burst helyettesíti.
 */

const STYLE_ID = 'leaf-rain-style';

const STYLES = `
.leaf-rain-overlay {
  position: fixed; inset: 0; width: 100%; height: 100%;
  pointer-events: none; overflow: hidden; z-index: 9999;
  background: transparent;
  animation: lrOverlayFadeOut 700ms ease 4400ms forwards;
}
.leaf-rain-overlay .item {
  position: absolute; top: -10vh;
  left: var(--x, 50%);
  transform: translate3d(-50%, -20vh, 0) scale(var(--scale, 1)) rotate(var(--rotate, 0deg));
  will-change: transform, opacity; opacity: 0;
  animation: lrLeafFall var(--duration, 4000ms) cubic-bezier(0.32, 0, 0.36, 1) var(--delay, 0ms) forwards;
  filter: drop-shadow(0 8px 10px rgba(20, 56, 7, 0.22));
}
.leaf-rain-overlay .item .sway-wrap {
  display: block; transform-origin: 50% 50%;
  animation: lrLeafSway var(--swayDur, 2200ms) ease-in-out var(--delay, 0ms) infinite alternate;
}
.leaf-rain-overlay .item .flutter-wrap {
  display: block; transform-origin: 50% 50%; transform-style: preserve-3d;
  animation: lrLeafFlutter var(--flutterDur, 1800ms) ease-in-out var(--delay, 0ms) infinite alternate;
}
.leaf-rain-overlay .item.layer-back  {
  filter: drop-shadow(0 4px 6px rgba(20, 56, 7, 0.14)) blur(0.3px); opacity: 0.85;
}
.leaf-rain-overlay .item.layer-front {
  filter: drop-shadow(0 12px 16px rgba(20, 56, 7, 0.3));
}
@keyframes lrLeafFall {
  0% { transform: translate3d(-50%, -20vh, 0) scale(var(--scale, 1)) rotate(var(--rotate, 0deg)); opacity: 0; }
  8%  { opacity: 1; }
  92% { opacity: 1; }
  100% {
    transform:
      translate3d(calc(-50% + var(--drift, 0px)), 120vh, 0)
      scale(var(--scale, 1))
      rotate(calc(var(--rotate, 0deg) + var(--rotEnd, 360deg)));
    opacity: 0;
  }
}
@keyframes lrLeafSway {
  0%   { transform: translateX(calc(var(--swayAmp, 14px) * -1)); }
  100% { transform: translateX(var(--swayAmp, 14px)); }
}
@keyframes lrLeafFlutter {
  0%   { transform: rotateZ(-7deg) rotateY(-55deg) rotateX(8deg); }
  50%  { transform: rotateZ(0deg)  rotateY(0deg)   rotateX(-4deg); }
  100% { transform: rotateZ(7deg)  rotateY(55deg)  rotateX(8deg); }
}
@keyframes lrOverlayFadeOut { to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .leaf-rain-overlay .item { display: none !important; }
  .leaf-rain-overlay { animation: lrOverlayFadeOut 700ms ease 2400ms forwards; }
  .leaf-rain-overlay .reduced-motion-burst {
    position: absolute; left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    width: 160px; height: 160px;
    display: grid; place-items: center;
    animation: lrRmPulse 1600ms ease-out forwards;
    filter: drop-shadow(0 8px 18px rgba(31, 106, 68, 0.3));
  }
}
.leaf-rain-overlay .reduced-motion-burst { display: none; }
@media (prefers-reduced-motion: reduce) {
  .leaf-rain-overlay .reduced-motion-burst { display: grid; }
}
@keyframes lrRmPulse {
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
  30%  { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.12); }
}
@media (max-width: 600px) {
  .leaf-rain-overlay .item {
    --scale-mult: 0.78;
    transform: translate3d(-50%, -20vh, 0) scale(calc(var(--scale, 1) * var(--scale-mult))) rotate(var(--rotate, 0deg));
  }
}
`;

interface LeafPalette { hi: string; mid: string; deep: string; vein: string }

const palettes: LeafPalette[] = [
  { hi: '#e9ff9a', mid: '#86d83a', deep: '#2d8a1f', vein: '#0e3a08' },
  { hi: '#c9f57a', mid: '#5fc930', deep: '#1f7a25', vein: '#0a3210' },
  { hi: '#a8f0b6', mid: '#3fd17a', deep: '#127a48', vein: '#062a18' },
  { hi: '#dcf99a', mid: '#7fd640', deep: '#3f8a1c', vein: '#173a08' },
  { hi: '#b8f7c8', mid: '#46e08a', deep: '#1a8a52', vein: '#062a18' },
];

function ensureStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

function leafSVG(p: LeafPalette, variant: number | string): string {
  const v = typeof variant === 'number' ? variant : 0;
  const lengthRoll = (v * 37) % 100 / 100;
  const widthRoll  = (v * 53) % 100 / 100;
  const L = 80 + lengthRoll * 28;
  const W = 38 + widthRoll  * 18;
  const tip = -L / 2;
  const base = L / 2;
  const curve = ((v * 11) % 10) - 5;

  const veinYs = [-0.6, -0.3, 0.0, 0.3].map(t => (tip + (base - tip) * (t + 0.5)));
  const veinLines = veinYs.map((y) => {
    const x = (W * 0.7) * (1 - Math.abs((y - 0) / (L / 2)) * 0.7);
    const tipY = y - (L * 0.16);
    return `
    <path d="M ${curve.toFixed(1)} ${y.toFixed(1)} Q ${(x * 0.5).toFixed(1)} ${((y + tipY) / 2).toFixed(1)} ${x.toFixed(1)} ${tipY.toFixed(1)}"/>
    <path d="M ${curve.toFixed(1)} ${y.toFixed(1)} Q ${(-x * 0.5).toFixed(1)} ${((y + tipY) / 2).toFixed(1)} ${(-x).toFixed(1)} ${tipY.toFixed(1)}"/>`;
  }).join('');

  const vbX = -W - 8;
  const vbY = tip - 8;
  const vbW = (W + 8) * 2;
  const vbH = (base - tip) + 28;

  return `
<svg width="${(vbW * 0.9).toFixed(0)}" height="${(vbH * 0.9).toFixed(0)}" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="leafFace${variant}" cx="0.42" cy="0.3" r="0.85">
      <stop offset="0" stop-color="${p.hi}"/>
      <stop offset="0.55" stop-color="${p.mid}"/>
      <stop offset="1" stop-color="${p.deep}"/>
    </radialGradient>
  </defs>
  <path d="
    M ${curve.toFixed(1)} ${tip.toFixed(1)}
    C ${(W * 0.85 + curve).toFixed(1)} ${(tip * 0.55).toFixed(1)},
      ${W.toFixed(1)} ${(tip * 0.1).toFixed(1)},
      ${(W * 0.9 + curve * 0.6).toFixed(1)} ${(base * 0.55).toFixed(1)}
    C ${(W * 0.6 + curve).toFixed(1)} ${(base * 0.92).toFixed(1)},
      ${(W * 0.2).toFixed(1)} ${base.toFixed(1)},
      ${curve.toFixed(1)} ${base.toFixed(1)}
    C ${(-W * 0.2).toFixed(1)} ${base.toFixed(1)},
      ${(-W * 0.6 + curve).toFixed(1)} ${(base * 0.92).toFixed(1)},
      ${(-W * 0.9 + curve * 0.6).toFixed(1)} ${(base * 0.55).toFixed(1)}
    C ${(-W).toFixed(1)} ${(tip * 0.1).toFixed(1)},
      ${(-W * 0.85 + curve).toFixed(1)} ${(tip * 0.55).toFixed(1)},
      ${curve.toFixed(1)} ${tip.toFixed(1)} Z"
    fill="url(#leafFace${variant})" stroke="${p.vein}" stroke-opacity="0.32" stroke-width="0.7"/>
  <path d="M ${curve.toFixed(1)} ${tip.toFixed(1)} Q ${(curve * 1.4).toFixed(1)} 0 ${curve.toFixed(1)} ${base.toFixed(1)}"
        stroke="${p.vein}" stroke-opacity="0.55" stroke-width="1" fill="none" stroke-linecap="round"/>
  <g stroke="${p.vein}" stroke-opacity="0.45" stroke-width="0.7" fill="none" stroke-linecap="round">${veinLines}
  </g>
  <path d="M ${curve.toFixed(1)} ${base.toFixed(1)} L ${curve.toFixed(1)} ${(base + 12).toFixed(1)}"
        stroke="${p.vein}" stroke-width="1.8" stroke-linecap="round" fill="none"/>
  <ellipse cx="${(-W * 0.28).toFixed(1)}" cy="${(tip * 0.5).toFixed(1)}" rx="${(W * 0.22).toFixed(1)}" ry="${(L * 0.12).toFixed(1)}"
           fill="#ffffff" fill-opacity="0.22" transform="rotate(-18 ${(-W * 0.28).toFixed(1)} ${(tip * 0.5).toFixed(1)})"/>
</svg>`;
}

function buildLeafSVG(index: number): string {
  const p = palettes[index % palettes.length];
  return leafSVG(p, index);
}

function clusteredDelay(): number {
  const PEAK_CENTER = 600;
  const PEAK_WIDTH = 500;
  const BURST_WINDOW = 1800;
  const u1 = Math.random() || 1e-6;
  const u2 = Math.random();
  const g = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const d = PEAK_CENTER + g * (PEAK_WIDTH / 2);
  return Math.max(0, Math.min(BURST_WINDOW, d));
}

function buildOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = 'leaf-rain-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const rm = document.createElement('div');
  rm.className = 'reduced-motion-burst';
  rm.innerHTML = `
<svg width="160" height="160" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="lrRmGrad" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#e9ff9a"/>
      <stop offset="0.7" stop-color="#86d83a" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#2d8a1f" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="80" cy="80" r="70" fill="url(#lrRmGrad)"/>
  <g transform="translate(80 80) scale(0.7)">
    ${leafSVG(palettes[0], 'rm')}
  </g>
</svg>`;
  overlay.appendChild(rm);

  const COUNT = 90;
  for (let i = 0; i < COUNT; i++) {
    const item = document.createElement('div');
    item.className = 'item';

    const depthRoll = Math.random();
    let depthClass = '';
    let scale = 1;
    if (depthRoll < 0.28)      { depthClass = 'layer-back';  scale = 0.42 + Math.random() * 0.22; }
    else if (depthRoll > 0.7)  { depthClass = 'layer-front'; scale = 0.95 + Math.random() * 0.3; }
    else                       { scale = 0.65 + Math.random() * 0.25; }
    if (depthClass) item.classList.add(depthClass);

    const x = (Math.random() * 100).toFixed(2) + '%';
    const drift = ((Math.random() - 0.5) * 320).toFixed(1) + 'px';
    const delay = i < 10
      ? Math.floor((i / 10) * 250)
      : Math.floor(clusteredDelay());
    const baseDur = 4000 + Math.floor(Math.random() * 1600);
    const duration = baseDur + (depthClass === 'layer-back' ? 600 : 0) + (depthClass === 'layer-front' ? -300 : 0);
    const rotate = Math.floor((Math.random() - 0.5) * 120);
    const rotEnd = Math.floor(280 + Math.random() * 320) * (Math.random() < 0.5 ? 1 : -1);
    const flutterDur = 1400 + Math.floor(Math.random() * 1200);
    const swayDur = 1800 + Math.floor(Math.random() * 1400);
    const swayAmp = (8 + Math.random() * 18).toFixed(1) + 'px';

    item.style.setProperty('--x', x);
    item.style.setProperty('--drift', drift);
    item.style.setProperty('--delay', delay + 'ms');
    item.style.setProperty('--duration', duration + 'ms');
    item.style.setProperty('--scale', scale.toFixed(3));
    item.style.setProperty('--rotate', rotate + 'deg');
    item.style.setProperty('--rotEnd', rotEnd + 'deg');
    item.style.setProperty('--flutterDur', flutterDur + 'ms');
    item.style.setProperty('--swayDur', swayDur + 'ms');
    item.style.setProperty('--swayAmp', swayAmp);

    const sway = document.createElement('span');
    sway.className = 'sway-wrap';
    const flutter = document.createElement('span');
    flutter.className = 'flutter-wrap';
    flutter.innerHTML = buildLeafSVG(i);
    sway.appendChild(flutter);
    item.appendChild(sway);

    overlay.appendChild(item);
  }

  return overlay;
}

export function triggerLeafRain(): void {
  if (typeof document === 'undefined') return;
  ensureStyles();
  document.querySelector('.leaf-rain-overlay')?.remove();
  const overlay = buildOverlay();
  document.body.appendChild(overlay);
  window.setTimeout(() => {
    overlay.remove();
  }, 5500);
}
