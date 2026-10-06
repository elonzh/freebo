---
name: Freebo
description: A friendly guide dog for Emby browsing and local playback, within a familiar desktop browser shell.
colors:
  pine: "#193c35"
  lime: "#bde64d"
  background: "#fbfcf9"
  tab-strip: "#e0e8db"
  address: "#eef3e9"
  card: "#ffffff"
  toolbar: "#ffffff"
  foreground: "#193c35"
  muted: "#e4ebdf"
  muted-foreground: "#52675b"
  border: "#d8e1d3"
  input: "#a8b99f"
  primary: "#193c35"
  primary-foreground: "#fbfcf9"
  accent: "#eaf3d3"
  destructive: "#ad3636"
  secondary: "#edf3e8"
  dark-background: "#17231f"
  dark-tab-strip: "#111b17"
  dark-address: "#111b17"
  dark-card: "#1d2c25"
  dark-toolbar: "#213229"
  dark-foreground: "#f1f6e9"
  dark-muted: "#34483c"
  dark-muted-foreground: "#b4c5b2"
  dark-border: "#3e5546"
  dark-input: "#667d64"
  dark-primary: "#bde64d"
  dark-primary-foreground: "#193c35"
  dark-accent: "#2e4628"
  dark-destructive: "#f5a6a1"
  dark-secondary: "#293d30"
  connected: "#2a8d64"
typography:
  brand:
    fontFamily: '"Freebo Atma", sans-serif'
    fontWeight: 600
    letterSpacing: "-0.015em"
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif'
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.3
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif'
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.4
  title-small:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif'
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif'
    fontSize: "13px"
    lineHeight: 1.625
  control:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif'
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.428571
  navigation:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif'
    fontSize: "13px"
    fontWeight: 500
  tab:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif'
    fontSize: "12px"
  metadata:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif'
    fontSize: "11px"
rounded:
  small: "4px"
  control: "6px"
  surface: "8px"
  tab: "9px 9px 0 0"
  form: "12px"
  address: "18px"
  navigation: "0 22px 22px 0"
  pill: "9999px"
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
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "36px"
  button-ghost:
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "36px"
  button-icon:
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    height: "36px"
    width: "36px"
  button-icon-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
    height: "36px"
    width: "36px"
  browser-tab:
    textColor: "{colors.muted-foreground}"
    typography: "{typography.tab}"
    rounded: "{rounded.tab}"
    height: "34px"
    width: "190px"
  browser-tab-active:
    backgroundColor: "{colors.toolbar}"
    textColor: "{colors.foreground}"
    typography: "{typography.tab}"
    rounded: "{rounded.tab}"
    height: "34px"
    width: "190px"
  address-bar:
    backgroundColor: "{colors.address}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.address}"
    padding: "0 13px"
    height: "34px"
  input-server:
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "4px 12px"
    height: "36px"
    width: "100%"
  navigation-settings-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.primary}"
    typography: "{typography.navigation}"
    rounded: "{rounded.navigation}"
    padding: "12px 16px"
  form-server:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.form}"
    padding: "{spacing.section-gap}"
    width: "min(100%, 510px)"
  switch:
    backgroundColor: "{colors.input}"
    rounded: "{rounded.pill}"
    height: "1.15rem"
    width: "32px"
  switch-checked:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    height: "1.15rem"
    width: "32px"
---

# Design System: Freebo

## Overview

**Creative North Star: "The friendly guide dog"**

Freebo pairs the approved guide-dog mark with Atma SemiBold. Deep pine gives the identity a steady outline; lime provides a clear, lively point of recognition. The asymmetric ears and friendly expression belong to the mark's identity. Use the supplied vector family for the name, logo and app icon, with Freebo capitalized in every locale.

The identity sits within the user's confirmed Chrome desktop layout: tabs above a navigation toolbar and rounded address field. Warm green surfaces carry compact utility pages. System typography keeps instructions and controls readable in Chinese and English; the character font is reserved for the product name in application chrome. Emby owns its library and sign-in interface in a native guest view. Freebo owns server management, setup, playback controls and recovery.

**Key Characteristics:**

- An approved guide-dog mark and a real Atma 600 wordmark.
- Deep pine, lime and paper, with semantic light/dark utility surfaces.
- A two-row desktop browser shell with native operating-system controls.
- Flat, compact settings and server rows; temporary playback in a native floating window.

## Colors

The frontmatter extracts the current semantic palette from [src/style.css](../src/style.css). The brand's three foundation colors and vector usage are recorded in [the brand specification](brand/README.md); interface tokens derive the light and dark utility surfaces from that identity.

### Primary

- **Deep Pine** (`pine`, `primary`): brand structure, light-theme actions, links and focus feedback.
- **Lime** (`lime`, `dark-primary`): the dog-mark accent, sharing materials and dark-theme actions. It is not a blanket background for every panel.
- **Soft Green Selection** (`accent`, `dark-accent`): selected navigation, player rows and playback items.

