# Contributing

Thanks for your interest! This project aims to be *the* open toolkit for
viewing EPLAN project exports outside of EPLAN itself. Any help is welcome:
format findings, sample files you are allowed to share, bug reports, code.

## Development setup

Requires Node.js ≥ 20 (npm workspaces).

```bash
npm install
npm run dev            # builds packages/e3d-core, then starts the web app (Vite)
npm run build          # production build of everything
npm run test:samples   # parser smoke test against the files in samples/
```

The core library (`packages/e3d-core`) is built with `tsc`; if you change it
while `npm run dev` is running, rebuild it (`npm run build -w @covaga/e3d-core`
or `npm run watch -w @covaga/e3d-core` in a second terminal).

## Project structure

- `packages/e3d-core` — parsing/format logic only. No UI, no framework
  dependencies beyond three.js (scene builder) and the wasm helpers
  (7z-wasm, sql.js). Keep it usable from Node and the browser.
- `apps/web` — the viewer UI (React). UI state stays here; format knowledge
  stays in the core.
- `docs/formats.md` — the community format documentation. If you discover
  something new about `.e3d` / `.epdz` / `manifest.db`, document it there in
  the same PR as the code that uses it.

## Guidelines

- **Verify with real files.** Run `npm run test:samples` and load the
  `samples/` files in the viewer before submitting parser changes. If you
  add support for a new format feature, try to add a (small, shareable)
  sample that exercises it.
- **Respect licensing.** Do not commit proprietary EPLAN binaries or
  code. Sample data must be from publicly distributed demo/template
  content or files you have the right to share.
- **Keep the browser-only promise.** Nothing in the viewer may upload user
  files anywhere; parsing stays client-side.
- Small, focused PRs with a clear description beat large ones.

## Reporting issues

For parsing failures, please include: the format version byte (first byte of
the `.e3d`), the error message shown in the status bar / console, and — if at
all possible — the file itself or a minimal reproduction.

## License

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE).
