/**
 * Office Workflow — prémium "iroda" task létrehozási animáció.
 * Üveg-kártyák szóródnak be, majd egy rendezett dashboard-rácsba pattannak,
 * összekötő vonalakkal + por-részecskékkel. Fixed overlay, ~4 mp után
 * auto-cleanup. `prefers-reduced-motion` esetén statikus, rendezett snapshot.
 *
 * Forrás: az ügyfél által feltöltött "Office Workflow _standalone_.html" — itt
 * TypeScript-modulba portolva, a CSS-t első hívásra injekt-álja a <head>-be.
 * A keyframe-nevek `ow` prefixet kaptak, hogy ne ütközzenek a többi animációval.
 */

const STYLE_ID = 'office-workflow-style';

const STYLES = `
.office-premium-overlay {
  position: fixed; inset: 0; width: 100%; height: 100%;
  pointer-events: none; overflow: hidden; z-index: 9999;
  background: transparent;
  animation: owOverlayFadeOut 600ms ease 3400ms forwards;
  font-family: "Inter", "Helvetica Neue", Helvetica, system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
}
.office-premium-overlay .stage {
  position: absolute; inset: 0; display: grid; place-items: center;
}
.office-premium-overlay .canvas {
  position: relative; width: 720px; height: 460px;
}
@media (max-width: 900px) {
  .office-premium-overlay .canvas { width: 560px; height: 380px; }
}
@media (max-width: 640px) {
  .office-premium-overlay .canvas { width: 360px; height: 300px; }
}
.office-premium-overlay .guides {
  position: absolute; inset: 0; pointer-events: none; overflow: visible; opacity: 0;
  animation: owGuideReveal 1400ms cubic-bezier(0.22, 1, 0.36, 1) 1200ms forwards;
}
.office-premium-overlay .guides line {
  stroke: #1f6feb; stroke-opacity: 0.5; stroke-width: 1; stroke-dasharray: 4 5;
}
.office-premium-overlay .guides .axis {
  stroke-opacity: 0.7; stroke-width: 1.2; stroke-dasharray: 8 6;
}
.office-premium-overlay .connections {
  position: absolute; inset: 0; pointer-events: none; overflow: visible; opacity: 0;
  animation: owConnectionsReveal 1200ms cubic-bezier(0.22, 1, 0.36, 1) 1500ms forwards;
}
.office-premium-overlay .connections line {
  stroke: #1f6feb; stroke-opacity: 0.7; stroke-width: 1.2;
  stroke-dasharray: 40; stroke-dashoffset: 40;
  animation: owConnectionDraw 700ms cubic-bezier(0.22, 1, 0.36, 1) var(--c-delay, 0ms) forwards;
}
.office-premium-overlay .glass-card {
  position: absolute; left: 50%; top: 50%;
  width: var(--w, 140px); height: var(--h, 90px);
  margin-left: calc(var(--w, 140px) / -2);
  margin-top: calc(var(--h, 90px) / -2);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(240, 247, 255, 0.92));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(31, 111, 235, 0.28);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 1px 2px rgba(15, 23, 42, 0.06),
    0 14px 36px -14px rgba(31, 111, 235, 0.32),
    0 24px 60px -28px rgba(15, 23, 42, 0.35);
  padding: 10px 12px; overflow: hidden; opacity: 0;
  transform: translate3d(var(--x, 0px), var(--y, 0px), 0) rotate(var(--rotation, 0deg)) scale(var(--scale, 1));
  will-change: transform, opacity;
  animation:
    owCardFloatIn 800ms cubic-bezier(0.22, 1, 0.36, 1) var(--delay, 0ms) forwards,
    owCardDrift  900ms cubic-bezier(0.22, 1, 0.36, 1) calc(var(--delay, 0ms) + 700ms) forwards,
    owSnapAlign  650ms cubic-bezier(0.34, 1.45, 0.64, 1) calc(var(--delay, 0ms) + 1500ms) forwards,
    owCardSettle 1200ms cubic-bezier(0.22, 1, 0.36, 1) calc(var(--delay, 0ms) + 2150ms) forwards;
}
.office-premium-overlay .glass-card.depth-back {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(232, 240, 252, 0.82));
  border-color: rgba(31, 111, 235, 0.2);
  box-shadow: 0 1px 0 rgba(255,255,255,0.7) inset, 0 10px 26px -16px rgba(31, 111, 235, 0.28);
}
.office-premium-overlay .glass-card.depth-front {
  background: linear-gradient(180deg, rgba(255, 255, 255, 1), rgba(232, 244, 255, 0.96));
  border-color: rgba(31, 111, 235, 0.4);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    0 1px 3px rgba(15, 23, 42, 0.08),
    0 18px 44px -14px rgba(31, 111, 235, 0.45),
    0 30px 80px -32px rgba(15, 23, 42, 0.45);
}
.office-premium-overlay .glass-card .titlebar {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;
}
.office-premium-overlay .glass-card .dot-row { display: flex; gap: 4px; }
.office-premium-overlay .glass-card .dot {
  width: 6px; height: 6px; border-radius: 50%; background: #cbd5e1;
}
.office-premium-overlay .glass-card .dot.live {
  background: #5db8ff; box-shadow: 0 0 6px rgba(93, 184, 255, 0.55);
}
.office-premium-overlay .glass-card .tag {
  height: 6px; width: 24px; border-radius: 3px;
  background: linear-gradient(90deg, #cbd5e1, #e2e8f0);
}
.office-premium-overlay .glass-card .line {
  height: 5px; border-radius: 3px;
  background: linear-gradient(90deg, #e2e8f0, #f1f5f9); margin-bottom: 5px;
}
.office-premium-overlay .glass-card .line.short { width: 55%; }
.office-premium-overlay .glass-card .line.mid   { width: 78%; }
.office-premium-overlay .glass-card .line.long  { width: 92%; }
.office-premium-overlay .glass-card .accent-line {
  height: 5px; border-radius: 3px;
  background: linear-gradient(90deg, #5db8ff, #8ecaff); margin-bottom: 5px;
}
.office-premium-overlay .glass-card .chart {
  display: flex; align-items: flex-end; gap: 3px; height: 28px; margin-top: 6px;
}
.office-premium-overlay .glass-card .chart span {
  width: 6px; background: linear-gradient(180deg, #8ecaff, #5db8ff);
  border-radius: 2px 2px 0 0; opacity: 0.85;
}
.office-premium-overlay .glass-card .chart span:nth-child(1) { height: 35%; }
.office-premium-overlay .glass-card .chart span:nth-child(2) { height: 60%; }
.office-premium-overlay .glass-card .chart span:nth-child(3) { height: 45%; }
.office-premium-overlay .glass-card .chart span:nth-child(4) { height: 80%; }
.office-premium-overlay .glass-card .chart span:nth-child(5) { height: 65%; }
.office-premium-overlay .glass-card .chart span:nth-child(6) { height: 90%; }
.office-premium-overlay .glass-card .chart span:nth-child(7) { height: 55%; }
.office-premium-overlay .glass-card .donut {
  width: 36px; height: 36px; border-radius: 50%;
  background: conic-gradient(#5db8ff 0 65%, #e2e8f0 65% 100%);
  position: relative; margin: 2px 0;
}
.office-premium-overlay .glass-card .donut::after {
  content: ''; position: absolute; inset: 8px;
  background: rgba(255, 255, 255, 0.95); border-radius: 50%;
}
.office-premium-overlay .glass-card .sparkline { margin-top: 6px; }
.office-premium-overlay .glass-card .sparkline path {
  stroke: #5db8ff; stroke-width: 1.5; fill: none;
  stroke-linecap: round; stroke-linejoin: round;
}
.office-premium-overlay .glass-card .sparkline .area {
  fill: rgba(93, 184, 255, 0.18); stroke: none;
}
.office-premium-overlay .glass-card .check {
  position: absolute; right: 8px; bottom: 8px;
  width: 16px; height: 16px; border-radius: 50%;
  background: #16a34a; display: grid; place-items: center;
  opacity: 0; transform: scale(0.6);
  animation: owCheckPop 500ms cubic-bezier(0.34, 1.45, 0.64, 1) calc(var(--delay, 0ms) + 2400ms) forwards;
}
.office-premium-overlay .glass-card .check svg { display: block; }
.office-premium-overlay .glass-card::after {
  content: ''; position: absolute; inset: -2px; border-radius: 13px;
  border: 1.5px solid rgba(31, 111, 235, 0.85);
  box-shadow: 0 0 22px rgba(31, 111, 235, 0.45);
  opacity: 0; pointer-events: none;
  animation: owSubtleGlow 900ms cubic-bezier(0.22, 1, 0.36, 1) calc(var(--delay, 0ms) + 1700ms) forwards;
}
.office-premium-overlay .dust {
  position: absolute; left: 50%; top: 50%;
  width: 4px; height: 4px; border-radius: 50%;
  background: #1f6feb; box-shadow: 0 0 6px rgba(31, 111, 235, 0.6);
  opacity: 0;
  transform: translate3d(var(--dx, 0px), var(--dy, 0px), 0) scale(var(--dscale, 1));
  animation: owDustDrift 1600ms cubic-bezier(0.22, 1, 0.36, 1) var(--dust-delay, 0ms) forwards;
}
.office-premium-overlay .pulse {
  position: absolute; left: 50%; top: 50%;
  width: 80px; height: 80px; border-radius: 50%;
  transform: translate(-50%, -50%) scale(0.5);
  border: 1.5px solid rgba(31, 111, 235, 0.85);
  box-shadow: 0 0 30px rgba(31, 111, 235, 0.35);
  opacity: 0;
  animation: owCompletionPulse 1400ms cubic-bezier(0.22, 1, 0.36, 1) 2300ms forwards;
}
.office-premium-overlay .pulse.p2 { animation-delay: 2550ms; border-color: rgba(93, 184, 255, 0.7); }

@keyframes owCardFloatIn {
  0% {
    opacity: 0;
    transform: translate3d(var(--x, 0px), calc(var(--y, 0px) + 18px), 0) rotate(var(--rotation, 0deg)) scale(calc(var(--scale, 1) * 0.96));
  }
  100% {
    opacity: var(--opacity, 0.95);
    transform: translate3d(var(--x, 0px), var(--y, 0px), 0) rotate(var(--rotation, 0deg)) scale(var(--scale, 1));
  }
}
@keyframes owCardDrift {
  0% {
    transform: translate3d(var(--x, 0px), var(--y, 0px), 0) rotate(var(--rotation, 0deg)) scale(var(--scale, 1));
  }
  100% {
    transform: translate3d(
      calc(var(--x, 0px) + (var(--tx, 0px) - var(--x, 0px)) * 0.72),
      calc(var(--y, 0px) + (var(--ty, 0px) - var(--y, 0px)) * 0.72),
      0
    ) rotate(calc(var(--rotation, 0deg) * 0.35)) scale(var(--scale, 1));
  }
}
@keyframes owSnapAlign {
  0% {
    transform: translate3d(
      calc(var(--x, 0px) + (var(--tx, 0px) - var(--x, 0px)) * 0.72),
      calc(var(--y, 0px) + (var(--ty, 0px) - var(--y, 0px)) * 0.72),
      0
    ) rotate(calc(var(--rotation, 0deg) * 0.35)) scale(var(--scale, 1));
  }
  70% {
    transform: translate3d(
      calc(var(--tx, 0px) + (var(--tx, 0px) - var(--x, 0px)) * 0.012),
      calc(var(--ty, 0px) + (var(--ty, 0px) - var(--y, 0px)) * 0.012),
      0
    ) rotate(0deg) scale(calc(var(--scale, 1) * 1.015));
  }
  100% {
    transform: translate3d(var(--tx, 0px), var(--ty, 0px), 0) rotate(0deg) scale(var(--scale, 1));
  }
}
@keyframes owCardSettle {
  0% {
    opacity: var(--opacity, 0.95);
    transform: translate3d(var(--tx, 0px), var(--ty, 0px), 0) rotate(0deg) scale(var(--scale, 1));
  }
  100% {
    opacity: 0;
    transform: translate3d(var(--tx, 0px), var(--ty, 0px), 0) rotate(0deg) scale(var(--scale, 1));
  }
}
@keyframes owSubtleGlow {
  0%   { opacity: 0; }
  30%  { opacity: 1; }
  70%  { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes owGuideReveal {
  0%   { opacity: 0; }
  30%  { opacity: 1; }
  70%  { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes owConnectionsReveal {
  0%   { opacity: 0; }
  25%  { opacity: 1; }
  80%  { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes owConnectionDraw {
  0%   { stroke-dashoffset: 40; }
  100% { stroke-dashoffset: 0; }
}
@keyframes owCompletionPulse {
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
  30%  { opacity: 0.7; }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(3.2); }
}
@keyframes owCheckPop {
  0%   { opacity: 0; transform: scale(0.4); }
  60%  { opacity: 1; transform: scale(1.15); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes owDustDrift {
  0%   { opacity: 0; transform: translate3d(var(--dx, 0px), var(--dy, 0px), 0) scale(var(--dscale, 1)); }
  20%  { opacity: 0.9; }
  100% { opacity: 0; transform: translate3d(calc(var(--dx, 0px) * 1.4), calc(var(--dy, 0px) * 1.4 - 8px), 0) scale(calc(var(--dscale, 1) * 0.6)); }
}
@keyframes owOverlayFadeOut { to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .office-premium-overlay .glass-card {
    transform: translate3d(var(--tx, 0px), var(--ty, 0px), 0) scale(var(--scale, 1));
    opacity: var(--opacity, 0.95);
    animation: owRmFade 2200ms ease-out forwards;
  }
  .office-premium-overlay .guides,
  .office-premium-overlay .connections,
  .office-premium-overlay .dust,
  .office-premium-overlay .pulse { display: none !important; }
  .office-premium-overlay .glass-card .check { animation: none; opacity: 1; transform: scale(1); }
  .office-premium-overlay { animation: owOverlayFadeOut 500ms ease 2400ms forwards; }
}
@keyframes owRmFade {
  0%   { opacity: 0; transform: translate3d(var(--tx, 0px), calc(var(--ty, 0px) + 8px), 0) scale(var(--scale, 1)); }
  20%  { opacity: var(--opacity, 0.95); transform: translate3d(var(--tx, 0px), var(--ty, 0px), 0) scale(var(--scale, 1)); }
  100% { opacity: 0; }
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

function checkSVG(): string {
  return `
