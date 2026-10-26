# Design System

<!-- impeccable:design-schema 1 -->

## Direction

Raru Score is a quiet night-stage for rhythm data. The interface is operational first: one strong search instrument, a readable score sequence, and a reliable export action. Its identity comes from sparse rhythm geometry and one animated pink `osu!` wordmark, not from decorative glass panels or a field of generic cards.

## Colors

- Stage: `--stage` `#0d0d14` and `--stage-raised` `#12111a`.
- Surfaces: `--surface` `#1a1824`, `--surface-strong` `#211d2d`, and `--surface-active` `#302442`.
- Lines: `--line` `#393447` and `--line-soft` `#24212e`.
- Text: `--ink` `#f4eff7`, `--muted` `#aaa2b8`, and contrast-safe `--quiet` `#9b94a8`.
- Violet accents: `--violet` `#c4a8ff` and `--violet-strong` `#a982ff`.
- Pink accents: `--pink` `#ff79a8` and `--pink-soft` `#ffc0d5`; reserve them for the `osu!` wordmark, high-value highlights, and short-lived active states.
- Semantic accents: `--gold` `#f7d66d`, `--green` `#7be3a1`, and `--danger` `#ff8ca1`.

All text must meet WCAG contrast requirements against its actual surface. Supporting text is tinted from the surrounding violet rather than neutral gray.

## Typography

Use a self-hosted characterful monospace for the introductory statement and numeric score accents. Use a self-hosted humanist sans for controls, body copy, and dense score metadata. Chinese text falls back to the platform CJK sans without forcing Latin display spacing onto it. Numeric tables use tabular figures.

## Geometry

Outlined circles, squares, and triangles appear at randomized positions, sizes, angles, and timings behind the content as a low-opacity rhythm field. Each spark relocates only after fading out; shapes behind text lose their glow, render at quarter strength, and are sometimes skipped. Large geometry may crop at the viewport edge, but must not create horizontal overflow.

## Motion

The signature motion is the pink `osu!` word: it carries a soft white glow at rest, enlarges on hover, and answers with the original 1.2-second beat-like one-pixel lift. Background geometry uses slow 4.5–8-second glimmer pulses and changes position only while invisible. Search focus may answer with one restrained pulse. With `prefers-reduced-motion`, all elements render in their settled state and no essential status relies on motion.

## Structure

The first viewport contains the compact header, the bilingual product statement, and the search instrument. Results replace the empty lower field without moving the search out of reach. Player identity leads, followed by a scan-friendly score list and a clearly separated export action. The layout is one-column on mobile and uses available width for score metadata on desktop rather than introducing a second navigation rail.

## Components

HeroUI v3 supplies accessible interactive primitives. Product styling is applied through shared tokens and a small number of semantic classes. Surfaces use either a border or elevation, not both. Major surfaces use 14–16px corners, controls use 8–10px, and compact tags or keycaps use 5–6px. Pills are reserved for compact modes, mods, and statuses.

On coarse pointers, interactive targets are at least 44px tall. Mobile score rows reflow rather than dropping grade, accuracy, combo, or pp.

## Browser Surfaces

Focus rings, text selection, caret, scrollbars, links, and disabled/loading/error/empty states all use the product palette. Keyboard focus remains visible on every control. The search shortcut is displayed only where a physical keyboard is likely.

Exported artwork follows the active interface language and uses the loaded Latin fonts with CJK-safe platform fallbacks.
