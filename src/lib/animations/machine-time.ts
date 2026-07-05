/**
 * Machine Time — pontfelhő-feldolgozás animáció a "gépidő" task létrehozásakor.
 * 4 munkaállomás adat-streamel egy középső pontfelhőbe, ami wireframe-mé áll össze.
 * Fixed overlay, ~4 mp után auto-cleanup. `prefers-reduced-motion` esetén egy
 * statikus wireframe-rajz helyettesíti.
 *
 * Forrás: az ügyfél által feltöltött "Machine Time _standalone_.html" — itt
 * TypeScript-modulba portolva, a CSS-t első hívásra injekt-álja a <head>-be.
 * A keyframe-nevek `mt` prefixet kaptak, hogy ne ütközzenek a többi animációval.
 */

const STYLE_ID = 'machine-time-style';

const STYLES = `
.machine-time-overlay {
  position: fixed; inset: 0; width: 100%; height: 100%;
  pointer-events: none; overflow: hidden; z-index: 9999;
  background: transparent;
  animation: mtOverlayFadeOut 500ms ease 3500ms forwards;
}
.machine-time-overlay .stage {
  position: absolute; inset: 0; display: grid; place-items: center;
}
.machine-time-overlay .pc {
  position: absolute; top: 50%; left: var(--pc-x, 50%);
  transform: translate(-50%, -50%) translateY(20px);
  opacity: 0; will-change: transform, opacity;
  animation: mtPcIn 700ms cubic-bezier(0.22, 1, 0.36, 1) var(--pc-delay, 0ms) forwards;
}
.machine-time-overlay .pc .screen-glow {
  transform-origin: 50% 50%;
  animation: mtSoftPulse 900ms ease-in-out var(--pc-delay, 0ms) infinite alternate;
}
.machine-time-overlay .pc .screen-points circle {
  transform-box: fill-box; transform-origin: 50% 50%;
  animation: mtScreenPointBlink 1100ms ease-in-out var(--pc-delay, 0ms) infinite;
}
.machine-time-overlay .pc .screen-points circle:nth-child(2n) { animation-delay: calc(var(--pc-delay, 0ms) + 120ms); }
.machine-time-overlay .pc .screen-points circle:nth-child(3n) { animation-delay: calc(var(--pc-delay, 0ms) + 260ms); }
.machine-time-overlay .pc .screen-points circle:nth-child(5n) { animation-delay: calc(var(--pc-delay, 0ms) + 380ms); }
.machine-time-overlay .pc .screen-wire {
  stroke-dasharray: 220; stroke-dashoffset: 220;
  animation: mtScreenWireDraw 1600ms cubic-bezier(0.22, 1, 0.36, 1) calc(var(--pc-delay, 0ms) + 600ms) forwards;
}
.machine-time-overlay .pc .circuit {
  stroke-dasharray: 30; stroke-dashoffset: 30;
  animation: mtCircuitTrace 900ms ease-out calc(var(--pc-delay, 0ms) + 150ms) forwards;
}
.machine-time-overlay .pc .scan-bar {
  transform-origin: 50% 0;
  animation: mtPcScan 900ms cubic-bezier(0.5, 0, 0.5, 1) calc(var(--pc-delay, 0ms) + 200ms) infinite;
}
.machine-time-overlay .pc .emitter {
  transform-box: fill-box; transform-origin: 50% 50%;
  animation: mtEmitterPulse 850ms ease-in-out calc(var(--pc-delay, 0ms) + 250ms) infinite alternate;
}
.machine-time-overlay .pc .progress {
  transform-origin: 0% 50%; transform: scaleX(0);
  animation: mtProgressFill 3000ms cubic-bezier(0.6, 0, 0.3, 1) calc(var(--pc-delay, 0ms) + 200ms) forwards;
}
.machine-time-overlay .pc .led {
  transform-box: fill-box; transform-origin: 50% 50%;
  animation: mtLedBlink 600ms ease-in-out var(--pc-delay, 0ms) infinite alternate;
}
.machine-time-overlay .cloud {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 360px; height: 280px; pointer-events: none;
}
@media (max-width: 600px) {
  .machine-time-overlay .cloud { width: 280px; height: 220px; }
}
.machine-time-overlay .pt {
  position: absolute; left: 50%; top: 50%;
  width: 4px; height: 4px; border-radius: 50%;
  background: var(--color, #8ecaff);
  transform: translate3d(calc(var(--x, 0px) - 50%), calc(var(--y, 0px) - 50%), 0) scale(0.4);
  opacity: 0; will-change: transform, opacity;
  animation:
    mtDataStream 1200ms cubic-bezier(0.22, 1, 0.36, 1) var(--delay, 0ms) forwards,
    mtPointAssemble 1400ms cubic-bezier(0.22, 1, 0.36, 1) calc(var(--delay, 0ms) + 1100ms) forwards,
    mtWireframeReveal 700ms cubic-bezier(0.22, 1, 0.36, 1) calc(var(--delay, 0ms) + 2500ms) forwards;
}
.machine-time-overlay .connections {
  position: absolute; inset: 0; overflow: visible; opacity: 0;
  animation: mtConnectionsReveal 1400ms cubic-bezier(0.22, 1, 0.36, 1) 1600ms forwards;
}
.machine-time-overlay .connections line {
  stroke: #5db8ff; stroke-opacity: 0.35; stroke-width: 0.6;
  stroke-dasharray: 60; stroke-dashoffset: 60;
  animation: mtConnectionDraw 900ms cubic-bezier(0.22, 1, 0.36, 1) var(--c-delay, 0ms) forwards;
}
.machine-time-overlay .wireframe {
  position: absolute; top: 50%; left: 50%;
  width: 360px; height: 280px;
  transform: translate(-50%, -50%);
  opacity: 0; pointer-events: none;
  animation: mtWireframeReveal 800ms cubic-bezier(0.22, 1, 0.36, 1) 2600ms forwards;
}
.machine-time-overlay .wireframe path,
.machine-time-overlay .wireframe line {
  stroke: #5db8ff; stroke-width: 1; fill: none; stroke-opacity: 0.7;
  stroke-dasharray: 240; stroke-dashoffset: 240;
  animation: mtWireDraw 900ms cubic-bezier(0.22, 1, 0.36, 1) 2700ms forwards;
}
.machine-time-overlay .scan-line {
  position: absolute; top: 50%; left: 50%;
  width: 380px; height: 2px;
  transform: translate(-50%, -50%); opacity: 0;
  background: linear-gradient(to right,
    rgba(141, 202, 255, 0) 0%,
    rgba(207, 234, 255, 0.95) 50%,
    rgba(141, 202, 255, 0) 100%);
  box-shadow: 0 0 12px rgba(141, 202, 255, 0.45);
  animation: mtScanSweep 1500ms cubic-bezier(0.22, 1, 0.36, 1) 1700ms forwards;
}
@media (max-width: 600px) {
  .machine-time-overlay .scan-line { width: 300px; }
}
.machine-time-overlay .pulse {
  position: absolute; top: 50%; left: 50%;
  width: 80px; height: 80px; border-radius: 50%;
  transform: translate(-50%, -50%) scale(0.4);
  border: 1px solid rgba(141, 202, 255, 0.5);
  opacity: 0;
  animation: mtCorePulse 1300ms cubic-bezier(0.22, 1, 0.36, 1) 1500ms forwards;
}
.machine-time-overlay .pulse.delay2 { animation-delay: 1900ms; }

@keyframes mtPcIn {
  0%   { opacity: 0; transform: translate(-50%, -50%) translateY(16px); }
  100% { opacity: 1; transform: translate(-50%, -50%) translateY(0); }
}
@keyframes mtSoftPulse {
  0%   { opacity: 0.7; }
  100% { opacity: 1; }
}
@keyframes mtScreenPointBlink {
  0%   { opacity: 0.35; transform: scale(0.85); }
  50%  { opacity: 1;    transform: scale(1.2); }
  100% { opacity: 0.45; transform: scale(1); }
}
@keyframes mtScreenWireDraw {
  0%   { stroke-dashoffset: 220; opacity: 0; }
  20%  { opacity: 1; }
  100% { stroke-dashoffset: 0;   opacity: 1; }
}
@keyframes mtEmitterPulse {
  0%   { opacity: 0.4; transform: scale(0.8); }
  100% { opacity: 1;   transform: scale(1.3); }
}
@keyframes mtProgressFill {
  0%   { transform: scaleX(0); }
  100% { transform: scaleX(1); }
}
@keyframes mtLedBlink {
  0%   { opacity: 0.4; }
  100% { opacity: 1; }
}
@keyframes mtCircuitTrace {
  0%   { stroke-dashoffset: 30; opacity: 0; }
  20%  { opacity: 1; }
  100% { stroke-dashoffset: 0; opacity: 1; }
}
@keyframes mtPcScan {
  0%   { transform: translateY(0)  scaleX(0.4); opacity: 0; }
  20%  { opacity: 1; }
  100% { transform: translateY(56px) scaleX(1); opacity: 0; }
}
@keyframes mtDataStream {
  0% {
    transform: translate3d(calc(var(--x, 0px) - 50%), calc(var(--y, 0px) - 50%), 0) scale(0.4);
    opacity: 0;
  }
  20% { opacity: var(--opacity, 0.9); }
  100% {
    transform: translate3d(calc(var(--tx, 0px) - 50%), calc(var(--ty, 0px) - 50%), 0) scale(var(--scale, 1));
    opacity: var(--opacity, 0.9);
  }
}
@keyframes mtPointAssemble {
  0% {
    transform: translate3d(calc(var(--tx, 0px) - 50%), calc(var(--ty, 0px) - 50%), 0) scale(var(--scale, 1));
  }
  50% {
    transform: translate3d(
      calc(var(--tx, 0px) - 50% + var(--drift-x, 0px)),
      calc(var(--ty, 0px) - 50% + var(--drift-y, 0px)),
      0
    ) scale(var(--scale, 1));
  }
  100% {
    transform: translate3d(calc(var(--tx, 0px) - 50%), calc(var(--ty, 0px) - 50%), 0) scale(var(--scale, 1));
  }
}
@keyframes mtWireframeReveal {
  0% {
    transform: translate3d(calc(var(--tx, 0px) - 50%), calc(var(--ty, 0px) - 50%), 0) scale(var(--scale, 1));
    opacity: var(--opacity, 0.9);
  }
  50% {
    transform: translate3d(calc(var(--gx, 0px) - 50%), calc(var(--gy, 0px) - 50%), 0) scale(0.9);
    opacity: var(--opacity, 0.9);
  }
  100% {
    transform: translate3d(calc(var(--gx, 0px) - 50%), calc(var(--gy, 0px) - 50%), 0) scale(0.6);
    opacity: 0;
  }
}
@keyframes mtConnectionsReveal {
  0%   { opacity: 0; }
  30%  { opacity: 1; }
  80%  { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes mtConnectionDraw {
  0%   { stroke-dashoffset: 60; }
  100% { stroke-dashoffset: 0; }
}
@keyframes mtWireDraw {
  0%   { stroke-dashoffset: 240; opacity: 0; }
  20%  { opacity: 1; }
  100% { stroke-dashoffset: 0; opacity: 1; }
}
@keyframes mtScanSweep {
  0%   { transform: translate(-50%, calc(-50% - 120px)); opacity: 0; }
  15%  { opacity: 0.9; }
  85%  { opacity: 0.9; }
  100% { transform: translate(-50%, calc(-50% + 120px)); opacity: 0; }
}
@keyframes mtCorePulse {
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
  30%  { opacity: 0.7; }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(2.4); }
}
@keyframes mtOverlayFadeOut { to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .machine-time-overlay .pc,
  .machine-time-overlay .pt,
  .machine-time-overlay .connections,
  .machine-time-overlay .scan-line,
  .machine-time-overlay .pulse { display: none !important; }
  .machine-time-overlay { animation: mtOverlayFadeOut 500ms ease 2200ms forwards; }
  .machine-time-overlay .wireframe { animation: mtRmStatic 1400ms ease-out forwards; }
  .machine-time-overlay .wireframe path,
  .machine-time-overlay .wireframe line { animation: mtRmDraw 900ms ease-out forwards; }
}
@keyframes mtRmStatic {
  0%   { opacity: 0; }
  30%  { opacity: 1; }
  100% { opacity: 1; }
}
@keyframes mtRmDraw {
  0%   { stroke-dashoffset: 240; }
  100% { stroke-dashoffset: 0; }
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

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Workstation / PC ikon SVG-je. */
function pcSVG(id: number): string {
  const side = id % 2 === 0 ? 52 : -52;
  const sideOut = id % 2 === 0 ? 60 : -60;
  const sideMid = id % 2 === 0 ? 58 : -58;
  return `