<svg width="9" height="9" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M2 5.2 L4.2 7.4 L8 3.2" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

// Kártya-tartalom sablonok — apró, absztrakt UI-elemek.
const templates: Array<() => string> = [
  () => `
<div class="titlebar">
  <span class="tag"></span>
  <span class="dot-row"><span class="dot live"></span><span class="dot"></span><span class="dot"></span></span>
</div>
<div class="line long"></div>
<div class="line mid"></div>
<div class="line short"></div>`,
  () => `
<div class="titlebar">
  <span class="tag"></span>
  <span class="dot-row"><span class="dot live"></span><span class="dot"></span></span>
</div>
<div class="chart">
  <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
</div>`,
  () => `
<div style="display:flex; gap:10px; align-items:center;">
  <div class="donut"></div>
  <div style="flex:1;">
    <div class="line mid"></div>
    <div class="line short"></div>
    <div class="accent-line" style="width:60%;"></div>
  </div>
</div>`,
  () => `
<div class="titlebar">
  <span class="tag"></span>
  <span class="dot-row"><span class="dot live"></span><span class="dot"></span></span>
</div>
<svg class="sparkline" width="100%" height="38" viewBox="0 0 120 38" preserveAspectRatio="none" aria-hidden="true">
  <path class="area" d="M0,28 L15,22 L30,26 L45,14 L60,18 L75,8 L90,12 L105,6 L120,10 L120,38 L0,38 Z"/>
  <path d="M0,28 L15,22 L30,26 L45,14 L60,18 L75,8 L90,12 L105,6 L120,10"/>
</svg>`,
  () => `
<div class="titlebar">
  <span class="tag"></span>
  <span class="dot-row"><span class="dot live"></span></span>
</div>
<div style="height: 14px; width: 60%; border-radius: 4px; background: linear-gradient(90deg,#1f6feb,#5db8ff); margin: 4px 0 8px;"></div>
<div class="line short"></div>
<div class="line mid"></div>`,
  () => `
<div class="titlebar">
  <span class="tag"></span>
  <span class="dot-row"><span class="dot"></span><span class="dot"></span></span>
</div>
<div style="display:flex; gap:6px; align-items:center; margin-bottom:5px;">
  <span style="width:8px; height:8px; border-radius:2px; background:#5db8ff;"></span>
  <span class="line long" style="flex:1; margin:0;"></span>
</div>
<div style="display:flex; gap:6px; align-items:center; margin-bottom:5px;">
  <span style="width:8px; height:8px; border-radius:2px; border:1px solid #cbd5e1;"></span>
  <span class="line mid" style="flex:1; margin:0;"></span>
</div>
<div style="display:flex; gap:6px; align-items:center;">
  <span style="width:8px; height:8px; border-radius:2px; border:1px solid #cbd5e1;"></span>
  <span class="line short" style="flex:1; margin:0;"></span>
</div>`,
];

