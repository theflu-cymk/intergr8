# Architecture

intergr8 is plain HTML, CSS and ES2020 JavaScript with no build step, no bundler and no dependencies. Everything is served as-is from `instrument/dist/`. This document explains how the pieces fit together and where to make changes.

## Module map

| File | Role | Depends on |
| --- | --- | --- |
| `dist/index.html` | Markup plus the ordered list of stylesheets and scripts | — |
| `dist/app.js` | Global `state`, generator types and math, routing matrix, macros, presets, canvas scope, the legacy preview synth | DOM, `localStorage` |
| `dist/patch-ui.js` | Patch identity (modified tracking), named library, save/load, JSON download | `app.js` globals |
| `dist/bass-core.js` | The entire bass DSP engine. No DOM, no audio callbacks, no browser APIs | nothing |
| `dist/bass-worklet.js` | `AudioWorkletProcessor` wrapper around `bass-core.js` | `bass-core.js` |
| `dist/bass-ui.js` | Audio boot, patch sync to the worklet, MIDI, computer keyboard, capture/import/export, analysis meters | everything above |
| `dist/compact-controls.js` | Turns range inputs into draggable rotary controls with numeric fields | DOM |
| `dist/readability.js` | Replaces generator glyphs with inline SVG | DOM |
| `dist/digital-dials.js` | Seven-segment SVG readouts around value fields | DOM |
| `dist/bass-terminal.js` | Icon-based vertical module selector, section headings, ARIA tabs | DOM |
| `dist/hardware-controls.js` | Switch roles/titles and control-cell sizing | DOM |
| `dist/signal-flow.js` | Draws printed PCB-style signal traces between panels | DOM |
| `dist/reference-hardware.js` | Reorders panels into the reference plate layout, recolours generators | DOM |
| `dist/console-reference.js` | Groups the workspace, macros and master output into a console | DOM |
| `dist/unified-crt.js` | Applies the unified CRT surface and moves transport onto the scope | DOM |

### Load order matters

Scripts load in this order and the later ones extend the earlier ones at runtime:

```
app.js → patch-ui.js → bass-core.js → bass-ui.js → compact-controls.js →
readability.js → digital-dials.js → signal-flow.js → reference-hardware.js →
console-reference.js → bass-terminal.js → hardware-controls.js → unified-crt.js
```

`patch-ui.js` and `bass-ui.js` deliberately **reassign** functions defined in `app.js` (`render`, `loadPreset`, `renderRoutes`, `updateVolume`) and keep the original in a `const` first. This is how the bass engine adds itself without editing `app.js`. If you add a module that needs to wrap `render` again, follow the same pattern and keep the wrapper idempotent — `render()` is called very often, including from within event handlers.

The UI-layer scripts (`compact-controls.js` onward) mutate the DOM after load and observe it with `MutationObserver`. They must remain tolerant of re-rendered markup: each one guards against double-wrapping (for example `if (input.closest('.rotary-control')) return` or a `dataset` flag).

## Audio graph

```
bass-ui.js (main thread)                      bass-worklet.js (audio thread)
┌─────────────────────────┐                  ┌──────────────────────────────┐
│ AudioContext            │  port.postMessage│ MotherBassProcessor          │
│  └ AudioWorkletNode     │ ───patch────────▶│  └ MotherBassEngine(sampleRate)│
│     'motherbox-bass'    │ ───noteOn/Off───▶│       ├ sequence()           │
│     3 outputs           │ ───sample───────▶│       ├ envelope()           │
│     0: stereo main      │ ◀──status────────│       ├ modulation() (÷16)   │
│     1: mono sub         │ ◀──capture───────│       └ sample() per output  │
│     2: stereo character │                  └──────────────────────────────┘
│  ├ analyser → destination
│  ├ analyserSub (from output 1)
│  └ splitter → left/right analysers
└─────────────────────────┘
```

The worklet declares `outputChannelCount: [2, 1, 2]`. Output 0 is what you hear; outputs 1 and 2 exist so the meters can read the sub and character layers independently without duplicating DSP.

The processor posts a `status` message every 12 render blocks (about every 32 ms at 48 kHz) containing step index, gate, envelope, cutoff, generator outputs and capture state. The UI uses it to highlight the playing step and to drive the modulation visualisation. Captured audio comes back as a transferred `Float32Array`.

### Main-thread boot

