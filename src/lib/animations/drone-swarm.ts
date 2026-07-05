/**
 * Drone Swarm — 11 quadcopter-drone repülés LiDAR-cone-pulzussal, terep task
 * létrehozásakor. Forrás: az ügyfél által feltöltött "Drone Swarm _standalone_.html".
 * `prefers-reduced-motion` esetén egy statikus drone-mark helyettesíti.
 */

const STYLE_ID = 'drone-swarm-style';

const STYLES = `
.drone-swarm-overlay {
  position: fixed; inset: 0; width: 100%; height: 100%;
  pointer-events: none; overflow: hidden; z-index: 9999;
  background: transparent;
  animation: dsOverlayFadeOut 600ms ease 3600ms forwards;
}
.drone-swarm-overlay .drone {
  position: absolute; top: 0; left: 0; width: 0; height: 0;
  will-change: transform, opacity; opacity: 0;
  animation: dsDroneFly var(--duration, 3200ms) linear var(--delay, 0ms) forwards;
}
.drone-swarm-overlay .drone .body-wrap {
  display: block; transform-origin: 50% 50%;
  animation: dsDroneBank var(--duration, 3200ms) linear var(--delay, 0ms) forwards;
}
.drone-swarm-overlay .drone svg.drone-svg {
  position: absolute; left: 0; top: 0;
  transform: translate(-50%, -50%); overflow: visible;
}
.drone-swarm-overlay .prop {
  transform-box: fill-box; transform-origin: 50% 50%;
  animation: dsPropellerSpin var(--propDur, 90ms) linear infinite;
}
.drone-swarm-overlay .drone .trail {
  position: absolute; left: 0; top: 0;
  transform: translate(-50%, -50%); pointer-events: none;
  animation: dsTrailFade 1600ms ease-out var(--delay, 0ms) both;
}
.drone-swarm-overlay .drone .survey {
  position: absolute; left: 0; top: 60px;
  transform: translate(-50%, 0); pointer-events: none;
}
.drone-swarm-overlay .drone .survey .ring {
  transform-origin: 50% 50%;
  animation: dsSurveyPulse 1600ms ease-out var(--surveyDelay, 0ms) infinite;
}
.drone-swarm-overlay .drone .survey .ring.r2 { animation-delay: calc(var(--surveyDelay, 0ms) + 500ms); }
.drone-swarm-overlay .drone .survey .ring.r3 { animation-delay: calc(var(--surveyDelay, 0ms) + 1000ms); }
.drone-swarm-overlay .drone .lidar {
  position: absolute; left: 0; top: 32px;
  transform: translate(-50%, 0); pointer-events: none; opacity: 0;
  animation: dsLidarFade var(--duration, 3200ms) ease-out var(--delay, 0ms) forwards;
}
.drone-swarm-overlay .drone .lidar .cone {
  transform-origin: 50% 0;
  animation: dsLidarConePulse 1200ms ease-in-out var(--delay, 0ms) infinite alternate;
}
.drone-swarm-overlay .drone .lidar .sweep {
  transform-origin: 50% 0;
  animation: dsLidarSweep 900ms cubic-bezier(0.5, 0, 0.5, 1) var(--lidarDelay, 0ms) infinite;
}
.drone-swarm-overlay .drone .lidar .pt {
  opacity: 0;
  animation: dsLidarDot 1400ms ease-out var(--ptDelay, 0ms) infinite;
  transform-box: fill-box; transform-origin: 50% 50%;
}
@keyframes dsDroneFly {
  0% { transform: translate3d(var(--start-x, -20vw), var(--start-y, 15vh), 0) scale(var(--scale, 1)); opacity: 0; }
  6%  { opacity: var(--opacity, 1); }
  25% { transform: translate3d(calc(var(--start-x, -20vw) + (var(--end-x, 120vw) - var(--start-x, -20vw)) * 0.25), calc(var(--start-y, 15vh) + var(--wave-a, -10vh)), 0) scale(var(--scale, 1)); }
  50% { transform: translate3d(calc(var(--start-x, -20vw) + (var(--end-x, 120vw) - var(--start-x, -20vw)) * 0.5), var(--mid-y, 40vh), 0) scale(var(--scale, 1)); }
  75% { transform: translate3d(calc(var(--start-x, -20vw) + (var(--end-x, 120vw) - var(--start-x, -20vw)) * 0.75), calc(var(--mid-y, 40vh) + var(--wave-b, 8vh)), 0) scale(var(--scale, 1)); }
  94% { opacity: var(--opacity, 1); }
  100% { transform: translate3d(var(--end-x, 120vw), var(--end-y, 70vh), 0) scale(var(--scale, 1)); opacity: 0; }
}
@keyframes dsDroneBank {
  0%   { transform: rotate(calc(var(--bank, 14deg) * -0.4)) translateY(-2px); }
  25%  { transform: rotate(calc(var(--bank, 14deg) * -1)) translateY(-6px); }
  50%  { transform: rotate(calc(var(--bank, 14deg) * 0.2)) translateY(2px); }
  75%  { transform: rotate(var(--bank, 14deg)) translateY(6px); }
  100% { transform: rotate(calc(var(--bank, 14deg) * 0.6)) translateY(0px); }
}
@keyframes dsPropellerSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes dsTrailFade {
  0%   { opacity: 0; transform: translate(-50%, -50%) scaleX(0.3); }
  25%  { opacity: 0.55; }
  100% { opacity: 0; transform: translate(-50%, -50%) scaleX(1); }
}
@keyframes dsSurveyPulse {
  0%   { transform: scale(0.4); opacity: 0.65; }
  80%  { opacity: 0; }
  100% { transform: scale(2.4); opacity: 0; }
}
@keyframes dsLidarFade { 0% { opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { opacity: 0; } }
@keyframes dsLidarConePulse { 0% { opacity: 0.55; transform: scaleY(0.96); } 100% { opacity: 0.85; transform: scaleY(1.04); } }
@keyframes dsLidarSweep {
  0% { transform: translateY(0) scaleX(0.4); opacity: 0; }
  25% { opacity: 1; }
  100% { transform: translateY(140px) scaleX(1); opacity: 0; }
}
@keyframes dsLidarDot {
  0% { opacity: 0; transform: scale(0.4); }
  20% { opacity: 0.95; transform: scale(1.1); }
  60% { opacity: 0.7; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.9); }
}
@keyframes dsOverlayFadeOut { to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .drone-swarm-overlay .drone { display: none !important; }
  .drone-swarm-overlay { animation: dsOverlayFadeOut 600ms ease 2200ms forwards; }
  .drone-swarm-overlay .reduced-motion-mark {
    position: absolute; left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    width: 160px; height: 160px;
    display: grid; place-items: center;
    animation: dsRmPulse 1400ms ease-out forwards;
    filter: drop-shadow(0 8px 18px rgba(31, 111, 235, 0.25));
  }
}
.drone-swarm-overlay .reduced-motion-mark { display: none; }
@media (prefers-reduced-motion: reduce) {
  .drone-swarm-overlay .reduced-motion-mark { display: grid; }
}
@keyframes dsRmPulse {
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
  30%  { opacity: 1; transform: translate(-50%, -50%) scale(1.04); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.08); }
}
@media (max-width: 600px) { .drone-swarm-overlay .drone { --scale-mult: 0.78; } }
`;

function ensureStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

function droneSVG(id: number | string, lightOn = true): string {
  return `
<svg class="drone-svg" width="160" height="120" viewBox="-80 -60 160 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="dsBody-${id}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#3a4150"/>
      <stop offset="1" stop-color="#1c212b"/>
    </linearGradient>
    <radialGradient id="dsLens-${id}" cx="0.4" cy="0.4" r="0.6">
      <stop offset="0" stop-color="#cfeaff"/>
      <stop offset="0.55" stop-color="#5db8ff"/>
      <stop offset="1" stop-color="#1f6feb"/>
    </radialGradient>
  </defs>
  <g stroke="#2a313d" stroke-width="4" stroke-linecap="round">
    <line x1="-46" y1="-32" x2="46"  y2="32"/>
    <line x1="-46" y1="32"  x2="46"  y2="-32"/>
  </g>
  <g fill="#0d1118">
    <circle cx="-46" cy="-32" r="3"/>
    <circle cx="46"  cy="-32" r="3"/>
    <circle cx="-46" cy="32"  r="3"/>
    <circle cx="46"  cy="32"  r="3"/>
  </g>
  <g fill="#5db8ff" fill-opacity="0.55">
    <ellipse class="prop" cx="-46" cy="-32" rx="22" ry="3.2"/>
    <ellipse class="prop" cx="46"  cy="-32" rx="22" ry="3.2"/>
    <ellipse class="prop" cx="-46" cy="32"  rx="22" ry="3.2"/>
    <ellipse class="prop" cx="46"  cy="32"  rx="22" ry="3.2"/>
  </g>
  <g fill="#8ecaff" fill-opacity="0.35">
    <ellipse class="prop" cx="-46" cy="-32" rx="3.2" ry="22"/>
    <ellipse class="prop" cx="46"  cy="-32" rx="3.2" ry="22"/>
    <ellipse class="prop" cx="-46" cy="32"  rx="3.2" ry="22"/>
    <ellipse class="prop" cx="46"  cy="32"  rx="3.2" ry="22"/>
  </g>
  <rect x="-26" y="-18" width="52" height="36" rx="9" fill="url(#dsBody-${id})" stroke="#0d1118" stroke-width="1.2"/>
  <rect x="-22" y="-14" width="44" height="28" rx="6" fill="none" stroke="#5db8ff" stroke-opacity="0.18" stroke-width="0.8"/>
  <rect x="-9" y="14" width="18" height="8" rx="3" fill="#0d1118"/>
  <circle cx="0" cy="18" r="3.6" fill="url(#dsLens-${id})"/>
  ${lightOn ? `
  <circle cx="-26" cy="0" r="2.2" fill="#5db8ff"/>
  <circle cx="26"  cy="0" r="2.2" fill="#ff6b6b" fill-opacity="0.85"/>
  ` : ''}
</svg>`;
}

