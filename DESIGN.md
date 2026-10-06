---
name: Freebo / 福瑞播
description: Chrome-style desktop tabs and utility controls around the original Emby browsing interface.
colors:
  bg: "#f8f9fa"
  tab-strip: "#dee1e6"
  address: "#f1f3f4"
  surface: "#fff"
  toolbar: "#fff"
  ink: "#202124"
  muted: "#5f6368"
  line: "#dce0e7"
  accent: "#1a5fc5"
  accent-soft: "#e7f0fb"
  danger: "#b13a3a"
  hover: "#e3e7ed"
  dark-bg: "#292a2d"
  dark-tab-strip: "#202124"
  dark-address: "#202124"
  dark-surface: "#292a2d"
  dark-toolbar: "#35363a"
  dark-ink: "#e8eaed"
  dark-muted: "#a4aebc"
  dark-line: "#48494c"
  dark-accent: "#88baf3"
  dark-accent-soft: "#293d57"
  dark-danger: "#f3a2a2"
  dark-hover: "#303743"
  connected: "#2a8d64"
typography:
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif'
    fontSize: "21px"
    fontWeight: 650
    lineHeight: 1.3
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif'
    fontSize: "17px"
    fontWeight: 620
    lineHeight: 1.4
  title-small:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif'
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif'
    fontSize: "13px"
    lineHeight: 1.65
  control:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif'
    fontSize: "13px"
    fontWeight: 550
    lineHeight: 1.5
  navigation:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif'
    fontSize: "13px"
  field:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif'
    fontSize: "14px"
  tab:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif'
    fontSize: "12px"
  metadata:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif'
    fontSize: "11px"
rounded:
  control: "6px"
  button: "7px"
  row: "8px"
  tab: "9px 9px 0 0"
  form: "12px"
  address: "18px"
  switch: "20px"
  navigation: "0 22px 22px 0"
  circle: "50%"
spacing:
  tight: "6px"
  icon-gap: "8px"
  compact-gap: "10px"
  control-gap: "12px"
  row: "18px"
  section-gap: "24px"
  panel: "28px"
  page: "32px"
  wide: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.control}"
    rounded: "{rounded.button}"
    padding: "11px 18px"
  button-quiet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.button}"
    padding: "8px 12px"
  button-text:
    textColor: "{colors.accent}"
    typography: "{typography.control}"
    rounded: "{rounded.button}"
    padding: "4px 0"
  button-icon:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "34px"
    width: "34px"
  button-icon-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    height: "34px"
    width: "34px"
  browser-tab:
    textColor: "{colors.muted}"
    typography: "{typography.tab}"
    rounded: "{rounded.tab}"
    height: "34px"
    width: "190px"
  browser-tab-active:
    backgroundColor: "{colors.toolbar}"
    textColor: "{colors.ink}"
    typography: "{typography.tab}"
    rounded: "{rounded.tab}"
    height: "34px"
    width: "190px"
  address-bar:
    backgroundColor: "{colors.address}"
    textColor: "{colors.muted}"
    rounded: "{rounded.address}"
    padding: "0 13px"
    height: "34px"
  input-server:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "{rounded.control}"
    padding: "11px 12px"
    width: "100%"
  navigation-settings:
    textColor: "{colors.muted}"
    typography: "{typography.navigation}"
    rounded: "{rounded.navigation}"
    padding: "12px 16px"
  navigation-settings-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    typography: "{typography.navigation}"
    rounded: "{rounded.navigation}"
    padding: "12px 16px"
  form-server:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.form}"
    padding: "{spacing.section-gap}"
    width: "min(100%, 510px)"
  player-row-selected:
    backgroundColor: "{colors.accent-soft}"
    rounded: "{rounded.row}"
    padding: "14px 12px"
  switch:
    backgroundColor: "{colors.muted}"
    rounded: "{rounded.switch}"
    height: "21px"
    width: "36px"
  switch-checked:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.switch}"
    height: "21px"
    width: "36px"
  queue-item-current:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "13px 9px"
---

# Design System: Freebo / 福瑞播

## Overview

**Creative North Star: "Chrome desktop browser"**

Chrome's desktop browser shell is the confirmed visual reference for Freebo / 福瑞播. A gray tab strip, a separate navigation toolbar and a rounded address field frame compact utility pages. The previous IINA-like shell is superseded by the user's approved Chrome direction; the build is code-first and has no approved image comp.

System typography and neutral light/dark surfaces keep the application familiar in Chinese and English. Blue identifies actions, selection and keyboard focus. Emby supplies the library and sign-in interface inside the native guest view; Freebo's own chrome manages server tabs, setup, playback and recovery.

**Key Characteristics:**

- A two-row browser shell with native operating-system window controls.
- Neutral light/dark surfaces, system typography and a restrained blue accent.
- Compact server lists and a settings rail that shows one utility panel at a time.
- Persistent playback controls and recovery areas outside the native guest view.

## Colors