`ensureAudio()` is the single entry point. It creates the `AudioContext`, awaits `audioWorklet.addModule('bass-worklet.js')`, wires the analysers, then calls `syncAudio()`. Note the relative module URL: `index.html` and the worklet must stay in the same directory.

`syncAudio()` serialises the patch to JSON, compares it with the last sent string, and posts it only when it changed. **Sample PCM is not part of that payload** — `configure()` only receives the sample's metadata (`id`, `root`, `rate`), and the decoded `Float32Array` is posted separately as a `sample` message. This keeps the frequently-sent patch small.

## DSP engine (`bass-core.js`)

The file is an IIFE that exposes two globals: `MotherBassEngine` and `MotherBassDefaults`. It has no imports so that Node can `require()` it directly.

### Per-sample pipeline

`sample()` runs, in order:

1. `sequence()` — advances the phrase clock, applying swing, gate length, retriggers and per-step FM/cutoff locks.
2. `envelope()` — attack/decay/sustain/release for the character layer, a separate one-pole envelope for the sub, and note age.
3. `modulation()` — every 16 frames only: evaluates generators, routes, macros, filter coefficients, vowel formants and dispersion coefficient.
4. The oscillator and oversampling loop (`o < os`, so 2× or 4× internally): phase warp and FM produce the carrier, then optional granular sample blend, transient layer, character high-pass.
5. `effects()` — walks `p.fxOrder` in user order.
6. Gain match, bypass, anti-alias filters, sub oscillator, layer gains and stereo width, master gain, DC blocker, soft clip.

`this.L` / `this.R` are the only audio outputs the worklet reads; `subOut`, `charL`, `charR` feed the extra outputs. Every value is guarded with `Number.isFinite` and clamped, because a single NaN in a recursive filter would poison the AudioWorklet permanently.

### Oscillator and wavetables

Six 2048-sample tables (`sine`, `saw`, `square`, `triangle`, `metal`, `hollow`) are built at load time from 48 partials and peak-normalised. `wave(name, phase)` interpolates linearly. The carrier and modulator phases advance at internal sample rate; `fm`, `feedback`, `warp` and `morph` are applied with `m[0]`, `m[3]` macro offsets.

### Filters and processing blocks

`Filter` is a transposed-direct-form biquad with low/high/band/notch modes. Coefficient calculation happens in `modulation()` (control rate), not per sample.

The chain contains:

| Block | Implementation |
| --- | --- |
| `filter` | Main biquad, cutoff = base × 2^(env·filterEnv + mods + macro) |
| `formant` | Two band-passes morphed across five vowels, mixed by `vowelMix` |
| `comb` | 4 s feedback comb, fractional read, tempo-independent frequency in Hz |
| `dispersion` | Chain of 2–12 first-order all-passes, coefficient from `dispersionFreq` |
| `distortion` | Three-band split (low/mid/high) → selected waveshaper per band → per-band RMS dynamics → parallel mix |
| `delay` | Tempo-synced filtered feedback delay with high-passed send |

Gain match measures dry and wet RMS with very slow one-pole smoothing and a bounded ratio (0.15–3×) so toggling FX does not change perceived loudness. Bypass replaces the chain with the dry signal, still after the character high-pass.

### Sub layer

The sub is generated at the outer sample rate (not oversampled), from `subWave` (sine or triangle), shifted by `subOctave`, saturated by `subSat` and multiplied by its own envelope. `solo` routes only sub, only character, or the mix.

### Sequencing

Sixteen steps, each `{ on, note, velocity, gate, repeats, fm, cutoff }`. Step length derives from `bpm` and `division` (2 = 1/8, 4 = 1/16, 3 = 1/8 triplet, 6 = 1/16 triplet); odd steps get swing. `repeats` subdivides a step into retriggers; `fm`/`cutoff` ≥ 0 lock that step's timbre. The sequencer plays the current `root` plus the step offset through the same monophonic voice with id `'seq'`.

### Granular resampling

`setSample(samples, rate)` stores PCM and resets grain state. `sampleOsc()` runs four overlapping 80 ms grains with a 20 ms hop, travelling through the selected region at `sampleStretch` while pitching at `freq / midiHz(sample.root)`. Reverse playback reads the region backwards. `sampleBlend` mixes the result into the oscillator.

### Oversampling

`quality` (1/2/4) multiplies the internal sample rate for the oscillator and effects. Two second-order low-passes at `0.42 × sampleRate` decimate back to the outer rate. This reduces, but does not remove, aliasing.

## Modulation system

