import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCacheKey, CacheService, type CacheStore } from "./cache.service";

function fakeStore(): CacheStore & { data: Map<string, string>; broken: boolean } {
  const data = new Map<string, string>();
  const s = {
    data,
    broken: false,
    async get(key: string) {
      if (s.broken) throw new Error("down");
      return data.get(key) ?? null;
    },
    async set(key: string, value: string) {
      if (s.broken) throw new Error("down");
      data.set(key, value);
    },
    async incr(key: string) {
      if (s.broken) throw new Error("down");
      const n = Number(data.get(key) ?? 0) + 1;
      data.set(key, String(n));
      return n;
    },
  };
  return s;
}

describe("buildCacheKey", () => {
  it("ignores field order and empty values", () => {
    assert.equal(
      buildCacheKey("1", "products", { page: 1, q: "tv", category: undefined, type: "" }),
      buildCacheKey("1", "products", { q: "tv", page: 1 }),
    );
  });

  it("differs by version, namespace and values", () => {
    const base = buildCacheKey("1", "products", { page: 1 });
    assert.notEqual(base, buildCacheKey("2", "products", { page: 1 }));
    assert.notEqual(base, buildCacheKey("1", "banners", { page: 1 }));
    assert.notEqual(base, buildCacheKey("1", "products", { page: 2 }));
  });
});

describe("CacheService", () => {
  it("runs the loader once and serves repeats from the cache", async () => {
    const cache = new CacheService(fakeStore());
    let calls = 0;
    const load = async () => ({ n: ++calls });
    assert.deepEqual(await cache.wrap("x", { a: 1 }, 30, load), { n: 1 });
    assert.deepEqual(await cache.wrap("x", { a: 1 }, 30, load), { n: 1 });
    assert.deepEqual(await cache.wrap("x", { a: 2 }, 30, load), { n: 2 });
  });

  it("invalidate makes the next read reload", async () => {
    const cache = new CacheService(fakeStore());
    let calls = 0;
    const load = async () => ++calls;
    await cache.wrap("x", {}, 30, load);
    await cache.invalidate();
    assert.equal(await cache.wrap("x", {}, 30, load), 2);
  });

  it("falls back to the loader when the store is down", async () => {
    const store = fakeStore();
    store.broken = true;
    const cache = new CacheService(store);
    assert.equal(await cache.wrap("x", {}, 30, async () => "fresh"), "fresh");
    await assert.doesNotReject(cache.invalidate());
  });

  it("does nothing without a store", async () => {
    const cache = new CacheService(null);
    assert.equal(cache.enabled, false);
    assert.equal(await cache.wrap("x", {}, 30, async () => 7), 7);
    await cache.invalidate();
  });
});
