// Turns the plain background around a logo transparent, so it sits cleanly on the website.

export interface RawImage { data: Uint8Array; width: number; height: number }

const dist = (d: Uint8Array, i: number, r: number, g: number, b: number) => Math.hypot(d[i] - r, d[i + 1] - g, d[i + 2] - b);

// The background colour is the most common colour among the four corners (null when they all differ a lot).
export function backgroundColour(img: RawImage): [number, number, number] | null {
  const { data, width: w, height: h } = img;
  const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4];
  const solid = corners.filter((i) => data[i + 3] > 200);
  if (solid.length === 0) return null;
  for (const a of solid) {
    const same = solid.filter((b) => dist(data, b, data[a], data[a + 1], data[a + 2]) <= 24);
    if (same.length >= 2) return [data[a], data[a + 1], data[a + 2]];
  }
  return null;
}

// Pixels that look like the background and connect to the picture's edge become transparent (so a white inside a letter
// stays); the edge of what remains is softened so no pale halo is left. Returns how many pixels were cleared.
export function removeBackground(img: RawImage, tolerance: number): number {
  const { data, width: w, height: h } = img;
  const bg = backgroundColour(img);
  if (!bg) return 0;
  const [r, g, b] = bg;
  const total = w * h;
  const clear = new Uint8Array(total);
  const stack: number[] = [];

  const near = (p: number) => data[p * 4 + 3] < 10 || dist(data, p * 4, r, g, b) <= tolerance;
  const seed = (p: number) => { if (!clear[p] && near(p)) { clear[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }

  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (p >= w) seed(p - w);
    if (p < total - w) seed(p + w);
  }

  let cleared = 0;
  for (let p = 0; p < total; p++) {
    if (clear[p]) { data[p * 4 + 3] = 0; cleared++; }
  }
  // Soften the pixels touching the cleared area, the more background-like the more see-through.
  const soft = tolerance * 1.8;
  for (let p = 0; p < total; p++) {
    if (clear[p]) continue;
    const x = p % w;
    const touches = (x > 0 && clear[p - 1]) || (x < w - 1 && clear[p + 1]) || (p >= w && clear[p - w]) || (p < total - w && clear[p + w]);
    if (!touches) continue;
    const d = dist(data, p * 4, r, g, b);
    if (d < soft) data[p * 4 + 3] = Math.round(Math.min(1, Math.max(0, (d - tolerance) / (soft - tolerance))) * data[p * 4 + 3]);
  }
  return cleared;
}
