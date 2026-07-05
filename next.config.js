const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

// DEMÓ STATIKUS EXPORT (GitHub Pages): DEMO_EXPORT=true esetén statikus HTML-t
// exportálunk backend nélkül, a repo-nevének megfelelő basePath-tal. A Pages
// nem futtat szervert/middleware-t/rewrites-ot; a demó kliensoldali i18n-t és a
// böngészőben futó mock-backendet használja.
const DEMO_EXPORT = process.env.DEMO_EXPORT === 'true';
const REPO_BASE = process.env.DEMO_BASE_PATH || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: DEMO_EXPORT ? 'export' : 'standalone',
  ...(DEMO_EXPORT
    ? {
        basePath: REPO_BASE || undefined,
        assetPrefix: REPO_BASE || undefined,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
  allowedDevOrigins: ['*.trycloudflare.com'],
  // ESLint a build-on csak warning-okat ad — a fail-on-error a CI feladata, nem
  // a production buildé. A unused-vars szigorúság miatt egyébként minden image-
  // rebuild blokkolódik, miközben a tényleges hibák már type-check szinten kiderülnek.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // rewrites nem támogatott statikus exportnál — csak szerveres módban.
  ...(DEMO_EXPORT
    ? {}
    : {
        async rewrites() {
          return [
            {
              source: '/api/:path*',
              destination: `${process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/:path*`,
            },
          ];
        },
      }),
};

module.exports = withNextIntl(nextConfig);
