# Freebo

[中文](README.md) · 福瑞播

Browse your Emby library on its website and watch videos in a local player.

Freebo combines server management, player discovery and playback in a desktop app. Add your Emby address, sign in on the embedded website, and play a video. There is no browser extension, Python environment or separate service to start.

This is an early development version. See the [validation record](docs/validation.md) for tested behavior and remaining work.

## Features

- The original Emby website for browsing, search and account management.
- Multiple servers with separate persistent browser sessions.
- Guided first-use discovery of IINA, mpv, mpv.net and VLC, followed by manual scans when needed; manual selection and installation guides.
- Movies, episodes and video playlists, with continuous playback, resume and watch progress reporting.
- Emby media versions, subtitle and audio track selection.
- Home lists servers; Settings manages servers, players and preferences.
- A media button beside the address bar opens controls and the queue in a separate floating panel, with a link to the current item’s page. The Emby view keeps its size.
- A desktop tab bar, custom title bar, navigation toolbar and diagnostics.
- Chinese, English or system language, with light and dark appearance.

Music and live TV continue to play on the Emby website. Local playback applies to the website inside Freebo. Players are installed separately.

## Use

1. Install and open Freebo. Follow the first-use guide to choose a player and add an Emby address.
2. If you need a player, follow an installation guide and scan again or select it manually. Setup can also be completed later.
3. Open the server and sign in on its own website.
4. Click a video’s play button to open your selected local player.
5. Use the media button beside the address bar to open controls and the queue. The panel links directly to the current item’s page.

Later launches open Home. Add and edit servers or manage their sessions in Settings. Players are only scanned during initial setup or when you request a scan.

For a portable or custom player installation, select its application or executable in Settings. Server addresses support ports and reverse proxy subpaths.

## Development

Requires Node.js 22.12 or later and pnpm.

```sh
pnpm install
pnpm dev
pnpm check
pnpm package
```

Run `pnpm start` for the local production version. It builds the renderer, main process and preloads together before launching Electron to avoid mixed build versions.

The stack uses React, TypeScript, Electron, Vite, Vitest, Oxlint and Oxfmt. The main process handles browser sessions, media transport and player communication. React renders the app shell, while a separate `WebContentsView` loads the server website.

Media server providers own website injection, authentication, media resolution and progress reporting. Only Emby is currently registered. See [architecture](docs/architecture.md).

GitHub Actions is configured to check macOS, Windows and Linux and build macOS arm64/x64, Windows x64 and Linux x64 packages. Version tags create a draft release with checksums. Packages are unsigned by default; signing and macOS notarization require maintainer credentials.

## License

[Apache-2.0](LICENSE). Thanks to [embyToLocalPlayer](https://github.com/kjtsune/embyToLocalPlayer) for protocol and behavior references.
