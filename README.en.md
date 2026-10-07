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

- Emby, Jellyfin and Plex servers, with separate persistent sign-in sessions in each tab.
- Movies, episodes and video playlists with resume, continuous playback and watch progress sync.
- Your library's audio, subtitle and video-version selections.
- A floating panel for pause, seeking and queue navigation.
- Installed player discovery and manual path selection.
- English and Chinese, light and dark appearance, and remembered window size and position.
- Keep playing in the background when the main window closes; reopen or quit from the tray.

| System  | Players                                      |
| ------- | -------------------------------------------- |
| macOS   | IINA, mpv, VLC                               |
| Windows | mpv.net, PotPlayer, MPC-HC, MPC-BE, mpv, VLC |
| Linux   | mpv, VLC                                     |

Music and live TV continue to play on the server website.

## Quick start

1. [Download the installer](https://github.com/elonzh/freebo/releases/latest), open Freebo, and select an installed player during initial setup.
2. Choose Emby, Jellyfin or Plex, add your media server address and sign in on its website.
3. Press play in your library. Use the playback button beside the address bar to open the floating controls.

Servers and players can be changed in Settings. Server names are optional; saved Emby and Jellyfin credentials fill the sign-in form. Plex keeps its Web sign-in session; enter the media server address (for example `http://192.168.1.10:32400`). Choose a path manually for portable players. Server addresses support ports and reverse proxy subpaths.

Supported installed builds check for updates and download them automatically. Restart to install from Settings → About; other builds link to the download page. See [architecture](docs/architecture.md#构建与升级) for supported packages.

## Development guide

See the [development workflow](docs/development.md) for running from source, checks, commits, Emby/Jellyfin/Plex integration tests, and packaging.

## Acknowledgments

Thanks to [embyToLocalPlayer](https://github.com/kjtsune/embyToLocalPlayer) for protocol and behavior references.
