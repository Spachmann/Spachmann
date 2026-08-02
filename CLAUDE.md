# CLAUDE.md

Guidance for Claude Code and other AI assistants working in this repository.

## What this project is

A single-page web app for German landlords to produce legally compliant
operating-cost statements (`Betriebskostenabrechnung` / `Nebenkostenabrechnung`)
for residential tenants. It is **not** a generic accounting tool: nearly every
rule in `src/domain/` traces back to a specific provision of BGB, BetrKV,
HeizkostenV, TKG or EStG, and those citations are part of the product — they are
printed in the statement itself and shown in the audit report.

There is no backend. All data lives in the browser's `localStorage`; export and
import go through JSON files.

## Commands

```bash
npm install
npm run dev         # Vite dev server
npm test            # vitest run — the domain test suite (81 tests, 4 files)
npm run test:watch  # vitest in watch mode
npm run typecheck   # tsc --noEmit
npm run build       # tsc --noEmit && vite build → dist/
npm run preview     # serve the production build
```

**Before committing, run `npm test` and `npm run typecheck`.** Both must pass;
`npm run build` runs the typecheck too, so a broken type breaks the build.

## Stack

React 19 · TypeScript 7 (strict) · Vite 8 · Vitest 4. **No runtime dependencies
beyond `react` and `react-dom`** — no state library, no router, no UI kit, no
date or money library. Keep it that way unless there is a strong reason; the
hand-rolled helpers in `src/domain/util.ts` exist precisely to avoid pulling in
`date-fns`/`dinero.js`-style packages.

## Layout

```
index.html              Vite entry, German <html lang="de">
src/
  main.tsx              createRoot → StrictMode → StoreProvider → App
  App.tsx               7-step tab shell, export/import/demo/reset actions
  styles.css            all styling, plain CSS, incl. the @media print rules
  domain/               pure business logic — no React, no DOM, fully tested
    types.ts            data model + Verteilerschluessel/Zaehlerart unions
    katalog.ts          the § 2 BetrKV cost catalogue + non-apportionable costs
    util.ts             dates, money parsing/formatting, cent distribution
    heizkosten.ts       HeizkostenV: hot-water share, base/consumption split
    berechnung.ts       allocation bases, distribution, per-tenancy statement
    pruefung.ts         formal and substantive audit → Pruefbericht
  state/
    store.tsx           React context store, localStorage persistence, migration
    leer.ts             empty initial state
    demo.ts             fully populated example object ("Beispiel laden")
  components/
    ui.tsx              shared primitives (Karte, Feld, EuroEingabe, Knopf, …)
    StammdatenForm.tsx  step 1 — landlord, property, units
    ZeitraumForm.tsx    step 2 — billing periods
    MietverhaeltnisseForm.tsx  step 3 — tenancies, occupancy, prepayments
    KostenForm.tsx      step 4 — cost items
    HeizkostenForm.tsx  step 5 — HeizkostenV settings and meter readings
    PruefungAnsicht.tsx step 6 — audit report
    AbrechnungAnsicht.tsx  step 7 — printable statement per tenancy
```

The dependency direction is strictly one-way: `components → state → domain`.
Domain modules import only from other domain modules. Never import React or
touch `localStorage`/`window` from `src/domain/`.

## Language convention

**Everything is German**: identifiers, type names, comments, JSDoc, UI strings,
commit messages, README. `Mietverhaeltnis`, `verteileCent`, `nutzungen`,
`schweregrad` — not `tenancy`, `distributeCents`, `severity`. Umlauts are
transliterated in identifiers (`Mietverhaeltnis`, `Pruefbericht`,
`wohnflaecheQm`) but written out in user-facing strings ("Mietverhältnis").

New code must follow this. Do not "helpfully" rename things to English.

## Data model rules

These are load-bearing; violating them silently corrupts statements.

- **All money is integer cents** (`type Cent = number`). Never store or compute
  euros as floats. Parse user input with `parseEuroZuCent`, render with
  `formatEuro`, round with `anteilVonBetrag`.
- **All dates are `YYYY-MM-DD` strings** (`type ISODate = string`), compared
  lexicographically (`von <= bis`) and parsed as **UTC midnight** via
  `parseDatum` to avoid timezone drift. Never use `new Date(string)` directly.
- **Day counts are inclusive** on both ends (`tageInZeitraum('2023-01-01',
  '2023-01-01') === 1`).
- IDs are `uuid()` strings from `src/domain/util.ts` (`crypto.randomUUID` with a
  fallback).
- `AppState` is a flat, normalised, JSON-serialisable object. It is written to
  `localStorage` verbatim, so it must stay free of class instances, `Date`
  objects, `Map`/`Set`, and `undefined`-only-meaningful fields.

## Legal invariants — do not break these

The audit (`pruefung.ts`) and the calculation (`berechnung.ts`) encode statutory
limits. If a change makes one of these no longer hold, the app produces
statements that are legally attackable.

