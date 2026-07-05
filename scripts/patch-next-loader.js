/**
 * Patch for Next.js 15.5.12 regression.
 *
 * next-app-loader.js passes VAR_ORIGINAL_PATHNAME to loadEntrypoint() for
 * both "app-page" and "app-route" templates, but those templates no longer
 * contain the placeholder. The SWC expandNextJsTemplate native function
 * throws an invariant when it finds a key in the replacements map that has
 * no corresponding placeholder in the template.
 *
 * Fix: remove VAR_ORIGINAL_PATHNAME from both loadEntrypoint() call sites.
 */

const fs = require('fs');
const path = require('path');

const loaderPath = process.env.NEXT_LOADER_PATH ||
  path.join('/app/node_modules/next/dist/build/webpack/loaders/next-app-loader.js');

if (!fs.existsSync(loaderPath)) {
  console.error('patch-next-loader: file not found:', loaderPath);
  process.exit(1);
}

let src = fs.readFileSync(loaderPath, 'utf8');
const original = src;

// Remove ", VAR_ORIGINAL_PATHNAME: page" when it appears before a closing }
// Handles both trailing-comma and no-trailing-comma variants
src = src.replace(/,\s*VAR_ORIGINAL_PATHNAME:\s*page\s*(\n\s*\})/g, '$1');
// Remove "VAR_ORIGINAL_PATHNAME: page," when it appears as a non-last property
src = src.replace(/VAR_ORIGINAL_PATHNAME:\s*page,\s*\n/g, '');

if (src === original) {
  console.log('patch-next-loader: pattern not found — already patched or version changed, skipping');
} else {
  fs.writeFileSync(loaderPath, src, 'utf8');
  console.log('patch-next-loader: VAR_ORIGINAL_PATHNAME removed from next-app-loader.js');
}
