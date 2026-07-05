'use client';

// Sprint 4 β₂: a publikus (auth nélküli) route-group layoutja.
// Tudatosan minimális: NINCS sidebar, NINCS dashboard-chrome,
// NINCS Layer-2 auth-gate. Mindössze a Loricatus márkajelzés és
// a nyelvválasztó kerül a tetejére, alatta a teljes szélességű
// content. Az erőforrásokhoz tartozó endpoint-okat (pl. shares/access)
// a backend `@Public()` dekorátorral teszi auth-mentessé.

import Link from 'next/link';
import { LangPicker } from '@/components/ui/lang-picker';
import { useT } from '@/lib/hooks/use-t';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const t = useT();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-loricatus-dark/95 flex flex-col">
      {/* Minimal márkás fejléc — csak logó + locale-switcher. */}
      <header className="bg-white dark:bg-loricatus-dark border-b border-gray-100 dark:border-loricatus-dark/40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-2"
            aria-label="Loricatus"
          >
            <span className="font-extrabold text-base tracking-wide text-loricatus-dark dark:text-loricatus-accent">
              Loricatus
            </span>
          </Link>
          <LangPicker variant="icon" />
        </div>
      </header>

      {/* Full-width content — nincs sidebar-elcsúsztatás. */}
      <main className="flex-1 w-full">
        {children}
      </main>

      {/* Powered-by lábléc — egysoros, halvány. */}
      <footer className="border-t border-gray-100 dark:border-loricatus-dark/40 bg-white/50 dark:bg-loricatus-dark/40">
        <div className="max-w-5xl mx-auto px-4 py-3 text-center text-xs text-gray-400">
          {t.publicShare.poweredBy}
        </div>
      </footer>
    </div>
  );
}