- **Loss-free cent distribution.** `verteileCent` uses the largest-remainder
  method so the sum of all shares equals the total exactly. `pruefung.ts` asserts
  this at runtime ("Verteilung stimmt nicht mit den Gesamtkosten überein") and
  `berechnung.test.ts` tests it. Any new distribution path must go through
  `verteileCent` / `verteileNachBasis`.
- **Vacancy stays with the landlord.** Allocation bases are built over *all*
  units for the *whole* period; the unoccupied weight becomes
  `leerstandGewicht` and its cost share is reported as
  `leerstandsanteilVermieter` instead of being spread over the remaining
  tenants. Never normalise it away.
- **Time-weighted apportionment.** For time-based keys the weight is
  `Maßstab × Nutzungstage`, so mid-year tenant changes split correctly.
  Consumption-based keys (`VERBRAUCH`, `HEIZKOSTENV`) are *not* time-weighted
  (`zeitgewichtet: false`) — the meter reading already carries the period.
- **HeizkostenV consumption share must stay 50–70 %** (§ 7 Abs. 1, § 8 Abs. 1);
  the `Verbrauchsanteil` type is `50 | 60 | 70` and the audit re-checks the
  range.
- **15 % reduction** (`KUERZUNGSSATZ_HEIZKOSTENV`) applies whenever heating was
  not billed by consumption (§ 12 Abs. 1 HeizkostenV).
- **§ 2 BetrKV is an exhaustive catalogue.** Anything not in it is only
  apportionable as `BETRKV_2_17` ("sonstige Betriebskosten") *and* only when the
  tenancy has `sonstigeBetriebskostenVereinbart`. Verwaltungs- and
  Instandhaltungskosten (§ 1 Abs. 2 BetrKV) are never apportionable.
- **Deadline logic**: billing period ≤ 12 months (§ 556 Abs. 3 S. 1), statement
  due within 12 months of period end (§ 556 Abs. 3 S. 2), tenant objection
  period 12 months from receipt (§ 556 Abs. 3 S. 5, 6).
- **Cut-off dates and caps** live on the catalogue entry, not in the audit code:
  `umlagefaehigBis` (cable TV, `2024-06-30`, § 230 Abs. 5 TKG) and
  `hoechstbetragProWohnungUndJahr` (fibre provision fee, `6000` cents/unit/year,
  § 72 Abs. 1 TKG).

When you add or change a rule, cite the provision in a comment and in the
`fundstelle` / `rechtsgrundlage` field the way the surrounding code does.

## How the calculation flows

`berechneAbrechnung(state, zeitraum)` in `src/domain/berechnung.ts` is the single
entry point:

1. `ermittleNutzungszeitraeume` → every tenancy overlapping the period, with day
   counts and person-days.
2. Cost items are split into three buckets: `HEIZKOSTENV` items, other
   apportionable items, and non-apportionable items.
3. For each apportionable item: `baueUmlagebasis` builds the `Umlagebasis` for
   its `Verteilerschluessel`, then `verteileNachBasis` splits
   `umlagefaehigerBetragDerPosition` (gross minus `nichtUmlagefaehigerAnteil`).
4. Heating: `teileHeizkostenAuf` (hot-water share via
   `ermittleWarmwasserAnteil`, then base/consumption split) produces up to four
   `HeizkostenBlock`s — heating base/consumption and hot water base/consumption
   — or one flat area-based block plus a 15 % reduction if consumption billing
   did not happen.
