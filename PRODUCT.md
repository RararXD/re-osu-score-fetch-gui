# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Cloudflare Workers, Vite, React, TypeScript, Hono, HeroUI v3, and Tailwind CSS v4. The application is a single deployable Worker project rather than separate frontend and backend services.

## Users

osu! players who want to check a player's strongest recent profile snapshot quickly, compare Best 20 or Best 50 scores across any ruleset, and save a shareable image without signing in.

## Product Purpose

Provide a fast, public, mobile-friendly view of an osu! player's best scores in all four rulesets, with a reliable browser-side B20/B50 image export. A successful lookup makes the player's performance legible at a glance and remains usable when upstream capacity is temporarily busy.

## Positioning

The product combines a compact score-reading interface with a purpose-built shareable B20/B50 export, while using globally coordinated server-side OAuth credential rotation to protect osu! API capacity.

## Operating Context

The tool is used between play sessions and in community sharing contexts. Visitors search by username or numeric user ID, optionally select a ruleset and Best 20/50, inspect results, and may download a PNG. Recent successful searches remain local to the browser.

## Capabilities and Constraints

- Support osu!, osu!taiko, osu!catch, and osu!mania, including the player's default ruleset.
- Query only best scores, returning at most 50.
- Show player identity and ruleset statistics plus score PP, accuracy, grade, mods, combo, base star rating, beatmap identity, and play time.
- Generate B20 and B50 PNG files entirely in the browser; exported images are not uploaded or persisted by the service.
- Use multiple server-owned osu! OAuth client credential pairs and rotate them globally.
- Keep credentials and tokens out of client bundles, API responses, and logs.
- Cache public score responses for three minutes and player-not-found responses briefly.
- Remain compatible with Cloudflare Workers deployment and its runtime APIs.
- Do not preserve the previous Python, FastAPI, ossapi, Docker, Nginx, filesystem-cache, visitor-tracking, or admin implementations.
- Visitor-provided OAuth credentials are not part of the first release.
- The new API does not promise compatibility with the previous API contract.

## Brand Commitments

The product is an unofficial, fan-made osu! score tool. It must not imply affiliation with osu! or peppy. Chinese and English are first-class interface languages. The implementation is a clean rewrite. The user explicitly wants to retain the previous product's recognizable rhythm geometry—outlined circles, squares, and triangles—and the animated pink `osu!` word in the introduction, while replacing the old component, layout, and styling code.

## Evidence on Hand

The previous repository at `/Users/cyqnew/Documents/GitHub/osu-score-fetch-GUI` provides behavioral evidence for score fields, four-ruleset lookup, Best 20/50 workflows, cache semantics, accessibility expectations, and browser-side export. Its source and styling are not implementation assets for this project. No testimonials, commercial claims, or official osu! endorsement assets are available and none may be fabricated.

## Product Principles

- Make the score hierarchy understandable before adding decoration.
- Treat upstream capacity as a shared resource and expose busy states honestly.
- Keep public lookup frictionless and credentials strictly server-side.
- Prefer Cloudflare-native primitives and one deployable application over inherited infrastructure.
- Preserve export reliability, responsive behavior, accessibility, and bilingual clarity as core functionality.

## Accessibility & Inclusion

Keyboard operation, visible focus, semantic controls, sufficient contrast, responsive layouts, reduced-motion behavior, and Chinese/English text resilience are required. Missing numeric data must be represented as unavailable rather than fabricated as zero.