Generators live in `state.gens` and are evaluated in `modulation()`:

- **Chaotic** — Lorenz, Rössler (continuous, integrated with bounded substeps), Logistic and Hénon (iterated once per control tick).
- **Euclidean** — `steps` and `beats` from the parameters, producing a bipolar gate pattern.
- **Quadrature** — two-phase sine with drift.
- **Custom** — stepped/skewed waveform morph.
- **Sub oscillator** — additive sine cluster.

Routes are `{ from, to, target, depth, lag, bipolar, invert, curve }`. `target` is either `gen:<index>:<param>` or a bass destination name (`cutoff`, `fm`, `ratio`, `feedback`, `warp`, `vowel`, `vowelMix`, `combFreq`, `combMix`, `dispersion`, `dispersionFreq`, `drive`, `distortionMix`, `delayMix`, `pitch`, `amp`, `pan`). Generator and bass destinations are applied at different points: generator targets are added to a copy of the generator's parameters before evaluation, bass targets accumulate into `this.mods` and are read during coefficient updates and voice rendering.

The legacy `to` key is still present on factory routes for backwards compatibility with older saved patches; `target` wins when present.

## State and persistence

`state` (global, from `app.js`) holds `mode`, `preset`, `macros`, `gens`, `routes`, and — added by later modules — `bass`, `bpm`, `sync`, `volume`, `softclip`, `savedId`, `patchTitle`, `cleanSignature`, `modified`.

| `localStorage` key | Contents |
| --- | --- |
| `blackbox-patch` | The full working state, restored on load (including `cleanSignature`) |
| `motherbox-library` | Array of `{ id, name, patch }` for named user patches |

The `motherbox-*` names that survive in code — the two storage keys, the `motherbox-bass` worklet processor, the `motherbox.css`/`motherbox.svg` assets and the `.motherbox-logo` class — are legacy identifiers kept deliberately when the instrument was renamed to intergr8. Changing the storage keys or the processor name would orphan existing saved patches and break the worklet handshake, so treat them as fixed.

`patchSignature()` hashes the musically meaningful parts (generators, macros, routes, bass, tempo, sync, volume, soft clip). `updatePatchIdentity()` compares it with `cleanSignature` to drive the `MODIFIED · SAVE PATCH` readout, and is called from delegated `input` / `change` / `click` listeners so any control is tracked without per-control wiring.

Saving names the patch, writes the library, refreshes the identity and downloads `name.json`. Loading a factory preset resets the bass bank, routes and globals, then clears the modified flag. Mode changes intentionally do **not** count as edits.

Captured audio is stored inside the patch as base64 mono 22.05 kHz 16-bit PCM (`encodeSample`), trimmed to eight seconds, which is why large captures consume storage quota. WAV export writes the selected region only, applying reversal but not stretch (stretch is a playback-time effect).

## Tests

The suite is intentionally dependency-free and runs the shipped code, not a copy:

- `check-bass.cjs` requires `dist/bass-core.js` and renders short buffers through the real engine, asserting bounded output, silence when idle, pitched sub content via zero-crossing counting, timbre differences, layer isolation, release to silence, sequencer advancement and transport release, matrix-to-filter modulation, all distortion models at 1×/2×/4×, reverse/stretched sample playback, and deterministic attacks.
- `check-patches.cjs` runs `app.js` + `patch-ui.js` inside `vm` with a stubbed DOM and `localStorage`, then exercises modified tracking, mode changes, factory resets, a named save/load round trip including captured audio, and tempo tracking.
- `check.cjs` runs `app.js` alone with a stub DOM, ticks the preview engine 100,000 times checking for non-finite output, loads a preset and switches views.

Because `bass-core.js` has no browser dependencies, it is the natural place to add DSP regression tests.

## The `*.cjs` generator scripts

`redesign.cjs`, `console-update.cjs`, `global-layout-update.cjs`, `bass-engine-setup.cjs`, `compact-update.cjs`, `icon-generators.cjs`, `hardware-controls`-era scripts and friends are **historical one-off migration scripts**. Each performed an idempotent string replacement against `dist/index.html` or `dist/app.js` to inject a stylesheet, reorder panels or patch the markup while the design was iterating.

They are kept for provenance, not as a pipeline. Running them again is unnecessary and can corrupt already-migrated files — most are guarded by an `includes()` check, but `optimize.cjs` and `icon-generators.cjs` rewrite `app.js` directly. Treat `dist/` as the source of truth and edit it by hand.
