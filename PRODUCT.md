# Freebo

<!-- impeccable:product-schema 1 -->

## Platform

web

Electron desktop application for macOS, Windows and Linux.

## Stack

User selected pnpm, React, Electron, Vite, Vitest and Oxc (Oxlint and Oxfmt). UI controls use shadcn/ui (Radix primitives) with Tailwind CSS v4.

## Users

People who want to watch videos from Emby without configuring scripts, dependencies or a separate background service. The user currently watches with IINA.

## Product Purpose

Open the application, add an Emby Server, sign in through its website and play videos in a supported local player. Installation and routine use must not require a terminal or configuration file.

## Operating Context

The Emby website remains responsible for the media library, search and account interface. This app manages server sessions, external playback and player setup. Users may use remote servers behind Cloudflare.

## Capabilities and Constraints

Apache-2.0. Cross-platform builds. First-use setup with one initial player scan and later manual rescans in Settings. Home shows servers; Settings owns server management. The address toolbar opens playback information and the queue in a native floating window, with a shortcut to the playing item’s server page. Graphical settings. No bundled player; provide installation and configuration guidance. Movies, episodes and video playlists, including continuous playback, resume, progress reporting, media versions, audio and subtitles. Music and live TV are not intercepted. No external browser extension in v1.

## Evidence on Hand

A user-provided Emby test account, held outside the repository, and an installed IINA. The separate embyToLocalPlayer checkout is a protocol and behavior reference. Runtime verification and packaging results must be recorded separately from planned support.

## Product Principles

Preserve the Emby browsing experience. Explain failures with a recovery action. Make player capabilities explicit. Keep authentication material out of logs and public assets.

## Brand Commitments

The product name is Freebo, capitalized as a person's name in every locale and in all brand assets. The Chinese nickname is informal and does not participate in brand materials. Repository and directory names remain freebo. The approved identity is the friendly guide dog with deep pine (#193C35), lime (#BDE64D) and paper (#FBFCF9). The chosen wordmark uses real Atma SemiBold 600 with tracking -0.015em; its portable SVGs are outlined from the licensed font, and editable sources retain font-backed text. Preserve the asymmetric ears, expression and supplied logo proportions. Atma is for the product name; interface copy uses system typography. The authoritative usage and regeneration record is [docs/brand/README.md](docs/brand/README.md). The user explicitly chose a familiar Chrome-style desktop shell with custom title bar, tabs and address bar. Emby receives the main viewing area; Freebo UI appears for server management, player setup and recovery.

## Open Decisions

Only the Emby provider ships initially. The architecture supports independently registered media-server providers; this does not claim support for additional servers. The app supports Chinese and English, with a persisted language preference and system default.
