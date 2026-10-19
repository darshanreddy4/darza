import assert from "node:assert/strict";
import test from "node:test";
import { backgroundColour, removeBackground, type RawImage } from "./logo-background";

// A white picture with a black square in the middle and a white dot inside the square.
function sample(): RawImage {
  const w = 12, h = 12;
  const data = new Uint8Array(w * h * 4).fill(255);
  for (let y = 3; y < 9; y++) for (let x = 3; x < 9; x++) { const i = (y * w + x) * 4; data[i] = data[i + 1] = data[i + 2] = 0; }
  const dot = (5 * w + 5) * 4;
  data[dot] = data[dot + 1] = data[dot + 2] = 255;
  return { data, width: w, height: h };
}
const alpha = (img: RawImage, x: number, y: number) => img.data[(y * img.width + x) * 4 + 3];

test("the background colour is read from the corners", () => {
  assert.deepEqual(backgroundColour(sample()), [255, 255, 255]);
});

test("the outside turns transparent but a white inside the logo stays", () => {
  const img = sample();
  const cleared = removeBackground(img, 40);
  assert.equal(alpha(img, 0, 0), 0);
  assert.equal(alpha(img, 11, 11), 0);
  assert.equal(alpha(img, 4, 4), 255);
  assert.equal(alpha(img, 5, 5), 255);
  assert.equal(cleared, 144 - 36);
});

test("nothing is removed when the corners disagree", () => {
  const img = sample();
  img.data.set([255, 0, 0, 255], 0);
  img.data.set([0, 255, 0, 255], (img.width - 1) * 4);
  img.data.set([0, 0, 255, 255], (img.height - 1) * img.width * 4);
  img.data.set([0, 0, 0, 255], ((img.height - 1) * img.width + img.width - 1) * 4);
  assert.equal(removeBackground(img, 40), 0);
});

test("a picture that is already transparent is left alone", () => {
  const img = sample();
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = 0;
  assert.equal(removeBackground(img, 40), 0);
});
