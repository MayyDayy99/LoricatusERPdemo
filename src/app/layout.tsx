import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { DemoBanner } from '@/components/demo/demo-banner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Loricatus',
  description: 'Loricatus Construction Platform',
};

const themeScript = `
try {
  var s = localStorage.getItem('dimop-theme');
  if (s && JSON.parse(s)?.state?.theme === 'dark') {
    document.documentElement.classList.add('dark');
  }
} catch(e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const version = process.env.APP_VERSION;
  return (
    <html lang="en">
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.className}>
        {children}
        <DemoBanner />
        <Toaster richColors position="top-right" />
        {version ? (
          <div
            aria-hidden
            className="pointer-events-none fixed bottom-1 right-2 z-[9999] select-none font-mono text-[10px] leading-none text-neutral-400/60 dark:text-neutral-500/50"
          >
            {version}
          </div>
        ) : null}
      </body>
    </html>
  );
}