// A dashboard-rács: minden kártya közép-pontja px-ben a canvas közepéhez képest.
const layout = [
  { tx: -255, ty: -160, w: 150, h: 96 },
  { tx: -85, ty: -160, w: 150, h: 96 },
  { tx: 85, ty: -160, w: 150, h: 96 },
  { tx: 255, ty: -160, w: 150, h: 96 },
  { tx: -195, ty: 0, w: 200, h: 110 },
  { tx: 30, ty: 0, w: 150, h: 110 },
  { tx: 205, ty: 0, w: 150, h: 110 },
  { tx: -230, ty: 150, w: 170, h: 102 },
  { tx: -50, ty: 150, w: 170, h: 102 },
  { tx: 130, ty: 150, w: 170, h: 102 },
  { tx: 300, ty: 150, w: 100, h: 102 },
];

function buildOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = 'office-premium-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const stage = document.createElement('div');
  stage.className = 'stage';
  overlay.appendChild(stage);

  const canvas = document.createElement('div');
  canvas.className = 'canvas';
  stage.appendChild(canvas);

  // Igazító segédvonalak
  const guides = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  guides.setAttribute('class', 'guides');
  guides.setAttribute('viewBox', '-360 -230 720 460');
  const axisV = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  axisV.setAttribute('class', 'axis');
  axisV.setAttribute('x1', '0');
  axisV.setAttribute('y1', '-230');
  axisV.setAttribute('x2', '0');
  axisV.setAttribute('y2', '230');
  const axisH = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  axisH.setAttribute('class', 'axis');
  axisH.setAttribute('x1', '-360');
  axisH.setAttribute('y1', '0');
  axisH.setAttribute('x2', '360');
  axisH.setAttribute('y2', '0');
  guides.appendChild(axisV);
  guides.appendChild(axisH);
  [-160, 0, 150].forEach((y) => {
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ln.setAttribute('x1', '-360');
    ln.setAttribute('y1', String(y));
    ln.setAttribute('x2', '360');
    ln.setAttribute('y2', String(y));
    guides.appendChild(ln);
  });
  [-255, -85, 85, 255].forEach((x) => {
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ln.setAttribute('x1', String(x));
    ln.setAttribute('y1', '-230');
    ln.setAttribute('x2', String(x));
    ln.setAttribute('y2', '230');
    guides.appendChild(ln);
  });
  canvas.appendChild(guides);

  // Összekötő vonalak
  const conns = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  conns.setAttribute('class', 'connections');
  conns.setAttribute('viewBox', '-360 -230 720 460');
  canvas.appendChild(conns);

  // Kártyák
  layout.forEach((cfg, i) => {
    const card = document.createElement('div');
    card.className = 'glass-card';
    const depth = i % 5 === 0 ? 'back' : i % 4 === 0 ? 'front' : 'mid';
    if (depth !== 'mid') card.classList.add('depth-' + depth);

    const angle = Math.random() * Math.PI * 2;
    const r = 220 + Math.random() * 180;
    const sx = Math.cos(angle) * r;
    const sy = Math.sin(angle) * r * 0.7;
    const rotation = (Math.random() * 24 - 12).toFixed(1);
    const scale = depth === 'back' ? 0.92 : depth === 'front' ? 1.0 : 0.97;
    const opacity = depth === 'back' ? 0.88 : depth === 'front' ? 1 : 0.96;
    const delay = Math.floor(i * 60 + Math.random() * 120);

    card.style.setProperty('--w', cfg.w + 'px');
    card.style.setProperty('--h', cfg.h + 'px');
    card.style.setProperty('--x', sx.toFixed(1) + 'px');
    card.style.setProperty('--y', sy.toFixed(1) + 'px');
    card.style.setProperty('--tx', cfg.tx + 'px');
    card.style.setProperty('--ty', cfg.ty + 'px');
    card.style.setProperty('--rotation', rotation + 'deg');
    card.style.setProperty('--scale', scale.toString());
    card.style.setProperty('--opacity', opacity.toString());
    card.style.setProperty('--delay', delay + 'ms');

    const tplIndex = (i * 3 + (cfg.w > 180 ? 1 : 0)) % templates.length;
    card.innerHTML = templates[tplIndex]();

    const check = document.createElement('div');
    check.className = 'check';
    check.innerHTML = checkSVG();
    card.appendChild(check);

    canvas.appendChild(card);
  });

  // Összekötő vonalak a szomszédos kártyák között
  const edges: Array<[number, number]> = [
    [0, 1], [1, 2], [2, 3],
    [4, 5], [5, 6],
    [7, 8], [8, 9], [9, 10],
    [0, 4], [3, 6],
    [4, 7], [6, 10],
  ];
  edges.forEach(([a, b], idx) => {
    const A = layout[a];
    const B = layout[b];
    if (!A || !B) return;
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ln.setAttribute('x1', String(A.tx));
    ln.setAttribute('y1', String(A.ty));
    ln.setAttribute('x2', String(B.tx));
    ln.setAttribute('y2', String(B.ty));
    ln.style.setProperty('--c-delay', idx * 35 + 'ms');
    conns.appendChild(ln);
  });

  // Por-részecskék a snap alatt
  const DUST = 28;
  for (let i = 0; i < DUST; i++) {
    const dust = document.createElement('div');
    dust.className = 'dust';
    const a = Math.random() * Math.PI * 2;
    const r = 30 + Math.random() * 180;
    const dx = Math.cos(a) * r;
    const dy = Math.sin(a) * r * 0.7;
    dust.style.setProperty('--dx', dx.toFixed(1) + 'px');
    dust.style.setProperty('--dy', dy.toFixed(1) + 'px');
    dust.style.setProperty('--dscale', (0.5 + Math.random() * 0.8).toFixed(2));
    dust.style.setProperty('--dust-delay', 1400 + Math.random() * 600 + 'ms');
    canvas.appendChild(dust);
  }

  // Befejező pulzáló gyűrűk
  const pulse1 = document.createElement('div');
  pulse1.className = 'pulse';
  const pulse2 = document.createElement('div');
  pulse2.className = 'pulse p2';
  canvas.appendChild(pulse1);
  canvas.appendChild(pulse2);

  return overlay;
}

export function triggerOfficeWorkflow(): void {
  if (typeof document === 'undefined') return;
  ensureStyles();
  // Rapid-click védelem: ha már fut egy overlay, leszedjük az új előtt
  document.querySelector('.office-premium-overlay')?.remove();
  const overlay = buildOverlay();
  document.body.appendChild(overlay);
  window.setTimeout(() => {
    overlay.remove();
  }, 4200);
}
