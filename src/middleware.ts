import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export const config = {
  // Match all paths except Next.js internals, static files, API proxy,
  // and PUBLIC token-based routes (portal, public/*) which are accessed by
  // external recipients with no locale-awareness — adding /hu, /en stb.
  // prefix-et ezekre 404-be vinné őket, mert a oldalak az app gyökerén
  // élnek (apps/web/src/app/public/..., /portal/...), nem [locale]/public/...
  // Az /auth/sso-callback szintén kizárva: az OAuth provider által hívott
  // fix callback URL (locale-prefix-szel nem egyeztethető), és kliens-oldali
  // app routerben (apps/web/src/app/auth/sso-callback/) él, nem [locale] alatt.
  matcher: ['/((?!api|_next|_vercel|public|portal|auth/sso-callback|favicon.ico|.*\\..*).*)'],
};
