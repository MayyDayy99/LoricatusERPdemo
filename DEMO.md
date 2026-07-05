# Loricatus ERP — bemutató (mock) demó

Ez a Loricatus ERP frontend **portfólió-demója**: a teljes felület bejárható,
kattintgatható, de **nincs mögötte valódi backend** — minden adat a böngészőben,
memóriában él (mock). Az adatok nem mentődnek: az oldal újratöltésekor a
seed-adat visszaáll. Az élő rendszerhez semmi köze.

## Hogyan működik

- `NEXT_PUBLIC_DEMO_MODE=true` esetén az axios API-kliens egy böngészőben futó
  **mock-routerre** kapcsol (`src/lib/demo/`), valósághű magyar építőipari
  seed-adattal (ügyfelek, projektek, ajánlatok, számlák, szerződések,
  munkalapok, feladatok, jutalék, meeting stb.).
- A bejelentkezés automatikus (admin nézet). A login oldalon „Démó belépés" gomb.
- Alul figyelmeztető sáv jelzi, hogy ez demó.

## Helyi futtatás

```bash
yarn install
NEXT_PUBLIC_DEMO_MODE=true yarn dev
# http://localhost:3000
```

## Kihelyezés GitHub Pages-re (automatikus, push után)

A repó tartalmaz egy GitHub Actions workflow-t (`.github/workflows/deploy-pages.yml`),
ami **minden `main`-re pusholt commit után** statikus exportot készít és Pages-re
deployol. Az eredmény a GitHub-subdomainen látszik:

```
https://<felhasznalonev>.github.io/<repo-nev>/
```

### Egyszeri beállítás a repóban

1. **Settings → Pages → Build and deployment → Source: „GitHub Actions"**.
2. Push a `main` ágra → az Actions lefut → a „Deploy demo to GitHub Pages"
   job végén a link megjelenik (a job „deploy" lépésének `url`-je), és a fenti
   címen élő lesz.

A `basePath` automatikusan a repó nevéből jön (`/<repo-nev>`), így az assetek
helyesen töltenek az al-útvonalon. Nincs teendő vele.

## Statikus export lokálisan (opcionális, teszthez)

```bash
bash scripts/prepare-demo-export.sh        # szerver-only fák eltávolítása
DEMO_EXPORT=true NEXT_PUBLIC_DEMO_MODE=true DEMO_BASE_PATH=/<repo-nev> yarn build
# a kész statikus oldal: ./out
```

> A `prepare-demo-export.sh` a Pages-hez nem használható szerver-only részeket
> (middleware, `[locale]` i18n-fa, publikus token-oldalak) távolítja el. A CI ezt
> minden futásnál friss checkouton végzi — a forrást tartósan nem módosítja.