A neutral browser shell carries one blue action and selection family. The frontmatter records the browser visual language. Runtime colors now use shadcn semantic tokens: `background`, `foreground`, `card`, `primary`, `accent`, `muted-foreground`, `border`, `secondary` and `destructive`. `tab-strip`, `address` and `toolbar` remain shell-specific variables. Component sizing and state styles come from `src/components/ui/`; those implementations supersede the earlier hand-written control metrics in the frontmatter.

### Primary

- **Utility Blue** (`accent`): primary buttons, links, caret, focus outline, selected navigation and playback controls.
- **Soft Blue Selection** (`accent-soft`): selected settings entries, player rows, queue items and text selection.

### Neutral

- **Workspace Paper** (`bg`): the scrollable utility workspace; **Tab Gray** (`tab-strip`): the draggable title-bar strip; **Address Gray** (`address`): the inset address field.
- **Utility Surface** (`surface`) and **Toolbar Surface** (`toolbar`): form/panel surfaces and the active tab/toolbar. They share a light value and separate in dark appearance.
- **Reading Ink** (`ink`), **Supporting Gray** (`muted`), **Divider Gray** (`line`) and **Hover Gray** (`hover`): content, secondary detail, thin boundaries and pointer feedback.

The `danger` pair marks recovery errors and removal actions. `connected` is the ready connection dot and currently retains the same value in both themes; it is state feedback, not an additional brand accent.

**The Local Appearance Rule.** Follow the system appearance or the explicit app setting through the existing CSS variables. Emby's appearance remains controlled by Emby; shell language and theme changes affect owned chrome.

## Typography

The system UI stack serves headings, body copy and controls; there is no separate display family. Utility headings use the title, headline and small-title roles in the frontmatter. Body paragraphs use the compact body role, while buttons use the slightly stronger control role. Fields, tabs and metadata retain their own observed sizes.

Local component treatments remain local: the settings rail heading is smaller than the page title (20px), the welcome heading is slightly larger than the normal section heading (19px, weight 600), and explanatory setting text uses the tab-size step (12px). Executable paths, provider labels, queue positions and playback times use metadata. Playback times use tabular numerals. Browser tab labels and current playback titles ellipsize; URLs and executable paths wrap.

**The Readable Detail Rule.** Keep explanatory text beside its setting, wrap long server URLs and executable paths, and retain action-specific accessible names for icon-only controls. Chinese and English use the same hierarchy.

## Layout

The application is a full-height flex frame with a scrolling workspace. The persistent browser shell is two rows (88px total): a draggable tab strip (40px) above the navigation/address toolbar (48px). Tabs are aligned to the bottom of the strip. Normal server/utility tabs are 190px wide; the home tab is 150px wide. The tab list scrolls horizontally as needed. On non-fullscreen macOS, the strip reserves 84px at the left for native traffic lights; Windows/Linux reserve 148px at the right for the native control overlay. Clickable tabs and the new-tab button are outside the drag region.

Server content is centered in a maximum-width container (960px), with page padding (32px 36px 20px). A bordered server form is capped at 510px. Settings use a left rail (216px) and a flexible content column; the body is capped at 880px with padding (28px 40px 40px). The rail is sticky and its available height subtracts only the browser shell. Settings render one selected panel at a time.

The toolbar media action opens a separate native floating window, capped at 420px wide and 640px high and clamped to the display work area. Its size also accommodates smaller main windows. Playback controls, recovery and the queue stay inside that window; the server page keeps its full size. Home is a server list, with management actions in Settings. A first-use guide selects a player and registers a server; player discovery runs once there and is persisted.

**The Native Geometry Rule.** The guest starts below the 88px shell and shifts down by 64px for a server or generic error. Playback state and the floating panel never subtract from the guest's width or height.

The native window opens at 1280 × 850 and has a minimum size of 820 × 600. At 1000px CSS narrows the settings rail to 190px, uses 28px settings-body padding, narrows standard/home tabs to 160px/130px, hides secondary connection detail. At 650px the rail becomes 150px, setting/guide rows wrap. The latter is below the native minimum and is a narrow-preview fallback, not a mobile application contract.

## Elevation & Depth

The shell, utility pages, server form and settings rows are flat. Tones and one-pixel dividers establish hierarchy. The playback popup is a native task window with the operating system shadow. shadcn controls use their standard visible focus rings. The address field keeps an accent outline around its whole container with no offset. Select menus use shadcn's popover surface, border and soft shadow.

**The Task Depth Rule.** Keep ordinary settings and server rows flat. Use a native window for the temporary playback task layer; hierarchy elsewhere comes from surface tone, selection and thin dividers.

## Shapes

Tabs have curved top corners and square bottom corners so the active tab joins its toolbar. The address field is a pill. Settings entries use a straight left edge and a rounded right end, distinct from the lightly rounded controls and selected player rows. The bordered server form has the larger container corner in the tokens. Close/new-tab controls and switch thumbs are circular; the switch track is a compact pill. Server and ordinary settings rows use horizontal dividers rather than repeated cards. The authored SVG application icon remains the Freebo identity asset.

## Components

### Buttons

