import type { Context } from "hono";
import { Hono } from "hono";
import type { Env } from "../env";
import { ApiError } from "../services/errors";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const assetRoutes = new Hono<{ Bindings: Env }>()
  .use("*", async (c, next) => {
    const ip = c.req.header("CF-Connecting-IP") ?? "local-development";
    const result = await c.env.ASSET_IP_RATE_LIMITER.limit({ key: ip });
    if (!result.success) {
      throw new ApiError(429, "RATE_LIMITED", "图片请求过于频繁，请稍后重试。", 60);
    }
    await next();
  })
  .get("/avatar/:userId", async (c) => {
    const userId = positiveInteger(c.req.param("userId"));
    return proxyImage(c, `https://a.ppy.sh/${userId}`, 86_400);
  })
  .get("/cover/:beatmapsetId", async (c) => {
    const beatmapsetId = positiveInteger(c.req.param("beatmapsetId"));
    return proxyImage(
      c,
      `https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers/list@2x.jpg`,
      2_592_000,
    );
  });

function positiveInteger(value: string): string {
  if (!/^[1-9]\d*$/u.test(value)) {
    throw new ApiError(422, "INVALID_REQUEST", "图片资源 ID 无效。");
  }
  return value;
}

async function proxyImage(
  c: Context<{ Bindings: Env }>,
  upstreamUrl: string,
  maxAge: number,
): Promise<Response> {
  const cache = await caches.open("raru-images-v1");
  const cacheUrl = new URL(c.req.url);
  cacheUrl.search = "";
  const cacheKey = new Request(cacheUrl, { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) {
    const response = new Response(cached.body, cached);
    response.headers.set("X-Cache", "HIT");
    return response;
  }

  const allowance = await c.env.ASSET_UPSTREAM_RATE_LIMITER.limit({ key: "images" });
  if (!allowance.success) {
    throw new ApiError(429, "RATE_LIMITED", "图片服务繁忙，请稍后重试。", 60);
  }

  const upstream = await fetch(upstreamUrl, {
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  const mediaType = upstream.headers.get("Content-Type")?.split(";", 1)[0]?.trim() ?? "";
  const contentLength = Number(upstream.headers.get("Content-Length"));
  if (
    !upstream.ok ||
    !IMAGE_TYPES.has(mediaType) ||
    (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES)
  ) {
    upstream.body?.cancel();
    throw new ApiError(502, "IMAGE_UNAVAILABLE", "头像或曲绘暂时无法加载。");
  }

  const headers = new Headers({
    "Cache-Control": `public, max-age=${maxAge}`,
    "Content-Type": mediaType,
    "X-Cache": "MISS",
    "X-Content-Type-Options": "nosniff",
  });
  const etag = upstream.headers.get("ETag");
  if (etag) headers.set("ETag", etag);
  const response = new Response(upstream.body, { status: 200, headers });
  c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
