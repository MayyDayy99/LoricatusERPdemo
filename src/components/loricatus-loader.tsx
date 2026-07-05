'use client';

/**
 * Full-screen brand loading animation. Renders the Loricatus drone-scan intro
 * (v13) as an iframe to avoid React/animation lifecycle conflicts. Loops
 * automatically while shown.
 */
export function LoricatusLoader({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-[60] bg-loricatus-dark">
      <iframe
        src="/loading-animation/index.html"
        title="Loricatus loader"
        aria-hidden
        className="w-full h-full border-0"
      />
      {message && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.2em] text-gray-400 pointer-events-none">
          {message}
        </div>
      )}
    </div>
  );
}
