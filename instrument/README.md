# MotherBox — instrument

The application lives in [dist/](dist/). Serve that directory over HTTP on localhost and open it in a modern browser:

```bash
cd dist
npx serve .        # or: python3 -m http.server 8000
```

AudioWorklet requires `localhost` or HTTPS, so opening `index.html` from disk will not produce sound. Press **▶** or `Space` to start, and play with `A W S E D F T G Y H U J K`.

Tests (Node, no dependencies):

```bash
node check-bass.cjs
node check-patches.cjs
node check.cjs
```

Full documentation lives in the repository root:

- [README.md](../README.md) — overview, features, quick start
- [docs/CONTROLS.md](../docs/CONTROLS.md) — every control and shortcut
- [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) — module map, audio graph, DSP, testing
- [CONTRIBUTING.md](../CONTRIBUTING.md) — development workflow and house style

The `*.cjs` files other than the three `check-*` harnesses are historical one-off generation scripts; they are not part of the build and should not be re-run.
