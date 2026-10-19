// A short party blast over the page: confetti from both bottom corners and the top middle. Skipped for visitors who ask for less motion.
const COLORS = ["#12b886", "#f5b942", "#ff6b6b", "#4dabf7", "#845ef7", "#ff922b", "#ffffff"];
const DURATION_MS = 2800;

interface Piece { x: number; y: number; vx: number; vy: number; size: number; angle: number; spin: number; color: string; round: boolean }

export function celebrate() {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "9999" });
  const ratio = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(ratio, ratio);
  document.body.appendChild(canvas);

  const pieces: Piece[] = [];
  const burst = (x: number, y: number, count: number, from: number, to: number, speed: number) => {
    for (let i = 0; i < count; i++) {
      const direction = from + Math.random() * (to - from);
      const power = speed * (0.55 + Math.random() * 0.6);
      pieces.push({
        x, y, vx: Math.cos(direction) * power, vy: Math.sin(direction) * power, size: 6 + Math.random() * 7, angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.4, color: COLORS[Math.floor(Math.random() * COLORS.length)], round: Math.random() < 0.3,
      });
    }
  };
  const deg = (d: number) => (d * Math.PI) / 180;
  burst(0, height, 70, deg(-80), deg(-35), 19);
  burst(width, height, 70, deg(-145), deg(-100), 19);
  burst(width / 2, height * 0.25, 60, deg(-180), deg(0), 11);

  const started = performance.now();
  const frame = (now: number) => {
    const elapsed = now - started;
    ctx.clearRect(0, 0, width, height);
    const fade = elapsed > DURATION_MS - 700 ? Math.max(0, (DURATION_MS - elapsed) / 700) : 1;
    for (const p of pieces) {
      p.vy += 0.38;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (elapsed < DURATION_MS) requestAnimationFrame(frame); else canvas.remove();
  };
  requestAnimationFrame(frame);
}