<svg width="128" height="114" viewBox="-64 -57 128 114" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="mtPcBody-${id}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#3a4150"/>
      <stop offset="1" stop-color="#1c212b"/>
    </linearGradient>
    <linearGradient id="mtPcScreen-${id}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#0a1422"/>
      <stop offset="1" stop-color="#06101c"/>
    </linearGradient>
    <radialGradient id="mtPcEmitter-${id}" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#cfeaff" stop-opacity="0.95"/>
      <stop offset="0.5" stop-color="#5db8ff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#5db8ff" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="mtPcScreenClip-${id}">
      <rect x="-44" y="-32" width="88" height="56" rx="3"/>
    </clipPath>
  </defs>
  <rect x="-52" y="-40" width="104" height="72" rx="6" fill="url(#mtPcBody-${id})" stroke="#0d1118" stroke-width="1.5"/>
  <rect class="screen-glow" x="-44" y="-32" width="88" height="56" rx="3" fill="url(#mtPcScreen-${id})" stroke="#5db8ff" stroke-opacity="0.7" stroke-width="1"/>
  <g clip-path="url(#mtPcScreenClip-${id})">
    <g stroke="#5db8ff" stroke-opacity="0.18" stroke-width="0.5">
      <line x1="-44" y1="-20" x2="44" y2="-20"/>
      <line x1="-44" y1="-8"  x2="44" y2="-8"/>
      <line x1="-44" y1="4"   x2="44" y2="4"/>
      <line x1="-44" y1="16"  x2="44" y2="16"/>
      <line x1="-28" y1="-32" x2="-28" y2="24"/>
      <line x1="-12" y1="-32" x2="-12" y2="24"/>
      <line x1="4"   y1="-32" x2="4"   y2="24"/>
      <line x1="20"  y1="-32" x2="20"  y2="24"/>
      <line x1="36"  y1="-32" x2="36"  y2="24"/>
    </g>
    <g class="screen-points" fill="#8ecaff">
      <circle cx="-28" cy="-10" r="1.2"/>
      <circle cx="-18" cy="-16" r="1.1"/>
      <circle cx="-8"  cy="-12" r="1.3"/>
      <circle cx="2"   cy="-18" r="1.1"/>
      <circle cx="14"  cy="-10" r="1.2"/>
      <circle cx="24"  cy="-14" r="1.0"/>
      <circle cx="-24" cy="4"   r="1.2" fill="#cfeaff"/>
      <circle cx="-12" cy="8"   r="1.1"/>
      <circle cx="0"   cy="2"   r="1.3" fill="#cfeaff"/>
      <circle cx="12"  cy="6"   r="1.2"/>
      <circle cx="22"  cy="4"   r="1.1"/>
      <circle cx="32"  cy="10"  r="1.0"/>
      <circle cx="-30" cy="16"  r="1.1"/>
      <circle cx="-16" cy="18"  r="1.2"/>
      <circle cx="-2"  cy="14"  r="1.3" fill="#cfeaff"/>
      <circle cx="10"  cy="18"  r="1.1"/>
      <circle cx="26"  cy="16"  r="1.2"/>
    </g>
    <path class="screen-wire" d="M -32 18 L -32 -6 L -10 -22 L 14 -22 L 14 -6 L 36 -6 L 36 18 Z"
          fill="none" stroke="#cfeaff" stroke-opacity="0.85" stroke-width="0.9"/>
    <rect class="scan-bar" x="-44" y="-32" width="88" height="2" fill="#cfeaff" fill-opacity="0.85"/>
    <rect x="-40" y="19" width="80" height="2.5" rx="1.25" fill="#1a2a44"/>
    <rect class="progress" x="-40" y="19" width="80" height="2.5" rx="1.25" fill="#5db8ff"/>
  </g>
  <rect x="-44" y="-32" width="88" height="56" rx="3" fill="none" stroke="#5db8ff" stroke-opacity="0.15" stroke-width="0.5"/>
  <circle class="emitter" cx="${side}" cy="0" r="10" fill="url(#mtPcEmitter-${id})"/>
  <path class="circuit" d="M ${side} 0 L ${sideOut} 0"
        fill="none" stroke="#5db8ff" stroke-opacity="0.85" stroke-width="1" stroke-linecap="round"/>
  <path class="circuit" d="M ${side} -8 L ${sideMid} -8 L ${sideMid} -16"
        fill="none" stroke="#5db8ff" stroke-opacity="0.55" stroke-width="0.8" stroke-linecap="round"/>
  <path class="circuit" d="M ${side} 8 L ${sideMid} 8 L ${sideMid} 16"
        fill="none" stroke="#5db8ff" stroke-opacity="0.55" stroke-width="0.8" stroke-linecap="round"/>
  <rect x="-10" y="32" width="20" height="5" rx="1.5" fill="#0d1118"/>
  <rect x="-22" y="37" width="44" height="4" rx="1.5" fill="#0d1118"/>
  <circle class="led" cx="46" cy="28" r="1.8" fill="#8ecaff"/>
