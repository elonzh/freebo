<picture style="align-items: center; display: flex; justify-content: center;">
  <source media="(prefers-color-scheme: dark)" srcset="assets/brand/freebo/svg/logo-on-dark.svg" />
  <img src="assets/brand/freebo/svg/logo.svg" width="280" alt="Freebo" />
</picture>

[![中文](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-193C35?style=flat&logo=googletranslate&logoColor=white)](README.md)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-193C35?style=flat)](LICENSE)
[![Download Freebo](https://img.shields.io/badge/Download-Freebo-193C35?style=flat)](https://github.com/elonzh/freebo/releases/latest)
[![macOS, Windows, Linux](https://img.shields.io/badge/Platforms-macOS%20%C2%B7%20Windows%20%C2%B7%20Linux-193C35?style=flat)](#features)
[![Product website](https://img.shields.io/badge/Website-Freebo-193C35?style=flat)](https://elonzh.cn/en/toys/freebo)
[![Changelog](https://img.shields.io/badge/Changelog-193C35?style=flat)](CHANGELOG.md)

**A free, open-source desktop media client. Browse your familiar library and watch with your favorite local player.**

**Free** means both free of charge and free to choose your player. Freebo has no subscription or format unlock fees and runs on macOS, Windows and Linux. Add a server, sign in on its website, and press play to open your local player.

## Why Freebo exists

Your library already organizes your videos, and your computer already has a player you like. Freebo brings them together so browsing, watching and resuming feel connected. Keep your media server’s website, watch in your chosen local player, and sync progress back to your library.

## Features

- Multiple server tabs with separate persistent sign-in sessions.
- Movies, episodes and video playlists with resume, continuous playback and watch progress sync.
- Emby audio, subtitle and video-version selections.
- A floating panel for pause, seeking and queue navigation.
- Installed player discovery and manual path selection.
- English and Chinese, light and dark appearance, and remembered window size and position.

| System  | Players                                      |
| ------- | -------------------------------------------- |
| macOS   | IINA, mpv, VLC                               |
| Windows | mpv.net, PotPlayer, MPC-HC, MPC-BE, mpv, VLC |
| Linux   | mpv, VLC                                     |

Music and live TV continue to play on the Emby website.

## Quick start

1. [Download the installer](https://github.com/elonzh/freebo/releases/latest), open Freebo, and select an installed player during initial setup.
2. Add your Emby server address and sign in on its website.
3. Press play in your library. Use the playback button beside the address bar to open the floating controls.

Servers and players can be changed in Settings. Server names are optional; saved credentials fill the sign-in form. Choose a path manually for portable players. Server addresses support ports and reverse proxy subpaths.

## Run from source

```sh
pnpm install
pnpm dev
```

## Development guide

### Environment and startup

Use Node.js 22.12 or later and the pnpm version specified in `package.json`.

```sh
pnpm install
prek install
pnpm dev
```

`pnpm dev` builds the main process and preloads, then starts Vite and Electron. Restart after changing `electron/`; Vite hot-reloads React pages. The app depends on IPC, so connect to Electron’s browser engine for debugging.

`pnpm start` builds the full app before launching the local production version. `pnpm dev:web` and `pnpm preview` serve only the renderer and do not replace Electron runtime checks.

### Checks and commits

During development, run correctness checks relevant to your changes:

| Command                            | Purpose                                   |
| ---------------------------------- | ----------------------------------------- |
| `pnpm typecheck`                   | TypeScript type checking                  |
| `pnpm exec vitest run <test-file>` | Targeted tests                            |
| `pnpm test`                        | All Vitest tests                          |
| `pnpm build`                       | Renderer, main process and preload builds |

Commit checks are configured in [prek.toml](prek.toml). Oxlint applies safe fixes, then Oxfmt formats the files in the commit. Application types, Vitest, the app build, brand-page types and the brand-page build run as separate steps. If automatic fixes change files, review and stage the changes before committing again. Use `prek run --all-files` to check the entire repository.

Leave formatting and style-only checks to the commit hook. Use Conventional Commits with Chinese descriptions of the changes and validation.

### Packaging and releases

`pnpm package` builds the app and uses electron-builder to generate packages for the current platform in `release/`.

## Acknowledgments

Thanks to [embyToLocalPlayer](https://github.com/kjtsune/embyToLocalPlayer) for protocol and behavior references.