5. Per tenancy, every share becomes an `Abrechnungszeile` carrying the key, its
   explanation, the tenant's and total scale values, day counts and the amount —
   this is what makes the statement auditable (BGH: total costs, key +
   explanation, tenant's share, prepayments deducted).
6. Prepayments: `vorauszahlungenTatsaechlich[zeitraumId]` if recorded, otherwise
   monthly rate × `angefangeneMonate`. `saldo > 0` = tenant owes money.

`pruefeAbrechnung(state, zeitraum, ergebnis)` then runs ~30 checks over the same
inputs plus the result, returning `Befund[]` graded `FEHLER | WARNUNG | HINWEIS`.
`erteilbar` is true only when there are no `FEHLER`.

## State handling

`src/state/store.tsx` is a plain React context, not a reducer:

```ts
const { state, update, ersetze, zuruecksetzen } = useStore();
update((s) => ({ ...s, kostenpositionen: [...s.kostenpositionen, neu] }));
```

- `update` takes a pure `AppState → AppState` function. **Always return a new
  object; never mutate `state`.**
- Persistence is a `useEffect` that writes the whole state to
  `localStorage['nebenkostenabrechnung.state.v1']` on every change.
- `migriere()` fills in missing fields on load and on import, so old saved states
  keep working. **If you add a field to `AppState`, add its default to both
  `leer.ts` and `migriere()`**, and bump `AKTUELLE_VERSION` (and the storage key
  suffix) only for genuinely breaking shape changes.
- `exportiereJson` / `importiereJson` round-trip the same shape; import always
  goes through `migriere`.

## UI conventions

- Components are function components with inline prop types; no `React.FC`, no
  `propTypes`, no default exports except `App`.
- Reuse the primitives in `components/ui.tsx` (`Karte`, `Raster`, `Feld`,
  `Hinweisbox`, `LeerZustand`, `TextEingabe`, `DatumEingabe`, `EuroEingabe`,
  `ZahlEingabe`, `Auswahl`, `Schalter`, `Knopf`) rather than raw `<input>`s —
  `EuroEingabe`/`ZahlEingabe` hold text state internally so intermediate input
  like `"12,"` survives keystrokes.
- Styling is **plain CSS in `src/styles.css`** with German class names
  (`.karte`, `.reiter-knopf`, `.hinweisbox-warnung`). No CSS modules, no
  Tailwind, no inline styles beyond one-off grid templates.
- The statement is printed via the browser's print dialog. `styles.css` ends
  with a `/* --- Druck --- */` section that hides the chrome and paginates
  `AbrechnungAnsicht`. **Any change to the statement layout must be checked
  against the print stylesheet.**
- Formatting is German locale throughout: `formatEuro`, `formatZahl`,
  `formatDatum` (`TT.MM.JJJJ`). Do not call `toLocaleString` ad hoc.

## Testing

- Vitest, `globals: true`, `environment: 'node'`, and the include pattern is
  **`src/**/*.test.ts`** — note the `.ts`: a `.test.tsx` file would silently not
  run. There is no DOM/component test setup; if you add one you must add jsdom
  and widen the include in `vite.config.ts`.
- Tests sit next to the code they cover: `berechnung.test.ts`,
  `pruefung.test.ts`, `util.test.ts`, `demo.test.ts`.
- The suites build `AppState` fixtures inline with small helpers (`einheit(…)`,
  `mietverhaeltnis(…)`) — follow that pattern instead of adding fixture files.
- `pruefung.test.ts` groups tests by statute (`describe('§ 556 Abs. 3 BGB – …')`);
  a new audit rule belongs in the matching block, or a new one named after its
  provision.
- `demo.test.ts` asserts that the shipped example data is internally consistent
  and audit-clean, so **changing `demo.ts` can break tests** — that is
  intentional, the demo doubles as an integration fixture.
- Cover new domain logic with a test that checks the *legal* outcome (the exact
  cent amounts, the reduction, the emitted `Befund`), not just that it runs.

## Recipes

**Add a cost type** → append a `Kostenart` to `BETRIEBSKOSTEN` (or
`NICHT_UMLAGEFAEHIGE_KOSTEN`) in `katalog.ts` with `id`, `fundstelle`,
`standardSchluessel`, `erlaubteSchluessel`, and any of `verbrauchsart`,
`umlagefaehigBis`, `benoetigtVereinbarung`, `arbeitskostenRelevant`,
`hoechstbetragProWohnungUndJahr`. IDs follow `BETRKV_2_<nr>` / `NU_<thema>`.
No UI change is needed — the forms read the catalogue.

**Add a distribution key** → extend the `Verteilerschluessel` union and
`VERTEILERSCHLUESSEL_BEZEICHNUNG` in `types.ts`, add a `case` to the switch in
`baueUmlagebasis`, add a case to `erlaeuterung()` (both switches are exhaustive,
so TypeScript will point you at every site), then list it in the relevant
catalogue entries' `erlaubteSchluessel`.

**Add an audit rule** → push a `FEHLER`/`WARNUNG`/`HINWEIS` in the matching
section of `pruefeAbrechnung`, always with `rechtsgrundlage` and `bereich` (the
`bereich` string must match a tab name so users can navigate to the cause).

## Gotchas

- `exactOptionalPropertyTypes` is off, but `strict`, `noUnusedLocals`,
  `noUnusedParameters` and `noFallthroughCasesInSwitch` are on — unused imports
  fail the build, not just the linter. There is no ESLint/Prettier config;
  match the surrounding formatting (2 spaces, single quotes, trailing commas,
  ~100 col, `// ---` section banners).
- `vite.config.ts` sets `base: './'` so the build works from a file path or a
  sub-directory. Don't switch to absolute asset paths.
- `verbrauchWert` falls back to `standEnde - standAnfang` only when `verbrauch`
  is not set; a missing reading yields `undefined` and produces a
  `maengel` entry that surfaces as a `FEHLER`, rather than a silent zero.
- `angefangeneMonate` counts *started* months (calendar-month difference + 1),
  which is what prepayment schedules use — it is not a day-proportional figure.
- `arbeitskostenAnteil` (§ 35a EStG) is apportioned pro rata to each tenant's
  share of the item, rounded per tenant; small rounding drift against the total
  is expected and acceptable there.
- This app gives no legal advice and the README says so. Keep the disclaimers in
  `App.tsx`'s footer and in `AbrechnungAnsicht` intact.
