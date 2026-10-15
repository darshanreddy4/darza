import { test } from "node:test";
import assert from "node:assert/strict";
import { isSupportedVideoUrl } from "./video-url";

test("accepts YouTube, Vimeo and direct video files over https", () => {
  assert.ok(isSupportedVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
  assert.ok(isSupportedVideoUrl("https://youtu.be/dQw4w9WgXcQ"));
  assert.ok(isSupportedVideoUrl("https://vimeo.com/123456"));
  assert.ok(isSupportedVideoUrl("https://cdn.example.com/clip.mp4"));
});

test("rejects http, other sites, and non-URLs", () => {
  assert.equal(isSupportedVideoUrl("http://youtu.be/abc"), false);
  assert.equal(isSupportedVideoUrl("https://evil.example.com/page"), false);
  assert.equal(isSupportedVideoUrl("javascript:alert(1)"), false);
  assert.equal(isSupportedVideoUrl("not a url"), false);
});
