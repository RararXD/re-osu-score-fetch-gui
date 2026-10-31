export interface Env {
  SCORE_CACHE: KVNamespace;
  OSU_GATEWAY: DurableObjectNamespace;
  IP_RATE_LIMITER: RateLimit;
  PLAYER_RATE_LIMITER: RateLimit;
  ASSET_IP_RATE_LIMITER: RateLimit;
  ASSET_UPSTREAM_RATE_LIMITER: RateLimit;
  OSU_OAUTH_CREDENTIALS?: string;
  OSU_REQUESTS_PER_MINUTE?: string;
}
