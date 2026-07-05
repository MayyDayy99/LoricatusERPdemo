#!/usr/bin/env bash
# Statikus export előkészítése (GitHub Pages).
#
# A GitHub Pages nem futtat szervert/middleware-t, ezért a Next `output: export`
# nem tűri a middleware-t és a szerver-oldali next-intl route-okat. A demó
# kliensoldali i18n-t (lang-store) és böngészőben futó mock-backendet használ,
# így ezek a fák nyugodtan eltávolíthatók az export-buildhez.
#
# Ezt a scriptet a CI (GitHub Actions) futtatja a build ELŐTT. A repót nem
# módosítja tartósan — a CI checkout minden futásnál friss.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[prepare-demo-export] szerver-only fák eltávolítása a statikus exporthoz…"
rm -f  src/middleware.ts
rm -rf "src/app/[locale]"
rm -rf "src/app/(public)"
rm -rf  src/app/portal
rm -rf  src/app/public
echo "[prepare-demo-export] kész."