### Neutral

- **Paper** (`background`) and **Night Green** (`dark-background`): the owned workspace.
- **Tab Surface**, **Address Surface**, **Card Surface** and **Toolbar Surface**: separate the browser layers and utility containers without decorative gradients.
- **Reading Ink**, **Supporting Ink**, **Divider** and **Field Stroke**: preserve readable text and clear control boundaries in both themes.

`destructive` marks removal and recovery errors. `connected` marks a ready connection and is state feedback rather than a fourth identity color.

**The Semantic Appearance Rule.** Use semantic CSS variables and shadcn variants for owned controls. Follow system or explicit app appearance. Emby's appearance remains controlled by Emby.

## Typography

**Display Font:** Atma SemiBold, served locally as `Freebo Atma`, for Freebo's name in the app. The brand-kit display headings have their own documented presentation scale.
**Body Font:** The system sans-serif stack in the frontmatter, including Noto Sans fallback.

The chosen wordmark is real Atma at weight 600 with tracking −0.015em. Portable wordmarks are shaped with HarfBuzz and outlined with fontTools; the editable SVG sources retain font-backed text. Do not redraw the letters. Disable synthetic bold and italic. The home-tab name uses 16px type; the logo assets preserve their own glyph geometry.

Utility page titles, section headings and smaller headings use the title, headline and title-small roles. Paragraphs use body; shadcn buttons and desktop inputs use control. Tabs and navigation have their compact roles. The Home empty-state heading uses 19px and the settings-rail heading uses 20px; these are local hierarchy choices, while the Atma home-tab name stays at 16px. Explanatory setting copy uses 12px, executable paths and provider labels use metadata, and playback times use tabular numerals. Long URLs and paths wrap; tab and playback titles ellipsize.

**The Name Type Rule.** Within the application, Atma spells Freebo. Instructions, URLs, settings and translated copy use the system UI stack. The independent brand-kit page may use its documented Atma display heading.

## Layout

The full-height desktop frame keeps a fixed browser shell (88px): a draggable tab strip (40px) above a navigation/address toolbar (48px). Tabs align to its bottom. Standard tabs are 190px wide and Home is 150px; the list scrolls horizontally when needed. macOS reserves 84px at the left for traffic lights outside fullscreen. Windows/Linux reserve 148px at the right for native control overlays. Interactive tab controls sit outside the drag region.

Home uses a centered container capped at 960px, with padding of 32px 36px 20px. First-use setup is capped at 760px with 36px horizontal and 32px vertical padding. It uses a single centered logo on welcome, followed by ordinary setup steps. Empty Home and About also use the approved lockup; routine utility rows do not repeat it.

Settings use a 216px rail and flexible content column, separated by spacing without a vertical rule. The content is centered within the remaining column and capped at 880px, with 28px 40px 40px padding. Navigation orders Servers, Players, Appearance and language, Diagnostics, and About. The rail stays below the browser shell and presents one selected panel at a time. A server form is capped at 560px, with 20px internal padding, 16px field-group gaps and 8px label gaps. Account and password share a row when the form content is at least 384px wide. The footer places connection testing and a fixed-height result area on the left, and cancel/save on the right; narrower containers stack these groups. Setup reuses this compact form with less space around its progress row and navigation. Home lists servers; management belongs in Settings. The tab-strip plus opens a native server-list window anchored below it; selecting Add server goes directly to the settings form.

**The Native Geometry Rule.** The Emby guest begins below the 88px shell and moves down by 64px when a server or generic recovery bar appears. Playback controls and queue stay in a separate native window and do not subtract from the guest's size.

The native window opens at 1280 × 850 with a minimum of 820 × 600. At 1000px, settings use a 190px rail and 28px content padding; standard/Home tabs narrow to 160px/130px and secondary connection text hides. At 650px, the rail becomes 150px and utility rows wrap. This narrower CSS fallback is below the native minimum and does not establish a mobile-app contract. Playback's native floating window is capped at 420 × 640 and clamped to the display work area.

## Elevation & Depth

The shell, utility pages and ordinary settings/server rows remain flat. Surface tones and one-pixel boundaries establish hierarchy. shadcn outline controls and inputs retain their small component shadow; Select uses a bordered popover and soft shadow. The playback popup receives the operating system's native window shadow. Keyboard focus stays visible through shadcn rings; the address field uses a primary outline around its entire pill.

**The Task Depth Rule.** Keep routine settings flat. Use a native window for the temporary playback task layer.

## Shapes

Tabs have curved top corners; the active tab flares outward through concave curves at both bottom corners to join the toolbar. The scrollable tab list reserves space for these curves, and active curves stay above neighboring hover surfaces. The address field is a pill. Settings navigation has a straight left edge flush with the window and a rounded right end; the icon and label retain their inset padding. shadcn controls use the control radius; the server form uses the larger form radius. Close/new-tab buttons and switch thumbs are circular. Ordinary rows use dividers rather than repeated raised cards.

