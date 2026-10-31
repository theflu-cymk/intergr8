# Control reference

Every control in intergr8, what it does, and how to get at it. Labels here match the interface.

## Getting sound

Click **▶** (bottom-left of the waveform panel, or the transport button) or press `Space`. Browsers only allow the audio worklet on `localhost` or HTTPS, so serve `dist/` over HTTP rather than opening the file directly.

The status text tells you where the engine is: `AUDIO IDLE` → `AUDIOWORKLET · 48 kHz` after audio starts, `AUDIO UNAVAILABLE` if the worklet could not load.

## Modes

| Mode | Shows |
| --- | --- |
| **Automated** | Macros and presets only — the smallest surface |
| **Simple** | Generator parameters plus the bass engine |
| **Advanced** | Adds the modulation routing matrix and the reorderable FX chain |

Switching modes never changes the sound and never marks the patch as modified.

## Generators

The generator column lists up to eight generators. Each row shows its type, output count and mute lamp; click the row to select it, click the lamp to mute it.

| Type | Outputs | Parameters |
| --- | --- | --- |
| Chaotic | 3 | Rate, Sigma, Rho, Beta — with a Lorenz / Rössler / Logistic / Hénon algorithm selector |
| Euclidean | 2 | Rate, Steps, Beats, Shift |
| Quadrature | 4 | Rate, Phase spread, Ratio, Drift |
| Custom | 2 | Rate, Steps, Skew, Smooth |
| Sub oscillator | 2 | Frequency, Harmonics, Sub weight, Saturation |

- **＋ Add generator** appends one cycling through the five types (eight is the limit).
- **↺** in the controls header resets the selected generator's parameters.
- **PHASE BUS · LOCKED** is a decorative bus indicator; generator clocking is always shared.

### Scope panel

- **Orbit** tab draws the selected generator: a Lorenz phase portrait, the Euclidean wheel, or stacked LFO traces.
- **Waveform** tab forces the time-domain view for any generator.
- **Ⅱ** freezes the visualisation without stopping audio.
- The readout below the plot shows live X / Y / Z outputs and the rate.

## Bass engine

Five modules down the left rail. Within **Voice**, **Tone** and **Processing**, the tabs above the controls (`Oscillators`, `Envelope`, …) switch control groups.

### Voice

**Oscillators**

| Control | Effect |
| --- | --- |
| Carrier wavetable | Sine, saw, square, triangle, metal, hollow |
| FM modulator | Wavetable used to modulate the carrier phase |
| Hollow morph | Crossfade from the carrier table to `hollow` |
| Phase warp | Sine-shaped phase distortion before the table lookup |
| FM ratio | Modulator frequency as a multiple of the note |
| Modulator offset | Fine detune of the modulator in Hz |
| FM amount | Modulation index |
| FM feedback | Modulator self-feedback |

**Envelope**

| Control | Effect |
| --- | --- |
| Glide | Portamento time between notes |
| Legato envelopes | Hold the envelope when a new note arrives while a key is down |
| Reset phase on attack | Restarts oscillator phase for deterministic transients |
| Pitch-bend range | ±2, ±12 or ±24 semitones |
| Attack / Decay / Sustain / Release | Character-layer ADSR |

**Sub & attack**

| Control | Effect |
| --- | --- |
| Sub waveform | Sine or triangle |
| Sub octave | Fundamental, −1 or −2 octaves |
| Sub attack / Sub release | Independent one-pole envelope for the sub |
| Sub saturation | Drive into the sub's soft clip |
| Attack layer / Attack length | Amount and decay of the noise-plus-tone transient |
| Pitch attack / Pitch decay | Pitch envelope depth in semitones and its time |

### Tone

| Control | Effect |
| --- | --- |
| Main filter | Low pass, band pass, high pass, notch |
| Filter cutoff / Resonance | Base cutoff (Hz) and Q |
| Filter envelope | How far the envelope opens the filter, in octaves |
| Vowel position / Vowel mix | Morph across A→E→I→O→U formants and blend them in |
| Comb mix / Comb frequency / Comb feedback | Resonant comb tuned in Hz |
| Dispersion mix / frequency / focus | All-pass chain; focus sets the stage count |

### Processing

| Control | Effect |
| --- | --- |
| Distortion model | Saturation, hard clip, asymmetric, wavefold, phase distortion |
| Low / Mid / High-band drive | Independent drive per split band |
| Parallel distortion | Dry/distorted mix |
| Multiband dynamics | Per-band RMS levelling amount |
| Character low cut | Where the character layer splits from the sub |
| High crossover | Low/mid and mid/high split point |
| Pre-drive high pass / Post-drive low pass | Band-limiting around the distortion stage |
| Delay time | 1/16, 1/8, dotted 1/8, 1/4, dotted 1/4 (tempo-synced) |
| Dub delay mix / feedback / low pass | Delay level, regeneration and tone |
| Character width | Stereo spread of the character layer |
| Nonlinear oversampling | 1× low CPU, 2×, 4× high CPU |

