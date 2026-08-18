import { LAYOUT } from "./lines.js";

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function nearPoint(x, z, tx, tz, r) {
  return dist2(x, z, tx, tz) <= r * r;
}

export function insideAABB(x, z, box) {
  return x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ;
}

export function zoneAt(x, z) {
  if (insideAABB(x, z, LAYOUT.field)) return "field";
  if (insideAABB(x, z, LAYOUT.plaza)) return "plaza";
  return x >= LAYOUT.field.minX ? "field" : "plaza";
}

/** Keep the hero on the plaza, or the plaza+field once the gate is open. */
export function clampToWalkable(x, z, fieldOpen = false) {
  const minX = LAYOUT.plaza.minX + 1.2;
  if (!fieldOpen) {
    return {
      x: clamp(x, minX, LAYOUT.gate.x - 0.85),
      z: clamp(z, LAYOUT.plaza.minZ + 1.4, LAYOUT.plaza.maxZ - 1.4),
    };
  }
  const inField = x >= LAYOUT.plaza.maxX - 2;
  const maxX = LAYOUT.field.maxX - 1.4;
  const minZ = inField ? LAYOUT.field.minZ + 1.6 : LAYOUT.plaza.minZ + 1.4;
  const maxZ = inField ? LAYOUT.field.maxZ - 1.6 : LAYOUT.plaza.maxZ - 1.4;
  return { x: clamp(x, minX, maxX), z: clamp(z, minZ, maxZ) };
}

/**
 * Push a circle on XZ out of an AABB collider.
 * Collider: { minX, maxX, minZ, maxZ }
 */
export function resolveCircleAABB(px, pz, radius, box) {
  const cx = clamp(px, box.minX, box.maxX);
  const cz = clamp(pz, box.minZ, box.maxZ);
  let dx = px - cx;
  let dz = pz - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radius * radius) return { x: px, z: pz, hit: false };
  if (d2 < 1e-8) {
    const left = px - box.minX;
    const right = box.maxX - px;
    const down = pz - box.minZ;
    const up = box.maxZ - pz;
    const m = Math.min(left, right, down, up);
    if (m === left) return { x: box.minX - radius, z: pz, hit: true };
    if (m === right) return { x: box.maxX + radius, z: pz, hit: true };
    if (m === down) return { x: px, z: box.minZ - radius, hit: true };
    return { x: px, z: box.maxZ + radius, hit: true };
  }
  const d = Math.sqrt(d2);
  const k = radius / d;
  return { x: cx + dx * k, z: cz + dz * k, hit: true };
}

export function resolveWorld(px, pz, radius, colliders, fieldOpen = false) {
  let x = px;
  let z = pz;
  for (let i = 0; i < colliders.length; i++) {
    if (colliders[i].disabled) continue;
    const r = resolveCircleAABB(x, z, radius, colliders[i]);
    x = r.x;
    z = r.z;
  }
  const w = clampToWalkable(x, z, fieldOpen);
  return { x: w.x, z: w.z };
}

export function segmentHitsAABB(ax, az, bx, bz, box, radius = 0.2) {
  const mx = (ax + bx) * 0.5;
  const mz = (az + bz) * 0.5;
  const hx = Math.abs(bx - ax) * 0.5 + radius;
  const hz = Math.abs(bz - az) * 0.5 + radius;
  const cx = (box.minX + box.maxX) * 0.5;
  const cz = (box.minZ + box.maxZ) * 0.5;
  const ex = (box.maxX - box.minX) * 0.5;
  const ez = (box.maxZ - box.minZ) * 0.5;
  return Math.abs(mx - cx) <= hx + ex && Math.abs(mz - cz) <= hz + ez;
}

export function canWalkPlazaToField(fieldOpen) {
  const start = LAYOUT.spawn;
  const end = { x: LAYOUT.elon.x, z: LAYOUT.elon.z };
  const connected = zoneAt(start.x, start.z) === "plaza" && zoneAt(end.x, end.z) === "field";
  if (!fieldOpen) {
    const blocked = clampToWalkable(LAYOUT.gate.x + 2, 0, false).x < LAYOUT.gate.x;
    return connected && blocked;
  }
  const freed = clampToWalkable(LAYOUT.elon.x, LAYOUT.elon.z, true);
  return connected && Math.abs(freed.x - LAYOUT.elon.x) < 0.01;
}