function surveySVG(): string {
  return `
<svg class="survey-svg" width="220" height="220" viewBox="-110 -110 220 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle class="ring r1" cx="0" cy="0" r="34" fill="none" stroke="#5db8ff" stroke-opacity="0.65" stroke-width="1.6"/>
  <circle class="ring r2" cx="0" cy="0" r="34" fill="none" stroke="#5db8ff" stroke-opacity="0.5" stroke-width="1.4"/>
  <circle class="ring r3" cx="0" cy="0" r="34" fill="none" stroke="#5db8ff" stroke-opacity="0.4" stroke-width="1.2"/>
  <g stroke="#5db8ff" stroke-opacity="0.55" stroke-width="1">
    <line x1="-10" y1="0" x2="-4" y2="0"/>
    <line x1="4"   y1="0" x2="10" y2="0"/>
    <line x1="0" y1="-10" x2="0" y2="-4"/>
    <line x1="0" y1="4"   x2="0" y2="10"/>
  </g>
</svg>`;
}

function lidarSVG(id: number): string {
  const pts: string[] = [];
  const cols = 9;
  const rowYs = [128, 134, 140];
  for (let r = 0; r < rowYs.length; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -56 + c * (112 / (cols - 1)) + (r % 2 ? 6 : 0);
      const y = rowYs[r] + (Math.random() * 2 - 1);
      const d = (Math.random() * 1200).toFixed(0);
      pts.push(`<circle class="pt" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.9 + Math.random() * 0.7).toFixed(2)}" fill="#cfeaff" style="--ptDelay: ${d}ms"/>`);
    }
  }
  return `
<svg class="lidar-svg" width="180" height="160" viewBox="-90 0 180 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="dsLidarCone-${id}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#8ecaff" stop-opacity="0.55"/>
      <stop offset="0.7" stop-color="#5db8ff" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#5db8ff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="dsLidarSweep-${id}" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#8ecaff" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#cfeaff" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#8ecaff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <polygon class="cone" points="-4,0 4,0 60,130 -60,130" fill="url(#dsLidarCone-${id})"/>
  <g stroke="#8ecaff" stroke-opacity="0.45" stroke-width="0.6">
    <line x1="0" y1="0" x2="-58" y2="130"/>
    <line x1="0" y1="0" x2="-38" y2="130"/>
    <line x1="0" y1="0" x2="-18" y2="130"/>
    <line x1="0" y1="0" x2="18"  y2="130"/>
    <line x1="0" y1="0" x2="38"  y2="130"/>
    <line x1="0" y1="0" x2="58"  y2="130"/>
  </g>
  <rect class="sweep" x="-30" y="-1" width="60" height="2" fill="url(#dsLidarSweep-${id})"/>
  <line x1="-58" y1="130" x2="58" y2="130" stroke="#5db8ff" stroke-opacity="0.3" stroke-width="0.6" stroke-dasharray="2 3"/>
  <g>${pts.join('')}</g>
</svg>`;
}

function trailSVG(): string {
  return `
<svg class="trail-svg" width="200" height="20" viewBox="-100 -10 200 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="dsTrailGrad" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#5db8ff" stop-opacity="0"/>
      <stop offset="1" stop-color="#5db8ff" stop-opacity="0.55"/>
    </linearGradient>
  </defs>
  <rect x="-100" y="-2" width="200" height="4" rx="2" fill="url(#dsTrailGrad)"/>
</svg>`;
}

function buildOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = 'drone-swarm-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const rm = document.createElement('div');
  rm.className = 'reduced-motion-mark';
  rm.innerHTML = `
<svg width="160" height="160" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="dsRmGrad" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#dbeeff"/>
      <stop offset="0.7" stop-color="#8ecaff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#1f6feb" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="80" cy="80" r="70" fill="url(#dsRmGrad)"/>
  ${droneSVG('rm', true).replace('class="drone-svg"', 'class="drone-svg" style="transform: translate(0,0); position: static;"')}
</svg>`;
  overlay.appendChild(rm);

  const COUNT = 11;
  type DroneCfg = {
    id: number;
    startX: number; startY: number; endX: number; endY: number; midY: number;
    waveA: string; waveB: string; midScale: string;
    scale: number; delay: number; duration: number; bank: string;
    opacity: number; propDur: string;
    hasTrail: boolean; hasSurvey: boolean; hasLidar: boolean; isLead: boolean;
  };
  const drones: DroneCfg[] = [];
  for (let i = 0; i < COUNT; i++) {
    const isLead = i === 0;
    const yOffsetVh = isLead ? 0 : ((i % 2 === 0 ? -1 : 1) * (5 + Math.floor(i / 2) * 5));
    const startX = -28 - (isLead ? 0 : (4 + Math.random() * 16));
    const endX = 128 + (isLead ? 0 : (4 + Math.random() * 16));
    const baseY = 26 + Math.random() * 8;
    const startY = baseY + yOffsetVh;
    const endY = startY + 22 + Math.random() * 18;
    const midY = (startY + endY) / 2 - (10 + Math.random() * 14);
    const waveSign = isLead ? -1 : (Math.random() < 0.5 ? -1 : 1);
    const waveA = (waveSign * (6 + Math.random() * 10)).toFixed(1);
    const waveB = ((-waveSign) * (5 + Math.random() * 9)).toFixed(1);
    const midScale = (1.05 + Math.random() * 0.12).toFixed(2);
    const scale = isLead ? 1.0 : (0.55 + Math.random() * 0.4);
    const delay = isLead ? 0 : Math.floor(60 + Math.random() * 480);
    const duration = 2600 + Math.floor(Math.random() * 600);
    const bank = (10 + Math.random() * 8).toFixed(1);
    const opacity = isLead ? 1 : (0.8 + Math.random() * 0.2);
    const propDur = (55 + Math.floor(Math.random() * 40)) + 'ms';
    const hasTrail = isLead || (i < 5 && Math.random() < 0.75);
    const hasSurvey = (i === 3);
    drones.push({
      id: i, startX, startY, endX, endY, midY,
      waveA, waveB, midScale,
      scale, delay, duration, bank, opacity, propDur,
      hasTrail, hasSurvey, hasLidar: true, isLead,
    });
  }

  drones.forEach((d) => {
    const el = document.createElement('div');
    el.className = 'drone' + (d.isLead ? ' is-lead' : '');
    el.style.setProperty('--start-x', d.startX + 'vw');
    el.style.setProperty('--start-y', d.startY + 'vh');
    el.style.setProperty('--end-x', d.endX + 'vw');
    el.style.setProperty('--end-y', d.endY + 'vh');
    el.style.setProperty('--mid-y', d.midY + 'vh');
    el.style.setProperty('--wave-a', d.waveA + 'vh');
    el.style.setProperty('--wave-b', d.waveB + 'vh');
    el.style.setProperty('--mid-scale', d.midScale);
    el.style.setProperty('--delay', d.delay + 'ms');
    el.style.setProperty('--duration', d.duration + 'ms');
    el.style.setProperty('--scale', d.scale.toFixed(3));
    el.style.setProperty('--bank', d.bank + 'deg');
    el.style.setProperty('--opacity', d.opacity.toFixed(3));
    el.style.setProperty('--propDur', d.propDur);

    const wrap = document.createElement('span');
    wrap.className = 'body-wrap';
    wrap.style.display = 'block';

    if (d.hasTrail) {
      const trail = document.createElement('div');
      trail.className = 'trail';
      trail.style.setProperty('--delay', d.delay + 'ms');
      trail.style.left = '-90px';
      trail.style.top = '0px';
      trail.innerHTML = trailSVG();
      wrap.appendChild(trail);
    }
    if (d.hasSurvey) {
      const survey = document.createElement('div');
      survey.className = 'survey';
      survey.style.setProperty('--surveyDelay', (d.delay + 200) + 'ms');
      survey.innerHTML = surveySVG();
      wrap.appendChild(survey);
    }
    if (d.hasLidar) {
      const lidar = document.createElement('div');
      lidar.className = 'lidar';
      lidar.style.setProperty('--delay', d.delay + 'ms');
      lidar.style.setProperty('--duration', d.duration + 'ms');
      lidar.style.setProperty('--lidarDelay', Math.floor(Math.random() * 400) + 'ms');
      lidar.innerHTML = lidarSVG(d.id);
      wrap.appendChild(lidar);
    }

    wrap.insertAdjacentHTML('beforeend', droneSVG(d.id, true));
    el.appendChild(wrap);
    overlay.appendChild(el);
  });

  return overlay;
}

export function triggerDroneSwarm(): void {
  if (typeof document === 'undefined') return;
  ensureStyles();
  document.querySelector('.drone-swarm-overlay')?.remove();
  const overlay = buildOverlay();
  document.body.appendChild(overlay);
  window.setTimeout(() => {
    overlay.remove();
  }, 4200);
}
