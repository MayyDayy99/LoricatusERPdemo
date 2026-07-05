'use client';

/**
 * A pulsing beacon dot that draws attention to a UI element.
 * Renders a brand-colored glow using the Tailwind `animate-pulse-beacon` keyframe.
 *
 * Usage:
 *   <div className="relative">
 *     <PulseBeacon visible={!seen} />
 *     <Button>…</Button>
 *   </div>
 */
export function PulseBeacon({ visible = true }: { visible?: boolean }) {
  if (!visible) return null;
  return (
    <span className="absolute -top-1 -right-1 flex h-3 w-3 pointer-events-none">
      <span className="absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75 animate-pulse-beacon" />
      <span className="relative inline-flex h-3 w-3 rounded-full bg-brand-500" />
    </span>
  );
}