shadcn Button variants carry action hierarchy: default for primary actions, outline for quiet actions, link for text actions and ghost for icon/navigation actions. Blue action and soft-blue selection colors retain the Freebo palette. Component variants own hover, disabled and keyboard focus states; page CSS does not override them. Buttons default to `type="button"`; the server form explicitly marks its save action as submit.

### Browser tabs and address toolbar

The active tab adopts the toolbar fill and reading ink; inactive tabs use muted ink with a neutral hover fill. Each server tab separates its selectable title from its circular close action. Closing a tab keeps the server registered. The plus control opens the server form. A settings tab appears once settings is opened and can be closed independently.

Back, forward, reload and home sit before the address field. Their disabled states follow the active library page and navigation state. The address input is read-only: it reflects the current server URL or `freebo://servers` / `freebo://settings`, and is not an arbitrary URL-entry feature. The focus-within outline encloses the rounded field. A compact ready/connecting indicator is secondary detail and hides at the desktop compaction breakpoint.

### Server form and fields

The flat bordered form uses a visible heading and field labels, a provider select, a URL-friendly server-address field and an optional name. shadcn Input and Label provide field, focus and label states. OptionSelect composes shadcn Select with a Portal menu, a visible selected-item check, keyboard navigation and focus restoration on Escape. The provider is disabled when only one provider exists or an existing server is being edited. Credentials are entered in the following Emby webpage. Saving feedback appears within the main action; supporting field help stays next to the field.

### Settings rail and utility rows

Muted labeled buttons with SVG icons select one of six panels: players, playback, appearance, servers, diagnostics and about. Active entries use soft blue, blue ink and the stronger control weight. Hover uses the neutral hover fill. Appearance contains separate theme and language selectors, each offering a system default. Persisted language changes update owned shell labels and recovery messages; server-page language remains independent.

Player rows use shadcn RadioGroup and Label, a full clickable label row and a soft-blue selected surface. Name, executable path and default marker remain readable. shadcn Collapsible presents installation guidance, initially expanded when no player is discovered. Ordinary setting rows pair their title/help with the relevant switch, selector or action and a divider below.

### Switches

shadcn Switch provides the switch role, checked state, thumb motion and keyboard interaction. Use its component dimensions and state styles rather than a checkbox pseudo-element.

### Recovery, playback and queue

Server-load errors offer reload; generic action errors offer close; playback/synchronization errors lead to settings. Recovery surfaces use readable danger text and keep the action separate. Playback shows the current title, player/status, named previous/play-pause/stop/next controls, tabular times and a shadcn Slider. Seeking previews the selected time locally and sends a seek command on value commit. Previous/next and unavailable playback actions preserve their disabled boundaries. Queue entries are numbered; the current item receives soft blue, blue text and a play icon.

**The Purposeful Motion Rule.** Use motion for loading rotation and switch state feedback. Honor the existing reduced-motion rule, which removes animation and transition from owned UI.

## Do's and Don'ts

### Do:

- Do preserve the user's Chrome desktop shell with tabs, navigation and a rounded address field.
- Do use the existing CSS variables for both light and dark appearance.
- Do keep the shell and server recovery dimensions synchronized with native guest bounds, while playback floats independently.
- Do show one settings panel at a time and keep its label and selected rail entry consistent.
- Do give recovery controls the name of the action they perform.
- Do preserve Chinese and English labels, visible keyboard focus and accessible icon names.
- Do use actual clean app captures for public interface imagery and retain their provenance.

### Don't:

- Don't restyle Emby's library or account interface as Freebo chrome.
- Don't turn row-based settings and server lists into decorative elevated card grids.
- Don't treat closing a browser tab as deletion of its registered server.
- Don't infer mobile, Windows/Linux or physical window-drag acceptance from CSS or macOS content captures.
- Don't treat a content-only shell capture or scoped finish verdict as whole-product runtime acceptance.

Sources: [product context](PRODUCT.md), [approved app surface](docs/app-surface.md), [quality bar](docs/quality-bar.md), `src/style.css`, `src/App.tsx` and `electron/main.ts`. The previous [independent finish review](docs/design-review.md) returned `ship` with no material fixes in its stated shell scope. The current [capture matrix](.impeccable/review/freebo/matrix.md) records 11 actual-app captures spanning Chinese/English, light/dark, server/setup/recovery and the minimum desktop window, plus a private playback/queue shell capture. Content captures exclude native window controls and the guest view. macOS native controls were separately observed through CUA accessibility; Windows/Linux control overlays are code-checked, and physical window dragging is not runtime accepted. The separate website retains its own incumbent design authority.

Not canonized: the superseded IINA-like palette, type/radius scale and geometry. This record replaces them under the approved Chrome system change; the single detector pass's 16 advisory notes against the old record do not become new design rules. No material defect was reported in the fresh finish review. The sidecar's synthesized tonal ramps are preview metadata, not additional colors used by the application.

## Current interaction iteration

The user deferred full tests, UI detection, capture updates and independent review until the interaction is agreed. The first-use guide, home list and native playback popup are currently implemented locally; the earlier screenshots and `ship` verdict do not validate them. Raster assets and examples will be refreshed together at final acceptance.
