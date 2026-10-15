import { Global, Logger, Module } from "@nestjs/common";
import { createHash } from "crypto";
import Redis from "ioredis";

// The few Redis commands the cache needs; a tiny fake implements this in tests.
export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  incr(key: string): Promise<number>;
}

const VERSION_KEY = "dmg:cache-version";

// Same inputs always give the same key, whatever order the fields were written in.
export function buildCacheKey(version: string, namespace: string, parts: Record<string, unknown> = {}): string {
  const stable = Object.keys(parts)
    .filter((k) => parts[k] !== undefined && parts[k] !== null && parts[k] !== "")
    .sort()
    .map((k) => `${k}=${String(parts[k])}`)
    .join("&");
  const digest = createHash("sha1").update(stable).digest("hex").slice(0, 16);
  return `dmg:v${version}:${namespace}:${digest}`;
}

/**
 * Read-through cache for public, read-heavy responses. Invalidation bumps one
 * global version number, which orphans every older key at once (they expire by TTL).
 * Without a store, or when Redis is down, every call simply runs the loader, so the
 * site works the same, only slower.
 */
export class CacheService {
  private readonly logger = new Logger("Cache");
  private lastWarn = 0;

  constructor(private readonly store: CacheStore | null) {}

  get enabled() {
    return this.store !== null;
  }

  async wrap<T>(namespace: string, parts: Record<string, unknown>, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    if (!this.store) return loader();
    let key: string;
    try {
      key = buildCacheKey((await this.store.get(VERSION_KEY)) ?? "0", namespace, parts);
      const hit = await this.store.get(key);
      if (hit !== null) return JSON.parse(hit) as T;
    } catch (e) {
      this.warn(e);
      return loader();
    }
    const value = await loader();
    try {
      await this.store.set(key, JSON.stringify(value), ttlSeconds);
    } catch (e) {
      this.warn(e);
    }
    return value;
  }

  // Call after anything that changes what shoppers see. Never throws.
  async invalidate(): Promise<void> {
    if (!this.store) return;
    try {
      await this.store.incr(VERSION_KEY);
    } catch (e) {
      this.warn(e);
    }
  }

  private warn(e: unknown) {
    const now = Date.now();
    if (now - this.lastWarn < 30_000) return;
    this.lastWarn = now;
    this.logger.warn(`Cache unavailable, serving uncached: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function redisStore(url: string): CacheStore {
  const client = new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 1_000, commandTimeout: 500 });
  client.on("error", () => {});
  return {
    get: (key) => client.get(key),
    set: async (key, value, ttl) => void (await client.set(key, value, "EX", ttl)),
    incr: (key) => client.incr(key),
  };
}

@Global()
@Module({
  providers: [{ provide: CacheService, useFactory: () => new CacheService(process.env.REDIS_URL ? redisStore(process.env.REDIS_URL) : null) }],
  exports: [CacheService],
})
export class CacheModule {}