</svg>`;
}

/** A pontfelhő cél-alakja: lágy, elliptikus blob, jitterrel. */
function cloudTarget(i: number, total: number): { x: number; y: number } {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const t = i / total;
  const angle = i * golden;
  const rMax = 120;
  const rMin = 18;
  const r = rMin + Math.pow(t, 0.6) * (rMax - rMin) + rand(-10, 10);
  const x = Math.cos(angle) * r;
  const y = Math.sin(angle) * r * 0.66 + rand(-6, 6);
  return { x, y };
}

/** A végső wireframe-rács cél-pozíciója egy részecskéhez. */
function gridTarget(i: number, cols: number, rows: number, cellW: number, cellH: number): { x: number; y: number } {
  const col = i % cols;
  const row = Math.floor(i / cols) % rows;
  const x = (col - (cols - 1) / 2) * cellW;
  const y = (row - (rows - 1) / 2) * cellH;
  return { x, y };
}

function buildOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = 'machine-time-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const stage = document.createElement('div');
  stage.className = 'stage';
  overlay.appendChild(stage);

  const pcConfigs = [
    { x: '16%', y: '-110px', delay: 0 },
    { x: '20%', y: '110px', delay: 120 },
    { x: '84%', y: '-110px', delay: 80 },
    { x: '80%', y: '110px', delay: 200 },
  ];
  pcConfigs.forEach((cfg, idx) => {
    const pc = document.createElement('div');
    pc.className = 'pc';
    pc.style.setProperty('--pc-x', cfg.x);
    pc.style.top = `calc(50% + ${cfg.y})`;
    pc.style.setProperty('--pc-delay', cfg.delay + 'ms');
    pc.innerHTML = pcSVG(idx);
    stage.appendChild(pc);
  });

  const cloud = document.createElement('div');
  cloud.className = 'cloud';
  overlay.appendChild(cloud);

  const conns = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  conns.setAttribute('class', 'connections');
  conns.setAttribute('viewBox', '-180 -140 360 280');
  cloud.appendChild(conns);

  const COUNT = 88;
  const targets: Array<{ x: number; y: number }> = [];
  const gridCols = 11;
  const gridRows = 7;
  const gridCellW = 26;
  const gridCellH = 28;

  const originMap = [
    { ox: -320, oy: -70 },
    { ox: -300, oy: 70 },
    { ox: 320, oy: -70 },
    { ox: 300, oy: 70 },
  ];
  const palette = ['#cfeaff', '#8ecaff', '#5db8ff', '#3a8ed1'];

  for (let i = 0; i < COUNT; i++) {
    const target = cloudTarget(i, COUNT);
    targets.push(target);

    const origin = originMap[i % 4];
    const ox = origin.ox + rand(-20, 20);
    const oy = origin.oy + rand(-10, 10);

    const grid = gridTarget(i, gridCols, gridRows, gridCellW, gridCellH);

    const depth = Math.random();
    const color = palette[Math.min(3, Math.floor(depth * 4))];
    const scale = 0.55 + depth * 0.95;
    const opacity = (0.55 + depth * 0.4).toFixed(2);
    const delay = Math.floor(rand(0, 600));
    const driftX = rand(-6, 6).toFixed(1);
    const driftY = rand(-5, 5).toFixed(1);

    const pt = document.createElement('div');
    pt.className = 'pt';
    pt.style.setProperty('--x', ox.toFixed(1) + 'px');
    pt.style.setProperty('--y', oy.toFixed(1) + 'px');
    pt.style.setProperty('--tx', target.x.toFixed(1) + 'px');
    pt.style.setProperty('--ty', target.y.toFixed(1) + 'px');
    pt.style.setProperty('--gx', grid.x.toFixed(1) + 'px');
    pt.style.setProperty('--gy', grid.y.toFixed(1) + 'px');
    pt.style.setProperty('--drift-x', driftX + 'px');
    pt.style.setProperty('--drift-y', driftY + 'px');
    pt.style.setProperty('--scale', scale.toFixed(2));
    pt.style.setProperty('--opacity', opacity);
    pt.style.setProperty('--delay', delay + 'ms');
    pt.style.setProperty('--color', color);
    cloud.appendChild(pt);
  }

  // Összekötő vonalak: minden 2. pontot a legközelebbi szomszédjához kötjük
  const subset = targets.filter((_, i) => i % 2 === 0);
  const lines: Array<[{ x: number; y: number }, { x: number; y: number }]> = [];
  for (let i = 0; i < subset.length; i++) {
    let bestD = Infinity;
    let bestJ = -1;
    for (let j = 0; j < subset.length; j++) {
      if (i === j) continue;
      const dx = subset[i].x - subset[j].x;
      const dy = subset[i].y - subset[j].y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        bestJ = j;
      }
    }
    if (bestJ >= 0 && bestD < 60 * 60) {
      lines.push([subset[i], subset[bestJ]]);
    }
  }
  lines.forEach((pair, idx) => {
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ln.setAttribute('x1', pair[0].x.toFixed(1));
    ln.setAttribute('y1', pair[0].y.toFixed(1));
    ln.setAttribute('x2', pair[1].x.toFixed(1));
    ln.setAttribute('y2', pair[1].y.toFixed(1));
    ln.style.setProperty('--c-delay', 1700 + idx * 18 + 'ms');
    conns.appendChild(ln);
  });

  const scan = document.createElement('div');
  scan.className = 'scan-line';
  overlay.appendChild(scan);

  const pulse1 = document.createElement('div');
  pulse1.className = 'pulse';
  const pulse2 = document.createElement('div');
  pulse2.className = 'pulse delay2';
  overlay.appendChild(pulse1);
  overlay.appendChild(pulse2);

  const wf = document.createElement('div');
  wf.className = 'wireframe';
  wf.innerHTML = `
