import test from "node:test";
import assert from "node:assert/strict";
import { isBannerVideoUrl, youtubeId } from "./banner-video";

test("accepts uploaded files, https files and YouTube links", () => {
  assert.ok(isBannerVideoUrl("/uploads/abc123.mp4"));
  assert.ok(isBannerVideoUrl("https://cdn.example.com/ad.webm?x=1"));
  assert.ok(isBannerVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
  assert.ok(isBannerVideoUrl("https://youtu.be/dQw4w9WgXcQ?t=5"));
  assert.ok(isBannerVideoUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ"));
});

test("rejects other hosts, http and scripts", () => {
  assert.equal(isBannerVideoUrl("http://youtu.be/dQw4w9WgXcQ"), false);
  assert.equal(isBannerVideoUrl("https://evil.example.com/watch?v=dQw4w9WgXcQ"), false);
  assert.equal(isBannerVideoUrl("https://vimeo.com/123456"), false);
  assert.equal(isBannerVideoUrl("javascript:alert(1)"), false);
  assert.equal(isBannerVideoUrl("https://www.youtube.com/watch"), false);
});

test("extracts the video id", () => {
  assert.equal(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=x"), "dQw4w9WgXcQ");
});
