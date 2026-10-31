# Raru Score

A clean rewrite of the osu! best-score viewer for Cloudflare Workers. The React application and Hono API ship as one Worker, while a Durable Object coordinates multiple server-side osu! OAuth clients globally.

## Stack

- Cloudflare Workers, Durable Objects, KV, Rate Limiting
- Vite, React 19, TypeScript
- Hono, HeroUI v3, Tailwind CSS v4
- Vitest with the Cloudflare Workers runtime

Node.js 22 or newer is required.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

`OSU_OAUTH_CREDENTIALS` is a JSON array. Credentials stay in the Worker runtime and must never use a `VITE_` prefix:

```dotenv
OSU_OAUTH_CREDENTIALS='[{"clientId":"12345","clientSecret":"secret-a"},{"clientId":"67890","clientSecret":"secret-b"}]'
```

The local site is served at `http://localhost:5173`.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The tests cover query validation, cache semantics, shared request budgets, credential rotation and cooldowns, failed-request accounting, image admission limits, and browser error/TTL handling.

## Cloudflare setup

1. Create a KV namespace:

   ```bash
   npx wrangler kv namespace create SCORE_CACHE
   ```

2. Replace the placeholder KV `id` in `wrangler.jsonc` with the returned ID.
3. Add the production OAuth pool as a secret:

   ```bash
   npx wrangler secret put OSU_OAUTH_CREDENTIALS
   ```

4. Deploy:

   ```bash
   npm run deploy
   ```

The first deployment creates the `OsuGateway` SQLite-backed Durable Object through migration `v1`. The object serializes cache misses, persists the shared upstream budget, round-robin cursor and cooldown state, and keeps access tokens in memory only.

## Request limits

| Scope                                                         | Limit                                       | Enforcement                                                       |
| ------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| osu! OAuth + API requests, all credentials combined           | 30 requests per rolling minute              | One global Durable Object; persisted before each outgoing request |
| Score endpoint, per IP (including cached and invalid queries) | 12 requests/minute                          | Cloudflare Rate Limiting binding                                  |
| Uncached score queries, per normalized player                 | 6 requests/minute                           | Cloudflare Rate Limiting binding                                  |
| Image endpoint, per IP (including cache hits)                 | 180 requests/minute                         | Separate Cloudflare Rate Limiting binding                         |
| Uncached image origin requests                                | 300 requests/minute per Cloudflare location | Shared image Rate Limiting binding                                |

`OSU_REQUESTS_PER_MINUTE` can lower the shared OAuth/API budget to 3–30; values above 30 are capped. The default is half the [osu! API usage guideline of 60 requests/minute](https://osu.ppy.sh/docs/index.html#terms-of-use). Adding OAuth credentials does not multiply this budget. Failed upstream requests count, and changing credentials or restarting the object does not reset the shared budget. Images use separate CDN endpoints and separate limits.

Cloudflare Rate Limiting bindings are [approximate and local to each Cloudflare location](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/); the upstream OAuth/API budget is coordinated globally. Admission rejections return `429`, while an exhausted upstream budget or full queue returns `503 UPSTREAM_BUSY`. Both include `Retry-After` and `Cache-Control: no-store`.

The gateway admits at most eight active/queued queries. When a queued query reaches the front after waiting ten seconds, it is rejected without contacting osu!. Upstream `429` responses pause **all** credentials for the supplied `Retry-After` (60 seconds if absent), including across restarts. Cached scores remain available subject to the per-IP limit.

## Runtime behavior

- Full Best 50 responses are cached in KV for three minutes; Best 20 is sliced from the same entry. The browser also fetches B50 once, so changing B20/B50 never makes another API request.
- Repeated submissions reuse fresh browser results; after expiry the same search or the refresh button fetches again. Browser freshness follows the server's remaining TTL rather than starting another three-minute window.
- Rate limits show a bilingual countdown and disable search/retry actions until the deadline. There are no automatic retries or reconnect refetches.
- Loading, results, errors, mode/count changes and language changes have short interruptible transitions. Loading skeletons and refresh indicators respect reduced-motion preferences; background decoration pauses offscreen or in hidden tabs. Transitions preserve input focus and ongoing exports.
- Missing players are cached briefly to reduce repeated upstream lookups.
- Site OAuth credentials rotate globally, not per Worker isolate.
- OAuth failures disable only the affected credential temporarily; upstream 401 responses can move the request to another usable slot within the shared budget. Upstream 429 responses stop the request and start a shared cooldown.
- Image cache keys ignore query strings, and image requests are limited before cache reads; cached images do not spend the image origin allowance.
- Browser exports are generated locally and are never uploaded.

This is an unofficial fan-made project and is not affiliated with peppy or osu!.