The mark preserves the asymmetric ears, face and three-color silhouette in the editable [vector master](../assets/brand/freebo/source/mark.svg). Horizontal lockups size the dog to 1.1 times the wordmark's visible ink height and separate it by 0.1 times that height. Center the visible dog and glyph bounds vertically. Use the supplied stacked and monochrome variants rather than altering the primary lockup. Detailed clear space and minimum-size rules live in [the brand specification](brand/README.md).

## Components

### Buttons and fields

Use shadcn Button default, outline, ghost and link variants for primary, supporting, icon and text actions. Default buttons are 36px tall; the selected icon surface uses `accent` with `primary` ink. Keep hover, disabled, destructive and keyboard-focus states in the shared components. Buttons default to `type="button"`; form saving explicitly uses submit.

shadcn Input and Label supply field states and accessible labeling. OptionSelect uses shadcn Select with its Portal menu, selected-item check and keyboard behavior. The provider is disabled when only one exists or a server is edited. The server form accepts optional credentials and exposes password visibility; saved credentials fill the Emby login page without submitting it. Keep field help beside the relevant field and saving feedback inside the action.

### Browser tabs and address toolbar

The active tab takes the toolbar surface and foreground ink; inactive tabs use supporting ink with neutral hover. Server title and close actions remain separate. Closing a tab keeps its server registered. Settings has its own closable tab. The plus action opens the server-selection popup.

Back, forward, reload and Home precede the address field. The address is read-only and reflects the server URL or an internal Freebo page; it does not accept arbitrary URL entry. Media status and Settings actions sit after it. BrandName renders the home-tab name with the bundled Atma font; BrandLogo supplies identical light/dark vector geometry with an accessible Freebo name.

### Settings, players and first-use setup

The rail selects servers, players, appearance, diagnostics or About. Soft green with primary ink marks selection. One player list presents every supported player for the current platform: detected paths use shadcn RadioGroup and a full clickable label with a selected surface; missing paths show an introduction and a globe button for the official download page. Preserve readable player names, paths and default markers, and display multiple installation paths separately. Manual path selection uses an independent folder button. Continuous playback and fullscreen switches follow the list. About presents the brand, version, license and product links without repeating provider support copy.

Home server rows open the server from an area that includes its icon, name, address and whitespace; an independent edit icon opens its form. Management uses the same row geometry, with its main area opening the editor and separate icons for opening, signing out and removing. Server form headings sit outside the card; fields follow type, optional name, address and credentials. Connection results appear beside testing, with success and error colors and reserved space that keeps the action row stable.

A first-use player scan runs once and persists its completed state; later scans are manual. Setup offers language selection, player discovery, a blank server registration form and completion. Server registration always starts with the new form, including when other servers are already saved; completion summarizes the server created in that run. Use Switch for boolean settings and separate Selects for theme and language, each with a system default. Locale changes affect owned shell and recovery messages; server-page language remains independent.

### Recovery, playback and queue

Recovery uses readable destructive text with an action named for reload, close or settings. The native playback window holds title, player/status, previous/play-pause/stop/next controls, tabular times, Slider and queue. Seeking previews locally and commits a seek command on value commit. Unavailable actions remain disabled; selected queue entries use accent and primary ink.

**The Purposeful Motion Rule.** Loading rotation, switch feedback and shared control transitions communicate state. Honor reduced motion by disabling animation and transition in owned UI.

## Do's and Don'ts

### Do:

- Do use the approved vector logo family, Atma 600 and the bundled font license.
- Do keep Freebo capitalized in every locale and in all brand materials.
- Do preserve Chrome-style desktop tabs, navigation and the rounded address field.
- Do keep shell and recovery geometry synchronized with native guest bounds.
- Do use shadcn controls and existing semantic variables for both appearances.
- Do keep translated labels, keyboard focus and action-specific icon names readable.
- Do use clean actual-app screenshots and retain source information with the assets.

### Don't:

- Don't redraw the wordmark, stretch the mark or add a Chinese alias to brand assets.
- Don't use a grayscale filter as a substitute for the supplied monochrome vector cutouts.
- Don't apply Atma to utility instructions, settings or Emby's interface.
- Don't restyle Emby's library/account pages as Freebo chrome.
- Don't turn ordinary settings and server rows into decorative elevated card grids.
- Don't treat closing a tab as deletion of its registered server.
- Don't infer native window resizing, real playback or cross-platform acceptance from CSS captures.

Sources: [product design](product.md), [brand specification](brand/README.md), `src/style.css`, `src/components/ui/`, `src/App.tsx`, `src/components/SetupGuide.tsx` and `electron/main.ts`. Runtime behavior and verification boundaries are maintained in [architecture](architecture.md).
