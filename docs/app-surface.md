# Freebo desktop application

Mode: Operate. Code-led. The user pinned Chrome's desktop layout and selected the guide-dog identity with Atma SemiBold.

## Direction contract

THESIS: A desktop browser for an Emby server, with local playback. Server registration and setup use compact utility screens.

OWN-WORLD: The approved guide dog and Atma 600 give Freebo its name and face. Deep pine, lime and paper extend into green semantic light/dark surfaces. Chrome's tab strip, separate toolbar and rounded address field keep the desktop layout familiar. System UI type handles Chinese/English controls; native window controls retain their operating-system behavior. The exact tokens and component rules are in [DESIGN.md](../DESIGN.md); identity usage is in [the brand specification](brand/README.md).

STORY: Follow the first-use guide to discover a player once and add a server. Select a server from Home, sign in on its website, and play in the local player. Player rescans and server management live in Settings. A language setting changes owned shell and recovery messages immediately. Server-page language remains independent.

FIRST VIEWPORT: A 40px draggable tab strip with native controls above a 48px navigation/address toolbar. The first-use welcome presents one centered approved lockup; Home lists servers and Settings uses a 216px rail with one panel at a time. Emby fills the remaining space. The address toolbar media action opens controls and queue in a separate native floating window.

FORM: Preserve the approved Chrome geometry through the branding change. The dog mark, home-tab Atma name, welcome/empty-state/About lockups and semantic green controls express the new identity. Signature interaction: switch among server and utility tabs while keeping local playback controls accessible. Motion acknowledges loading and state changes.

FINISH: The 2026-10-06 branding pass has clean actual Electron welcome and settings captures in both languages, plus light/dark and popup evidence. The app uses its real preload/IPC with an isolated profile; IINA discovery was exercised. The 820 × 600 check uses a CSS viewport, not native window resizing. This pass did not exercise server authentication or media playback. Previous reviews and real-media records retain their original iteration scope; the broader interaction and cross-platform acceptance work remains listed in [validation.md](validation.md).
