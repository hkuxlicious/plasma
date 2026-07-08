/**
 * Plasma paint primitives for the canvas underlay beneath the Web lens.
 *
 * Discipline rule (see IMPROVEMENTS.md): every effect encodes data.
 * - Glow radius/alpha = heat (real Codex invocations x recency).
 * - Filament brightness = relationship strength; energized = selection.
 * - Strikes = activation events (selection discharge, mission lightning).
 *
 * Everything is Canvas 2D with additive compositing — no dependencies.
 */

const rgbCache = new Map();

export function hexToRgb(hex = "#8cf4ff") {
  let rgb = rgbCache.get(hex);
  if (!rgb) {
    const value = hex.replace("#", "");
    const n = parseInt(value.length === 3 ? value.replace(/./g, "$&$&") : value, 16);
    rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
    rgbCache.set(hex, rgb);
  }
  return rgb;
}

/** Cheap deterministic pseudo-noise in [0,1). */
export function noise(seed) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function drawGlow(ctx, x, y, radius, rgb, alpha) {
  if (alpha <= 0.004 || radius <= 1) return;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${rgb},${alpha.toFixed(3)})`);
  gradient.addColorStop(0.45, `rgba(${rgb},${(alpha * 0.4).toFixed(3)})`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A living filament between two points: sinusoidal drift plus optional
 * re-rolling jitter for crackle. `time` frozen (0) = static rendering for
 * prefers-reduced-motion.
 */
export function drawFilament(ctx, ax, ay, bx, by, opts) {
  const { rgb, alpha, amp = 0, phase = 0, time = 0, segments = 12, jitter = 0, width = 1 } = opts;
  if (alpha <= 0.004) return;
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  if (length < 2) return;
  const nx = -dy / length;
  const ny = dx / length;

  ctx.strokeStyle = `rgba(${rgb},${alpha.toFixed(3)})`;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const envelope = Math.sin(t * Math.PI);
    const wave = amp * envelope * Math.sin(time * 1.7 + phase + t * 4.2);
    const jag = jitter
      ? (noise(phase * 97 + i * 7.3 + Math.floor(time * 14)) - 0.5) * jitter * envelope
      : 0;
    const px = ax + dx * t + nx * (wave + jag);
    const py = ay + dy * t + ny * (wave + jag);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

/**
 * A plasma-globe tendril: a wandering filament from the core to a node with
 * an optional side branch, drawn as violet sheath + bright inner core —
 * the two-pass look of a real discharge.
 */
export function drawTendril(ctx, ax, ay, bx, by, opts) {
  const {
    sheathRgb = "168,112,255",
    coreRgb = "235,250,255",
    alpha,
    amp,
    phase,
    time,
    jitter = 0,
    width = 1,
    branch = false
  } = opts;
  if (alpha <= 0.004) return;

  // Slow flicker per tendril, like a discharge finding its path.
  const flicker = 0.65 + 0.35 * noise(phase * 13.7 + Math.floor(time * 2.6));
  const a = alpha * flicker;

  const common = { amp, phase, time, jitter, segments: 14 };
  drawFilament(ctx, ax, ay, bx, by, { ...common, rgb: sheathRgb, alpha: a * 0.55, width: width * 2.4 });
  drawFilament(ctx, ax, ay, bx, by, { ...common, rgb: coreRgb, alpha: a, width });

  if (branch) {
    const t = 0.5 + noise(phase * 3.1) * 0.3;
    const px = ax + (bx - ax) * t;
    const py = ay + (by - ay) * t;
    const baseAngle = Math.atan2(by - ay, bx - ax);
    const angle = baseAngle + (noise(phase * 7.7 + Math.floor(time * 1.4)) - 0.5) * 1.9;
    const length = Math.hypot(bx - ax, by - ay) * (0.16 + noise(phase * 11.3) * 0.16);
    const ex = px + Math.cos(angle) * length;
    const ey = py + Math.sin(angle) * length;
    drawFilament(ctx, px, py, ex, ey, {
      ...common,
      segments: 8,
      amp: amp * 0.5,
      rgb: sheathRgb,
      alpha: a * 0.4,
      width: width * 1.4
    });
    drawFilament(ctx, px, py, ex, ey, {
      ...common,
      segments: 8,
      amp: amp * 0.5,
      rgb: coreRgb,
      alpha: a * 0.55,
      width: width * 0.7
    });
  }
}

/**
 * Soft glow sprite, pre-rendered once per colour. Stamping overlapping
 * sprites along a path merges into a continuous luminous veil with no
 * visible strokes — the aurora-from-space look.
 */
const spriteCache = new Map();

export function getGlowSprite(rgb) {
  let sprite = spriteCache.get(rgb);
  if (!sprite) {
    sprite = document.createElement("canvas");
    sprite.width = 64;
    sprite.height = 64;
    const ctx = sprite.getContext("2d");
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, `rgba(${rgb},0.35)`);
    gradient.addColorStop(0.45, `rgba(${rgb},0.12)`);
    gradient.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    spriteCache.set(rgb, sprite);
  }
  return sprite;
}

function stampSprite(ctx, sprite, x, y, radius, alpha) {
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

/**
 * Aurora veil wrapped around the 3D globe — the auroral oval as seen from
 * space, not the ground-observer curtain view. A wavy latitude ring on the
 * unit sphere is projected through the caller's `project({x,y,z}) ->
 * {x,y,z}` so the veil follows the sphere's curvature and rotates with it.
 * Three stamped layers per point: surface band, taller outward veil, and a
 * pink fringe on the equator side (green-over-pink, like the real thing).
 */
export function drawAuroraVeil(ctx, opts) {
  const {
    project,
    radius,
    center,
    lat = 1.1,
    points = 84,
    time = 0,
    speed = 1,
    phase = 0,
    waveAmp = 0.07,
    mainRgb = "110,255,200",
    fringeRgb = "255,110,190",
    alpha = 0.16
  } = opts;
  const [cx, cy] = center;
  const mainSprite = getGlowSprite(mainRgb);
  const fringeSprite = getGlowSprite(fringeRgb);
  const tau = Math.PI * 2;

  for (let i = 0; i < points; i += 1) {
    const f = i / points;
    // The whole oval drifts slowly around the pole; its edge undulates with
    // two counter-moving wave octaves, like the real auroral oval.
    const angle = f * tau + time * 0.03 * speed;
    const wobble =
      Math.sin(f * tau * 3 + time * 0.45 * speed + phase) * waveAmp +
      Math.sin(f * tau * 5 - time * 0.27 * speed + phase * 2) * waveAmp * 0.5;
    const latHere = lat + wobble;
    const y = Math.sin(latHere);
    const ring = Math.cos(latHere);
    const p = project({ x: Math.cos(angle) * ring, y, z: Math.sin(angle) * ring });

    const depth = (p.z + 1) / 2;
    const depthAlpha = 0.15 + 0.85 * Math.pow(depth, 1.4);
    // Brightness patches that drift along the band.
    const density =
      0.4 +
      0.6 *
        (0.5 + 0.5 * Math.sin(f * tau * 2 + time * 0.3 * speed + phase * 3)) *
        (0.5 + 0.5 * noise(i * 3.7 + phase * 17));
    const a = alpha * depthAlpha * density;
    if (a < 0.004) continue;

    const size = radius * (0.09 + 0.1 * density);
    stampSprite(ctx, mainSprite, p.x, p.y, size, a);
    stampSprite(ctx, mainSprite, p.x + (p.x - cx) * 0.07, p.y + (p.y - cy) * 0.07, size * 1.7, a * 0.35);
    stampSprite(ctx, fringeSprite, p.x - (p.x - cx) * 0.05, p.y - (p.y - cy) * 0.05, size * 1.25, a * 0.45);
  }
}

const STRIKE_LIFE_MS = 750;

/** Returns false when the strike is spent and should be removed. */
export function drawStrike(ctx, ax, ay, bx, by, rgb, ageMs, scale) {
  if (ageMs < 0) return true; // staggered start
  const life = ageMs / STRIKE_LIFE_MS;
  if (life >= 1) return false;
  const alpha = life < 0.18 ? 0.85 : 0.85 * (1 - (life - 0.18) / 0.82);
  const jitter = 13 * scale;
  const seedTime = life * 9;
  drawFilament(ctx, ax, ay, bx, by, {
    rgb,
    alpha: alpha * 0.7,
    phase: ax * 0.01 + by * 0.013,
    time: seedTime,
    jitter,
    width: 1.7 * scale,
    segments: 15
  });
  drawFilament(ctx, ax, ay, bx, by, {
    rgb: "235,252,255",
    alpha: alpha * 0.75,
    phase: ax * 0.011 + by * 0.017,
    time: seedTime,
    jitter: jitter * 0.7,
    width: 0.8 * scale,
    segments: 15
  });
  return true;
}

export { STRIKE_LIFE_MS };