<svg width="360" height="280" viewBox="-180 -140 360 280" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M -140 60 L -140 -30 L -40 -80 L 60 -80 L 60 -30 L 140 -30 L 140 60 Z"/>
  <line x1="-140" y1="20" x2="140" y2="20"/>
  <line x1="-140" y1="40" x2="140" y2="40"/>
  <line x1="-40"  y1="-80" x2="-40"  y2="60"/>
  <line x1="60"   y1="-80" x2="60"   y2="60"/>
  <line x1="-140" y1="-30" x2="140"  y2="-30"/>
  <line x1="-40"  y1="-80" x2="60"   y2="-80"/>
  <line x1="-90"  y1="-30" x2="-90"  y2="60"/>
  <line x1="10"   y1="-30" x2="10"   y2="60"/>
  <line x1="100"  y1="-30" x2="100"  y2="60"/>
</svg>`;
  overlay.appendChild(wf);

  return overlay;
}

export function triggerMachineTime(): void {
  if (typeof document === 'undefined') return;
  ensureStyles();
  // Rapid-click védelem: ha már fut egy overlay, leszedjük az új előtt
  document.querySelector('.machine-time-overlay')?.remove();
  const overlay = buildOverlay();
  document.body.appendChild(overlay);
  window.setTimeout(() => {
    overlay.remove();
  }, 4200);
}
