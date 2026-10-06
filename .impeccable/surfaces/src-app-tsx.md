---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/style.css"]
---

# Freebo desktop application

Mode: Operate. Code-led. The user pinned Chrome's desktop layout and custom window title bar.

## Direction contract

THESIS: A desktop browser for a media server, with local playback. Server registration and setup use compact utility screens.

OWN-WORLD: Chrome's gray tab strip, white toolbar, rounded address field, blue selection, system UI type and neutral dark equivalent. Native window controls stay familiar on each OS.

STORY: Follow the first-use guide to discover a player once and add a server. Select a server from Home, sign in on its website, and play in the local player. Player rescans and server management live in Settings. A language setting changes the shell and recovery messages immediately. Server-page language remains independent.

FIRST VIEWPORT: 40px draggable tab strip with macOS traffic lights or Windows/Linux native control overlay; 48px navigation/address toolbar. A home server list, a first-use setup guide, or the selected settings panel below. Server management belongs to Settings, using a 216px rail and one panel at a time. Emby fills the remaining space. The address toolbar media action opens playback controls and the queue in a separate native floating window.

FORM: User-pinned Chrome convention overrides the previous IINA-like shell. No concept roll or image comp is needed for this explicitly named direction. Signature interaction: switch among server and utility tabs while keeping local playback controls accessible. Motion only acknowledges loading and selection.

FINISH: The user explicitly deferred full tests, UI detection and finish review until the interactions are agreed. Current changes are an intermediate local implementation. Existing captures and verdict describe the previous iteration. Refresh public captures and complete acceptance after confirmation.
