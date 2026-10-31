# Contributing

intergr8 is a static site. There is nothing to install, compile or bundle — the files in `instrument/dist/` are the program.

## Run it

```bash
cd instrument/dist
npx serve .          # or any static server, e.g. python3 -m http.server 8000
```

Open the URL the server prints and press **▶**. AudioWorklet needs a secure context, so `localhost` or HTTPS only — `file://` will load the interface but never start audio.

Recommended browsers for development are Chrome or Edge: they have Web MIDI and the best DevTools audio tooling.

## Test before you commit

```bash
cd instrument
node check-bass.cjs
node check-patches.cjs
node check.cjs
```

All three must print `PASS` and exit 0. They use only Node built-ins (`node:assert/strict`, `vm`, `fs`) and were last run on Node 26; no packages are involved.

If you change DSP in `bass-core.js`, extend `check-bass.cjs` rather than testing by ear only: assert on bounds, silence, pitch or a measurable difference between two renders. If you change patch state, saving or loading, extend `check-patches.cjs`, which drives the real `app.js` and `patch-ui.js` in a `vm` sandbox with a stub DOM.

Manual checks that the harnesses cannot cover: click through all five bass modules, play with the computer keyboard and (if available) hardware MIDI, capture a phrase, export the WAV, save and reload a patch, and confirm the browser console stays clean.

## House style

- **No build step, no dependencies, no frameworks.** Plain ES2020 in classic `<script>` tags. Do not add npm packages, TypeScript, JSX or bundler config.
- **Keep `bass-core.js` browser-free.** No `document`, `window`, `AudioContext` or callbacks. That constraint is what lets Node load the same code the worklet runs.
- **Guard DOM enhancement layers.** Anything that rewrites or observes the DOM runs after every render, so early-return when it has already been applied (`closest('.rotary-control')`, `dataset` flags, `if (input.dataset.dragReady) return`).
- **Preserve accessibility.** Every control needs a label or `aria-label`; toggles get `role="switch"` and `aria-checked`; tabs get `role="tab"`/`aria-selected`. The UI-layer scripts add titles and icons — do not strip existing attributes when replacing innerHTML.
- **Never let a non-finite value reach the output.** Recursive filters, feedback and grain readers all guard with `Number.isFinite` and clamp; keep that pattern.
- **Do not re-run the legacy `*.cjs` migration scripts.** They performed one-off string replacements on `dist/index.html` and `dist/app.js` and some are not idempotent. Edit `dist/` directly. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for what each one did.
- **Match the existing formatting.** The code is dense and semicolon-heavy by design; two-space indentation, `const`/`let`, arrow functions, no trailing-comma churn.

## Adding a bass parameter

1. Add the default to `defaults()` in `dist/bass-core.js`.
2. Use it in `modulation()` (control rate, for coefficients) or `sample()` (per sample, for audible results).
3. Add a range spec entry to `rangeSpec` in `dist/bass-ui.js` — `[label, min, max, step, unit]` — and place the field in the right module (`voice`, `tone`, `fx`, `phrase`, `sample`).
4. Make sure the value survives `syncAudio()`'s patch serialisation; it serialises the whole `state.bass`, so new keys are included automatically.
5. Add an assertion to `check-bass.cjs` if the parameter changes measurable output.

## Adding a generator type

1. Add the name to `types` and `definitions` in `dist/app.js`, plus defaults and a colour/icon.
2. Handle the type in `modulation()` in `dist/bass-core.js` and in the legacy `tick()` visualiser in `dist/app.js`.
3. Add an SVG path in `dist/readability.js` if the generator column should get a new glyph.
4. Provide destinations for it in `renderRoutes()` inside `dist/bass-ui.js` (it derives targets from `definitions`).

## Debugging notes

- Worklet errors appear in the page console prefixed with the module URL; a thrown error inside `process()` silences audio permanently until reload.
- If audio starts but the meters stay flat, check that the analysers are connected to output 0 and that `ensureAudio()` completed `addModule`.
- The `status` message from the worklet is the fastest way to see whether the sequencer, gate and cutoff are advancing.
- Patches live in `localStorage` under `blackbox-patch` (working state) and `motherbox-library` (saved patches). Clear them to reset to factory defaults.

## Submitting changes

Small, focused commits are preferred. Include what changed and why, and mention which checks you ran (`node check-bass.cjs`, manual browser checks, and which browser). If you touched audio DSP, note whether you listened to the result through speakers or headphones — subjective verification is useful information, not a formality.
