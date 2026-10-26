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

The tests cover query validation, KV cache semantics, global round-robin selection, credential cooldown/disable behavior, token reuse, and failover from a credential that receives an upstream 401.

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

The first deployment creates the `OsuGateway` SQLite-backed Durable Object through migration `v1`. The object serializes cache misses, persists the round-robin cursor and per-slot cooldown state, and keeps access tokens in memory only.

## Runtime behavior

- Full Best 50 responses are cached in KV for three minutes; Best 20 is sliced from the same entry.
- Missing players are cached briefly to reduce repeated upstream lookups.
- Site OAuth credentials rotate globally, not per Worker isolate.
- OAuth failures disable only the affected credential temporarily; upstream 401 and 429 responses move the request to another usable slot.
- Browser exports are generated locally and are never uploaded.

This is an unofficial fan-made project and is not affiliated with peppy or osu!.