In **Advanced** mode the processing order arrow buttons appear, letting you move `filter`, `formant`, `comb`, `dispersion`, `distortion` and `delay` up or down the chain.

### Phrase

- **Phrase enabled** arms the sequencer; the transport starts it.
- **Grid** sets 1/8, 1/16, 1/8 triplet or 1/16 triplet; **Swing** offsets alternate steps.
- **Shift →** rotates the pattern one step, **Variation** randomises which steps fire, **Clear** empties them.
- Click a step to select it; the checkbox above the number enables it. The playing step is highlighted.
- Step detail: **Note offset**, **Velocity**, **Gate**, **Retriggers** (1–8), **FM lock** and **Cutoff lock** (−1 disables a lock).

The phrase plays relative to **ROOT** in the global rack.

### Resample

1. Set **Length** (1 or 2 bars) and choose whether to **Include sub**.
2. Press **Capture phrase** — the transport starts automatically if it was stopped and stops when the capture ends.
3. Adjust **Region start / Region end**, enable **Reverse region**, and set **Time stretch** (grain travel, independent of note pitch).
4. Raise **Resample blend** to mix the capture into the oscillator.

**Export WAV** writes the selected region as 16-bit mono. **Import audio** accepts any file the browser can decode, trims it to eight seconds, and treats it as a capture. The capture persists inside the saved patch.

## Global rack

| Control | Effect |
| --- | --- |
| **ROOT** | Note the phrase and default voice play |
| **SUB / CHARACTER** | Layer levels, also used by the macros' weighting |
| **SOLO** | Mix, sub only, or character only — useful for checking phase |
| **FX bypass** | Bypasses filter/formant/comb/dispersion/distortion/delay |
| **Gain match** | Keeps bypass and active levels comparable |
| **Connect MIDI** | Requests Web MIDI access and reports inputs |
| **Panic** | Releases every note and flushes delay/comb/state |
| **Lock sub / Lock rhythm** | Excluded from **⤨ Mutate** |

Under the piano strip: **Keyboard** expands the playable keys, and `A–K · Z/X octave` documents the shortcut.

## Macros and master output

Six macros — **Chaos**, **Density**, **Drift**, **Harmonics**, **Sub weight**, **Intensity** — are weighted sums into the engine (FM amount, filter envelope, vowel position, morph, sub level, drive). They are stored in patches and are the only controls visible in Automated mode.

**MASTER OUT** has **LEVEL** (with a dB readout), the output meter, and **Soft clip**, which applies a `tanh` stage instead of a hard limit.

## Preset display

| Control | Effect |
| --- | --- |
| Patch name | Current patch; an asterisk and `MODIFIED · SAVE PATCH` mean unsaved edits |
| **GLOBAL CLOCK / BPM** | 30–240 BPM |
| **SYNC** | Tempo-sync the sequencer and delay; press again for **FREE** |
| **▶** | Transport |
| **SAVE PATCH** | Names the patch, stores it locally, downloads a JSON backup |
| **?** | Controls help dialog |
| **← / →** | Previous / next factory patch |
| **⤨ Mutate** | Constrained randomisation that respects the two locks |

Factory banks: **Sub pressure** (Deep UK), **Half-time wobble** (Wobble), **Vowel growl** (Brostep), **Metal barrage** (Tearout). **PATCH MEMORY** lists your saved patches beneath them; clicking one loads it.

## Keyboard and MIDI

| Input | Action |
| --- | --- |
| `A W S E D F T G Y H U J K` | Chromatic run from the current octave |
| `Z` / `X` | Octave down / up (C0–C5 range) |
| `Space` | Transport on/off |
| Mouse/touch on the piano strip | Press and hold to play |
| MIDI note on/off | Plays the voice, with velocity |
| MIDI pitch bend | Uses the bend range set in Voice → Envelope |
| MIDI CC 120 / 123 | All notes off (same as Panic) |

Typing is ignored while a text field or a dialog has focus, so patch names and BPM are safe to edit.

## Rotary controls

Most controls are knobs with an attached numeric field and seven-segment readout.

- Drag up or right to increase, down or left to decrease.
- Hold `Shift` while dragging for fine adjustment.
- Click the numeric field, type a value, then `Enter` (or click away) to commit. `Escape` cancels.
- Arrow keys nudge the focused knob by one step.

## Saving and backups

Patches live in browser `localStorage`, so they are per-browser and per-origin. Saving a patch also downloads `intergr8-patch.json`; that file is a complete backup including bass settings and any captured audio. WAV exports are named `intergr8-capture.wav`. Loading a factory preset discards unsaved edits without warning — save first if the sound matters.
