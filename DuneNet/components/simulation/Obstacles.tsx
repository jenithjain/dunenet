'use client';

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gridToWorld } from './utils/costmapLoader';

interface ObstaclesProps {
  costmapData: number[][] | null;
  costmapWidth?: number;
  costmapHeight?: number;
  worldSize?: number;
  terrainSegments?: number;
  /** overall density multiplier 0–2 (1 = default) */
  densityScale?: number;
}

/* Must match Terrain.tsx & Scene.tsx getTerrainHeight exactly */
function getTerrainHeight(
  noise2D: ReturnType<typeof createNoise2D>,
  x: number,
  z: number,
  worldSize: number,
) {
  let h = 0;
  h += noise2D(x * 0.0025, z * 0.0025) * 2.2;
  h += noise2D(x * 0.008, z * 0.008) * 1.1;
  h += noise2D(x * 0.03, z * 0.03) * 0.6;
  h += noise2D(x * 0.12, z * 0.12) * 0.22;

  const slope = (z / (worldSize * 0.5)) * 1.4;
  h += slope;

  const dist = Math.sqrt(x * x + z * z) / (worldSize * 0.5);
  const falloff = Math.max(0, 1 - dist * dist * 0.55);
  return h * falloff;
}

function getTerrainSlope(
  noise2D: ReturnType<typeof createNoise2D>,
  x: number,
  z: number,
  worldSize: number,
) {
  const eps = 1.5;
  const hL = getTerrainHeight(noise2D, x - eps, z, worldSize);
  const hR = getTerrainHeight(noise2D, x + eps, z, worldSize);
  const hD = getTerrainHeight(noise2D, x, z - eps, worldSize);
  const hU = getTerrainHeight(noise2D, x, z + eps, worldSize);
  const dx = (hR - hL) / (2 * eps);
  const dz = (hU - hD) / (2 * eps);
  return Math.min(1, Math.sqrt(dx * dx + dz * dz));
}

// ─── Procedural geometry builders (photorealistic detail) ──────

/**
 * High-detail sandstone boulder — subdivision 3 icosahedron with
 * multi-octave noise displacement, Y-flattening, and erosion grooves.
 */
function createRockGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 3); // 162 verts – smoother
  const pos = geo.attributes.position;
  const noise = createNoise2D(() => 0.42);
  const erosion = createNoise2D(() => 0.91);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // Multi-octave craggy displacement
    const d =
      noise(x * 1.2 + y * 0.5, z * 1.2 + y * 0.2) * 0.22 +
      noise(x * 2.4, z * 2.4 + y) * 0.12 +
      noise(x * 5.0 + z, z * 5.0) * 0.06 +
      noise(x * 10.0, z * 10.0 + y * 2) * 0.025;

    // Erosion grooves — horizontal striations like sandstone layers
    const layerNoise = erosion(y * 8.0 + x * 0.3, z * 0.3) * 0.04;

    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    pos.setXYZ(
      i,
      x + (x / len) * (d + layerNoise),
      (y + (y / len) * (d + layerNoise)) * 0.55,
      z + (z / len) * (d + layerNoise),
    );
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Photorealistic Saguaro cactus — high radial segments with procedural
 * rib displacement, spines implied by normal variation, organic taper.
 */
function createCactusGeometry(): THREE.BufferGeometry {
  const r = 16;
  const hSeg = 8;

  // Main trunk – tapered cylinder
  const trunk = new THREE.CylinderGeometry(0.09, 0.16, 1.8, r, hSeg, true);
  applyCactusRibs(trunk, r, 0.012);
  trunk.translate(0, 0.9, 0);

  // Dome cap on trunk
  const cap = new THREE.SphereGeometry(0.09, r, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  cap.translate(0, 1.8, 0);

  // Left arm — curved upward
  const armL1 = new THREE.CylinderGeometry(0.055, 0.07, 0.45, r, 4, true);
  applyCactusRibs(armL1, r, 0.008);
  armL1.translate(0, 0.225, 0);
  const mL1 = new THREE.Matrix4()
    .makeRotationZ(Math.PI / 3)
    .setPosition(-0.16, 1.0, 0);
  armL1.applyMatrix4(mL1);

  const armL2 = new THREE.CylinderGeometry(0.045, 0.055, 0.45, r, 4, true);
  applyCactusRibs(armL2, r, 0.006);
  armL2.translate(-0.38, 1.38, 0);

  const armLC = new THREE.SphereGeometry(0.045, r, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  armLC.translate(-0.38, 1.6, 0);

  const elbowL = new THREE.SphereGeometry(0.058, 8, 8);
  elbowL.translate(-0.37, 1.16, 0);

  // Right arm
  const armR1 = new THREE.CylinderGeometry(0.05, 0.065, 0.35, r, 4, true);
  applyCactusRibs(armR1, r, 0.007);
  armR1.translate(0, 0.175, 0);
  const mR = new THREE.Matrix4()
    .makeRotationZ(-Math.PI / 3.5)
    .setPosition(0.14, 0.72, 0);
  armR1.applyMatrix4(mR);

  const armR2 = new THREE.CylinderGeometry(0.04, 0.05, 0.3, r, 3, true);
  applyCactusRibs(armR2, r, 0.005);
  armR2.translate(0.33, 1.02, 0);

  const armRC = new THREE.SphereGeometry(0.04, r, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  armRC.translate(0.33, 1.17, 0);

  const elbowR = new THREE.SphereGeometry(0.052, 8, 8);
  elbowR.translate(0.32, 0.87, 0);

  const parts = [trunk, cap, armL1, armL2, armLC, elbowL, armR1, armR2, armRC, elbowR];
  const merged = mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g));
  if (!merged) return trunk;
  merged.computeVertexNormals();
  return merged;
}

/** Apply subtle radial rib displacement to a cylinder geometry */
function applyCactusRibs(geo: THREE.BufferGeometry, radialSegs: number, depth: number) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const angle = Math.atan2(z, x);
    const ribFactor = Math.sin(angle * radialSegs * 0.5) * depth;
    const len = Math.sqrt(x * x + z * z) || 1;
    pos.setXYZ(i, x + (x / len) * ribFactor, y, z + (z / len) * ribFactor);
  }
}

/**
 * Barrel cactus — proper ribbed cylinder with dome top and spine nodules.
 * No sphere blobs — all geometry is cylindrical/conical so ribs are prominent.
 */
function createBarrelCactusGeometry(): THREE.BufferGeometry {
  const RSEGS = 24; // must be divisible for clean ribs
  const HSEGS = 10;
  const RIB_DEPTH = 0.045;

  // Main cylindrical body (open, capped separately for cleaner normals)
  const body = new THREE.CylinderGeometry(0.19, 0.24, 0.58, RSEGS, HSEGS, true);
  // Deep prominent ribs
  const bPos = body.attributes.position;
  for (let i = 0; i < bPos.count; i++) {
    const x = bPos.getX(i);
    const y = bPos.getY(i);
    const z = bPos.getZ(i);
    const angle = Math.atan2(z, x);
    // 12 ribs with sharp sine ridges
    const rib = Math.sin(angle * 12) * RIB_DEPTH;
    // Ribs tighten near top (natural barrel taper)
    const yNorm = (y + 0.29) / 0.58;
    const taperRib = rib * (1.0 - yNorm * 0.3);
    const len = Math.sqrt(x * x + z * z) || 1;
    bPos.setXYZ(i, x + (x / len) * taperRib, y, z + (z / len) * taperRib);
  }

  // Dome top — shallow hemisphere, NOT a full sphere
  const dome = new THREE.SphereGeometry(0.195, RSEGS, 6, 0, Math.PI * 2, 0, Math.PI * 0.42);
  const dPos = dome.attributes.position;
  for (let i = 0; i < dPos.count; i++) {
    const x = dPos.getX(i);
    const z = dPos.getZ(i);
    const angle = Math.atan2(z, x);
    const rib = Math.sin(angle * 12) * RIB_DEPTH * 0.7;
    const len = Math.sqrt(x * x + z * z) || 1;
    dPos.setXYZ(i, x + (x / len) * rib, dPos.getY(i), z + (z / len) * rib);
  }
  dome.translate(0, 0.29, 0);

  // Flat bottom disc
  const bottom = new THREE.CircleGeometry(0.24, RSEGS);
  bottom.rotateX(-Math.PI / 2);
  bottom.translate(0, -0.29, 0);

  // Spine nodule rows — tiny flat discs along each rib ridge
  const spineGeos: THREE.BufferGeometry[] = [];
  const RIB_COUNT = 12;
  const SPINE_ROWS = 5;
  for (let rib = 0; rib < RIB_COUNT; rib++) {
    const ribAngle = (rib / RIB_COUNT) * Math.PI * 2;
    for (let row = 0; row < SPINE_ROWS; row++) {
      const yPos = -0.22 + (row / (SPINE_ROWS - 1)) * 0.44;
      const yNorm = (yPos + 0.29) / 0.58;
      const r = 0.19 + RIB_DEPTH * (1.0 - yNorm * 0.3); // sit on rib surface
      const spine = new THREE.CylinderGeometry(0.006, 0.009, 0.03, 4, 1);
      spine.rotateX(Math.PI / 2);
      spine.translate(
        Math.cos(ribAngle) * r,
        yPos,
        Math.sin(ribAngle) * r,
      );
      const sm = new THREE.Matrix4().makeRotationY(ribAngle);
      spine.applyMatrix4(sm);
      spineGeos.push(spine);
    }
  }
  const spines = mergeGeometries(spineGeos.map(g => g.index ? g.toNonIndexed() : g));

  const parts: THREE.BufferGeometry[] = [body, dome, bottom];
  if (spines) parts.push(spines);
  const merged = mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g));
  if (!merged) return body;
  merged.computeVertexNormals();
  return merged;
}

/**
 * Dry desert scrub — thin woody branching structure, zero blobs.
 * Main branches fan out from base, each with several sub-twigs and bud tips.
 */
function createBushGeometry(): THREE.BufferGeometry {
  const noise = createNoise2D(() => 0.73);
  const parts: THREE.BufferGeometry[] = [];

  // Thick base stump
  const stump = new THREE.CylinderGeometry(0.035, 0.055, 0.12, 6, 1);
  stump.translate(0, 0.06, 0);
  parts.push(stump);

  const MAIN_BRANCHES = 8;
  for (let i = 0; i < MAIN_BRANCHES; i++) {
    const a = (i / MAIN_BRANCHES) * Math.PI * 2;
    // Main branch length varies 0.45 – 0.80
    const bl = 0.45 + Math.abs(Math.sin(i * 1.7)) * 0.35;
    // Lean angle: spread outward strongly
    const leanZ = 0.55 + Math.abs(Math.sin(i * 0.9)) * 0.32;

    const branch = new THREE.CylinderGeometry(0.006, 0.018, bl, 4, 3);
    // Bend: displace upper verts outward
    const bPos = branch.attributes.position;
    for (let v = 0; v < bPos.count; v++) {
      const yv = bPos.getY(v); // range -bl/2..bl/2
      const norm = (yv + bl * 0.5) / bl; // 0 at base, 1 at tip
      const bow = Math.pow(norm, 2.2) * 0.08;
      bPos.setX(v, bPos.getX(v) + bow * Math.cos(a));
      bPos.setZ(v, bPos.getZ(v) + bow * Math.sin(a));
    }
    branch.translate(0, bl * 0.5, 0);
    const bm = new THREE.Matrix4()
      .makeRotationY(a)
      .multiply(new THREE.Matrix4().makeRotationZ(leanZ));
    bm.setPosition(Math.cos(a) * 0.04, 0.10, Math.sin(a) * 0.04);
    branch.applyMatrix4(bm);
    parts.push(branch);

    // 3–4 sub-twigs from upper half of each main branch
    const SUB = 3 + (i % 2);
    for (let j = 0; j < SUB; j++) {
      const ta = a + (j / SUB - 0.5) * 1.4;
      const tl = 0.14 + Math.abs(Math.sin(i * 2.3 + j)) * 0.12;
      const twig = new THREE.CylinderGeometry(0.003, 0.009, tl, 3, 1);
      twig.translate(0, tl * 0.5, 0);
      // Position twig at 60–85% up the parent branch (in local coords before transform)
      const progAlong = 0.60 + (j / SUB) * 0.25;
      // Compute world position along branch tip direction
      const branchTipX = Math.cos(a) * (bl * progAlong * Math.sin(leanZ)) + 0.04 * Math.cos(a);
      const branchTipY = 0.10 + bl * progAlong * Math.cos(leanZ);
      const branchTipZ = Math.sin(a) * (bl * progAlong * Math.sin(leanZ)) + 0.04 * Math.sin(a);
      const tm = new THREE.Matrix4()
        .makeRotationY(ta)
        .multiply(new THREE.Matrix4().makeRotationZ(0.7 + Math.sin(j * 1.9) * 0.25));
      tm.setPosition(branchTipX, branchTipY, branchTipZ);
      twig.applyMatrix4(tm);
      parts.push(twig);

      // Small forked split at twig tip — two tiny diverging stubs
      const budX = branchTipX + Math.cos(ta) * tl * 0.85 * Math.sin(0.7);
      const budY = branchTipY + tl * 0.85 * Math.cos(0.7);
      const budZ = branchTipZ + Math.sin(ta) * tl * 0.85 * Math.sin(0.7);
      const forkAngle1 = ta + 0.5;
      const forkAngle2 = ta - 0.5;
      const forkLen = 0.055 + Math.abs(Math.sin(i + j)) * 0.03;
      for (const fa of [forkAngle1, forkAngle2]) {
        const fork = new THREE.CylinderGeometry(0.002, 0.006, forkLen, 3, 1);
        fork.translate(0, forkLen * 0.5, 0);
        const fm = new THREE.Matrix4()
          .makeRotationY(fa)
          .multiply(new THREE.Matrix4().makeRotationZ(0.55 + Math.sin(fa) * 0.2));
        fm.setPosition(budX, budY, budZ);
        fork.applyMatrix4(fm);
        parts.push(fork);
      }
    }
  }

  const merged = mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g));
  if (!merged) return stump;

  const pos = merged.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color('#5c4a1e');   // dark olive root
  const mid  = new THREE.Color('#8a7040');   // warm tan mid-stem
  const tip  = new THREE.Color('#b09550');   // pale gold tip
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n =
      noise(x * 3.5, z * 3.5) * 0.08 +
      noise(x * 8.0, z * 8.0 + y) * 0.03 +
      noise(x * 16, z * 16) * 0.012;
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    pos.setXYZ(i, x + (x / len) * n, y + (y / len) * n * 0.4, z + (z / len) * n);

    const t = THREE.MathUtils.clamp((y + 0.05) / 0.75, 0, 1);
    const tint = t < 0.5
      ? base.clone().lerp(mid, t * 2)
      : mid.clone().lerp(tip, (t - 0.5) * 2);
    colors[i * 3]     = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  merged.computeVertexNormals();
  return merged;
}

/**
 * Tall dry grass clump — 16 thin tapered strand blades, curved and varied,
 * resembling savanna / oat grass / dry wheat field strands.
 */
function createGrassClumpGeometry(): THREE.BufferGeometry {
  const rng = createNoise2D(() => 0.19);
  const blades: THREE.BufferGeometry[] = [];
  const BLADE_COUNT = 16;

  for (let i = 0; i < BLADE_COUNT; i++) {
    // Height strictly positive: 0.35 – 0.90 units
    const t = i / BLADE_COUNT;
    const h = Math.max(0.35, 0.45 + Math.abs(rng(i * 1.3, 0)) * 0.45 + Math.abs(rng(i * 0.7, 1.0)) * 0.1);
    // Thin tapered strand: top radius near-zero, base slightly wider
    const blade = new THREE.CylinderGeometry(0.002, 0.012, h, 3, 4);
    const pos = blade.attributes.position;

    // Bend each blade: vertices higher up get displaced outward
    const angle = t * Math.PI * 2 + rng(i, 0.5) * 0.8;
    const leanAmount = 0.12 + Math.abs(rng(i * 2.1, i * 0.3)) * 0.18;
    for (let v = 0; v < pos.count; v++) {
      const yv = pos.getY(v) + h * 0.5; // map [-h/2, h/2] → [0, h]
      const norm = h > 0 ? yv / h : 0;
      const bendFactor = Math.pow(Math.max(0, norm), 2.5) * leanAmount;
      pos.setX(v, pos.getX(v) + Math.cos(angle) * bendFactor);
      pos.setZ(v, pos.getZ(v) + Math.sin(angle) * bendFactor);
    }
    // Shift blade so its base is at y=0
    blade.translate(0, h * 0.5, 0);

    // Spread blades outward from clump center
    const spreadAngle = t * Math.PI * 2 + rng(i * 0.9, 2.2) * 0.6;
    const spreadR = 0.04 + Math.abs(rng(i * 1.7, i * 1.1)) * 0.14;
    const m = new THREE.Matrix4()
      .makeRotationY(spreadAngle)
      .multiply(new THREE.Matrix4().makeRotationZ(rng(i * 0.5, i * 1.2) * 0.08));
    m.setPosition(
      Math.cos(spreadAngle) * spreadR,
      0,
      Math.sin(spreadAngle) * spreadR,
    );
    blade.applyMatrix4(m);
    blades.push(blade);
  }

  // Add vertex color gradient: golden base → lighter tip
  const merged = mergeGeometries(blades.map(g => g.index ? g.toNonIndexed() : g));
  if (!merged) return blades[0];

  const mergedPos = merged.attributes.position;
  const colors = new Float32Array(mergedPos.count * 3);
  const baseCol = new THREE.Color('#9b7a28');   // dark golden base
  const midCol  = new THREE.Color('#c9a84c');   // warm amber mid
  const tipCol  = new THREE.Color('#e8d89a');   // pale straw tip
  for (let i = 0; i < mergedPos.count; i++) {
    const y = mergedPos.getY(i);
    const maxH = 0.85;
    const t2 = THREE.MathUtils.clamp(y / maxH, 0, 1);
    const col = t2 < 0.5
      ? baseCol.clone().lerp(midCol, t2 * 2)
      : midCol.clone().lerp(tipCol, (t2 - 0.5) * 2);
    colors[i * 3]     = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  merged.computeVertexNormals();
  return merged;
}

/**
 * Small pebble — flattened icosahedron.
 */
function createPebbleGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(0.18, 0);
  geo.scale(1.2, 0.6, 1.0);
  return geo;
}

/**
 * Ocotillo-style cactus — thin stems with light branching.
 */
function createOcotilloGeometry(): THREE.BufferGeometry {
  const noise = createNoise2D(() => 0.62);
  const parts: THREE.BufferGeometry[] = [];

  const stemCount = 8;
  for (let i = 0; i < stemCount; i++) {
    const stem = new THREE.CylinderGeometry(0.03, 0.05, 2.0, 6, 8);
    const sPos = stem.attributes.position;
    for (let v = 0; v < sPos.count; v++) {
      const y = sPos.getY(v);
      const sway = (y / 2.0) * (0.08 + noise(i * 2.1, y * 3.2) * 0.05);
      sPos.setX(v, sPos.getX(v) + sway);
      sPos.setZ(v, sPos.getZ(v) + sway * 0.4);
    }
    stem.translate(0, 1.0, 0);
    const a = (i / stemCount) * Math.PI * 2;
    const m = new THREE.Matrix4()
      .makeRotationY(a)
      .multiply(new THREE.Matrix4().makeRotationZ(0.12 + noise(i * 1.7, 0) * 0.12));
    m.setPosition(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08);
    stem.applyMatrix4(m);
    parts.push(stem);
  }

  const branches: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const branch = new THREE.CylinderGeometry(0.02, 0.035, 0.9, 5, 5);
    branch.translate(0, 0.45, 0);
    const a = (i / 5) * Math.PI * 2;
    const m = new THREE.Matrix4()
      .makeRotationY(a)
      .multiply(new THREE.Matrix4().makeRotationZ(0.4 + noise(i * 2.3, 0) * 0.2));
    m.setPosition(Math.cos(a) * 0.12, 1.1, Math.sin(a) * 0.12);
    branch.applyMatrix4(m);
    branches.push(branch);
  }
  const branchMerged = mergeGeometries(branches.map(g => g.index ? g.toNonIndexed() : g));
  if (branchMerged) parts.push(branchMerged);

  const merged = mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g));
  if (!merged) return parts[0];
  merged.computeVertexNormals();
  return merged;
}

// ─── Procedural PBR material builders ──────────────────────────

function createRockMaterial(): THREE.MeshStandardMaterial {
  const TEX = 256;
  const canvas = document.createElement('canvas');
  canvas.width = TEX; canvas.height = TEX;
  const ctx = canvas.getContext('2d')!;
  const n = createNoise2D(() => 0.42);
  const n2 = createNoise2D(() => 0.78);

  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const u = x / TEX, v = y / TEX;
      const v1 = n(u * 30, v * 30) * 0.5 + 0.5;
      const v2 = n(u * 80, v * 80) * 0.5 + 0.5;
      const v3 = n2(u * 15, v * 15) * 0.5 + 0.5;
      const c = v1 * 0.4 + v2 * 0.35 + v3 * 0.25;
      const layerBand = Math.sin(v * 40 + n(u * 5, v * 5) * 3) * 0.5 + 0.5;
      const r = Math.floor(155 + c * 55 + layerBand * 20);
      const g = Math.floor(125 + c * 45 + layerBand * 8);
      const b = Math.floor(80 + c * 35);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const diffuse = new THREE.CanvasTexture(canvas);
  diffuse.wrapS = diffuse.wrapT = THREE.RepeatWrapping;
  diffuse.colorSpace = THREE.SRGBColorSpace;

  const nCanvas = document.createElement('canvas');
  nCanvas.width = 256; nCanvas.height = 256;
  const nCtx = nCanvas.getContext('2d')!;
  const nn = createNoise2D(() => 0.65);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const u = x / 256, v = y / 256;
      const a = nn(u * 50, v * 50) * 0.5 + 0.5;
      const b = nn(u * 120, v * 120) * 0.5 + 0.5;
      const r = Math.floor(128 + (a - 0.5) * 100);
      const g = Math.floor(128 + (b - 0.5) * 100);
      nCtx.fillStyle = `rgb(${Math.min(255, Math.max(0, r))},${Math.min(255, Math.max(0, g))},255)`;
      nCtx.fillRect(x, y, 1, 1);
    }
  }
  const normalMap = new THREE.CanvasTexture(nCanvas);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;

  return new THREE.MeshStandardMaterial({
    map: diffuse,
    normalMap,
    normalScale: new THREE.Vector2(1.5, 1.5),
    roughness: 0.92,
    metalness: 0.02,
    envMapIntensity: 0.25,
  });
}

function createCactusMaterial(): THREE.MeshStandardMaterial {
  const TEX = 256;
  const canvas = document.createElement('canvas');
  canvas.width = TEX; canvas.height = TEX;
  const ctx = canvas.getContext('2d')!;
  const n = createNoise2D(() => 0.33);

  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const u = x / TEX, v = y / TEX;
      const v1 = n(u * 40, v * 40) * 0.5 + 0.5;
      const v2 = n(u * 100, v * 100) * 0.5 + 0.5;
      const v3 = n(u * 200, v * 200) * 0.5 + 0.5;
      const c = v1 * 0.4 + v2 * 0.35 + v3 * 0.25;
      const spineDot = v3 > 0.82 ? 0.3 : 0;
      const r = Math.floor(38 + c * 20 + spineDot * 100);
      const g = Math.floor(82 + c * 40 + spineDot * 30);
      const b = Math.floor(28 + c * 18);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const diffuse = new THREE.CanvasTexture(canvas);
  diffuse.wrapS = diffuse.wrapT = THREE.RepeatWrapping;
  diffuse.colorSpace = THREE.SRGBColorSpace;

  const nCanvas = document.createElement('canvas');
  nCanvas.width = 256; nCanvas.height = 256;
  const nCtx = nCanvas.getContext('2d')!;
  const nn = createNoise2D(() => 0.88);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const u = x / 256, v = y / 256;
      const rib = Math.sin(u * Math.PI * 20) * 0.5 + 0.5;
      const fine = nn(u * 80, v * 80) * 0.5 + 0.5;
      const r = Math.floor(128 + (rib - 0.5) * 120 + (fine - 0.5) * 30);
      const g = Math.floor(128 + (fine - 0.5) * 40);
      nCtx.fillStyle = `rgb(${Math.min(255, Math.max(0, r))},${Math.min(255, Math.max(0, g))},255)`;
      nCtx.fillRect(x, y, 1, 1);
    }
  }
  const normalMap = new THREE.CanvasTexture(nCanvas);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;

  return new THREE.MeshStandardMaterial({
    map: diffuse,
    normalMap,
    normalScale: new THREE.Vector2(2.0, 2.0),
    roughness: 0.65,
    metalness: 0.0,
    envMapIntensity: 0.22,
    emissive: '#1a3a12',
    emissiveIntensity: 0.05,
  });
}

function createBarrelCactusMaterial(): THREE.MeshStandardMaterial {
  const TEX = 128;
  const canvas = document.createElement('canvas');
  canvas.width = TEX; canvas.height = TEX;
  const ctx = canvas.getContext('2d')!;
  const n = createNoise2D(() => 0.44);
  const n2 = createNoise2D(() => 0.82);

  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const u = x / TEX, v = y / TEX;
      // Vertical rib shading bands
      const rib = Math.sin(u * Math.PI * 24) * 0.5 + 0.5;
      const fine = n(u * 80, v * 80) * 0.5 + 0.5;
      const macro = n2(u * 20, v * 20) * 0.5 + 0.5;
      const c = rib * 0.5 + fine * 0.3 + macro * 0.2;
      // Dark earthy green — ribs darker, ridges lighter
      const r = Math.floor(28 + c * 32);
      const g = Math.floor(62 + c * 48);
      const b = Math.floor(18 + c * 20);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const diffuse = new THREE.CanvasTexture(canvas);
  diffuse.wrapS = diffuse.wrapT = THREE.RepeatWrapping;
  diffuse.colorSpace = THREE.SRGBColorSpace;

  return new THREE.MeshStandardMaterial({
    map: diffuse, roughness: 0.7, metalness: 0.0, envMapIntensity: 0.2,
    emissive: '#0f1f08', emissiveIntensity: 0.06,
  });
}

function createBushMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#ffffff',    // pure white so vertex colors come through unmodified
    roughness: 0.92,
    metalness: 0.0,
    envMapIntensity: 0.12,
    side: THREE.DoubleSide,
    vertexColors: true,
  });
}

function createGrassMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#d4aa55',        // warm golden wheat base
    roughness: 0.88,
    metalness: 0.0,
    envMapIntensity: 0.10,
    side: THREE.DoubleSide,  // visible from both sides so blades show at any angle
    vertexColors: true,      // gradient base→tip applied per-vertex
  });
}

function createPebbleMaterial(): THREE.MeshStandardMaterial {
  const TEX = 128;
  const canvas = document.createElement('canvas');
  canvas.width = TEX; canvas.height = TEX;
  const ctx = canvas.getContext('2d')!;
  const n = createNoise2D(() => 0.48);

  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const u = x / TEX, v = y / TEX;
      const c = n(u * 70, v * 70) * 0.5 + 0.5;
      const r = Math.floor(150 + c * 50);
      const g = Math.floor(110 + c * 35);
      const b = Math.floor(75 + c * 25);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const diffuse = new THREE.CanvasTexture(canvas);
  diffuse.colorSpace = THREE.SRGBColorSpace;

  return new THREE.MeshStandardMaterial({
    map: diffuse,
    roughness: 0.92,
    metalness: 0.0,
    envMapIntensity: 0.2,
  });
}

function createOcotilloMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#6f7b3a',
    roughness: 0.78,
    metalness: 0.0,
    envMapIntensity: 0.18,
  });
}

// ─── Component ─────────────────────────────────────────────────

export default function Obstacles({
  costmapData,
  costmapWidth = 256,
  costmapHeight = 256,
  worldSize = 200,
  densityScale = 1,
}: ObstaclesProps) {
  const rocksRef = useRef<THREE.InstancedMesh>(null);
  const cactiRef = useRef<THREE.InstancedMesh>(null);
  const barrelRef = useRef<THREE.InstancedMesh>(null);
  const bushRef = useRef<THREE.InstancedMesh>(null);
  const treeRef = useRef<THREE.InstancedMesh>(null);
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const pebbleRef = useRef<THREE.InstancedMesh>(null);

  const fract = (v: number) => v - Math.floor(v);
  const hash2 = (a: number, b: number) =>
    fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453123);

  const rockGeo = useMemo(() => createRockGeometry(), []);
  const cactusGeo = useMemo(() => createCactusGeometry(), []);
  const barrelGeo = useMemo(() => createBarrelCactusGeometry(), []);
  const bushGeo = useMemo(() => createBushGeometry(), []);
  const treeGeo = useMemo(() => createOcotilloGeometry(), []);
  const grassGeo = useMemo(() => createGrassClumpGeometry(), []);
  const pebbleGeo = useMemo(() => createPebbleGeometry(), []);

  const rockMat = useMemo(() => createRockMaterial(), []);
  const cactusMat = useMemo(() => createCactusMaterial(), []);
  const barrelMat = useMemo(() => createBarrelCactusMaterial(), []);
  const bushMat = useMemo(() => createBushMaterial(), []);
  const treeMat = useMemo(() => createOcotilloMaterial(), []);
  const grassMat = useMemo(() => createGrassMaterial(), []);
  const pebbleMat = useMemo(() => createPebbleMaterial(), []);

  const {
    rockMatrices, rockColors,
    cactusMatrices, cactusColors,
    barrelMatrices, barrelColors,
    bushMatrices, bushColors,
    treeMatrices, treeColors,
    grassMatrices, grassColors,
    pebbleMatrices, pebbleColors,
  } = useMemo(() => {
    if (!costmapData) {
      return {
        rockMatrices: [] as THREE.Matrix4[], rockColors: [] as THREE.Color[],
        cactusMatrices: [] as THREE.Matrix4[], cactusColors: [] as THREE.Color[],
        barrelMatrices: [] as THREE.Matrix4[], barrelColors: [] as THREE.Color[],
        bushMatrices: [] as THREE.Matrix4[], bushColors: [] as THREE.Color[],
        treeMatrices: [] as THREE.Matrix4[], treeColors: [] as THREE.Color[],
        grassMatrices: [] as THREE.Matrix4[], grassColors: [] as THREE.Color[],
        pebbleMatrices: [] as THREE.Matrix4[], pebbleColors: [] as THREE.Color[],
      };
    }

    const noise2D = createNoise2D(() => 0.5);
    const rockArr: { x: number; z: number; scale: number }[] = [];
    const cactusArr: { x: number; z: number; scale: number }[] = [];
    const barrelArr: { x: number; z: number; scale: number }[] = [];
    const bushArr: { x: number; z: number; scale: number }[] = [];
    const treeArr: { x: number; z: number; scale: number }[] = [];
    const grassArr: { x: number; z: number; scale: number }[] = [];
    const pebbleArr: { x: number; z: number; scale: number }[] = [];

    const step = 2;
    for (let gy = 0; gy < costmapHeight; gy += step) {
      for (let gx = 0; gx < costmapWidth; gx += step) {
        const val = costmapData[gy]?.[gx] ?? 0;
        const [wx, wz] = gridToWorld(gx, gy, costmapWidth, costmapHeight, worldSize);
        const jitterX = (hash2(gx, gy) - 0.5) * 1.7;
        const jitterZ = (hash2(gy, gx) - 0.5) * 1.7;
        const px = wx + jitterX;
        const pz = wz + jitterZ;
        const densityNoise = noise2D(px * 0.025, pz * 0.025) * 0.5 + 0.5;
        const clusterNoise = noise2D(px * 0.012, pz * 0.012) * 0.5 + 0.5;
        const patchNoise = noise2D(px * 0.004, pz * 0.004) * 0.5 + 0.5;
        const patchMask = THREE.MathUtils.smoothstep(patchNoise, 0.45, 0.78);
        const ds = densityScale;
        const height = getTerrainHeight(noise2D, px, pz, worldSize);
        const slope = getTerrainSlope(noise2D, px, pz, worldSize);

        if (val >= 10 && hash2(gx + 9.3, gy - 2.1) > (1 - 0.35 * ds)) {
          const scale = 0.35 + (noise2D(px * 0.12, pz * 0.12) * 0.5 + 0.5) * 0.9;
          rockArr.push({ x: px, z: pz, scale });
        }

        if (val < 6 && densityNoise > 0.6 && hash2(gx * 2.31, gy * 1.47) > (1 - 0.07 * ds)) {
          const scale = 1.0 + hash2(gx * 0.77, gy * 0.33) * 1.2;
          cactusArr.push({ x: px, z: pz, scale });
        }

        if (val < 5 && densityNoise > 0.45 && hash2(gx * 3.17, gy * 2.53) > (1 - 0.05 * ds)) {
          const scale = 0.55 + hash2(gx * 0.91, gy * 0.62) * 0.85;
          barrelArr.push({ x: px, z: pz, scale });
        }

        if (val < 8 && clusterNoise > 0.6 && slope < 0.42 && hash2(gx * 4.11, gy * 3.07) > (1 - 0.02 * ds)) {
          const scale = 0.9 + hash2(gx * 0.59, gy * 0.41) * 1.2;
          treeArr.push({ x: px, z: pz, scale });
        }

        if (val < 9 && patchMask > 0.2 && densityNoise > (1 - 0.55 * ds) && hash2(gx * 1.91, gy * 0.83) > (1 - 0.48 * ds)) {
          const scale = 0.65 + densityNoise * 1.15;
          bushArr.push({ x: px, z: pz, scale });
        }

        // Grass strands — tall golden blades in dense randomised spread patches
        if (val < 7 && slope < 0.38 && height > -0.5 && height < 2.8) {
          // Two-octave patch mask: large blobs × medium variation
          const fieldNoise  = noise2D(px * 0.014, pz * 0.014) * 0.5 + 0.5; // large patch scale
          const detailNoise = noise2D(px * 0.035, pz * 0.035) * 0.5 + 0.5; // break-up detail
          const fieldMask = THREE.MathUtils.smoothstep(fieldNoise, 0.36, 0.68)
                          * THREE.MathUtils.smoothstep(detailNoise, 0.28, 0.62);
          const isInPatch = patchMask > 0.22 && fieldMask > 0.05;
          const grassChance = isInPatch
            ? (0.60 + clusterNoise * 0.35) * ds
            : (0.03 + clusterNoise * 0.06) * ds;
          if (hash2(gx * 3.91, gy * 2.17) > (1 - grassChance)) {
            const scale = 0.85 + hash2(gx * 0.52, gy * 0.29) * 0.7;
            grassArr.push({ x: px, z: pz, scale });
            // Wide-radius burst: scatter 5–10 extra clumps up to 3.5 world-units away
            // so each spawned point seeds a visible field patch
            if (isInPatch && fieldMask > 0.2) {
              const burst = 5 + Math.floor(hash2(gx * 13.7, gy * 9.3) * 6);
              for (let b = 0; b < burst; b++) {
                const sa = hash2(gx * (b + 2.1), gy * (b + 1.3)) * Math.PI * 2;
                // Vary radius: inner ring 0.4–1.4, outer ring 1.5–3.5
                const ring = hash2(gy * (b + 0.7), gx * (b + 3.1)) > 0.5 ? 1 : 0;
                const sr = ring === 0
                  ? 0.4 + hash2(gy * (b + 4.7), gx * (b + 2.9)) * 1.0
                  : 1.5 + hash2(gy * (b + 6.1), gx * (b + 0.9)) * 2.0;
                const sx = px + Math.cos(sa) * sr;
                const sz2 = pz + Math.sin(sa) * sr;
                const sc = 0.75 + hash2(sx * 0.33, sz2 * 0.51) * 0.70;
                grassArr.push({ x: sx, z: sz2, scale: sc });
              }
            }
          }
        }

        // Pebble clusters — lower slope, everywhere but peaks
        if (val < 9 && slope < 0.55 && height < 2.8) {
          const pebbleChance = (0.28 + densityNoise * 0.2) * ds;
          if (hash2(gx * 7.07, gy * 5.33) > (1 - pebbleChance)) {
            const scale = 0.35 + hash2(gx * 0.18, gy * 0.41) * 0.6;
            pebbleArr.push({ x: px, z: pz, scale });
          }
        }
      }
    }

    const dummy = new THREE.Object3D();

    const rMats: THREE.Matrix4[] = [];
    const rCols: THREE.Color[] = [];
    for (const { x, z, scale } of rockArr) {
      const ty = getTerrainHeight(noise2D, x, z, worldSize);
      dummy.position.set(x, ty + scale * 0.18, z);
      dummy.rotation.set(
        noise2D(x * 0.3, z * 0.2) * 0.35,
        noise2D(x * 0.5, z * 0.4) * Math.PI,
        noise2D(x * 0.2, z * 0.6) * 0.25,
      );
      dummy.scale.set(
        scale * (0.8 + noise2D(x * 0.7, z * 0.1) * 0.45),
        scale * (0.55 + noise2D(x * 0.1, z * 0.7) * 0.5),
        scale * (0.8 + noise2D(x * 0.4, z * 0.3) * 0.45),
      );
      dummy.updateMatrix();
      rMats.push(dummy.matrix.clone());
      const cn = noise2D(x * 0.05, z * 0.05) * 0.5 + 0.5;
      rCols.push(new THREE.Color().setHSL(0.07 + cn * 0.04, 0.25 + cn * 0.15, 0.42 + cn * 0.18));
    }

    const cMats: THREE.Matrix4[] = [];
    const cCols: THREE.Color[] = [];
    for (const { x, z, scale } of cactusArr) {
      const ty = getTerrainHeight(noise2D, x, z, worldSize);
      dummy.position.set(x, ty, z);
      dummy.rotation.set(0, noise2D(x * 0.13, z * 0.13) * Math.PI * 2, 0);
      const scaleXZ = scale * (0.65 + hash2(x * 0.61, z * 0.71) * 0.7);
      dummy.scale.set(scaleXZ, scale, scaleXZ);
      dummy.updateMatrix();
      cMats.push(dummy.matrix.clone());
      const cn = hash2(x * 0.2, z * 0.2);
      cCols.push(new THREE.Color().setHSL(0.28 + cn * 0.06, 0.45 + cn * 0.2, 0.22 + cn * 0.1));
    }

    const baMats: THREE.Matrix4[] = [];
    const baCols: THREE.Color[] = [];
    for (const { x, z, scale } of barrelArr) {
      const ty = getTerrainHeight(noise2D, x, z, worldSize);
      dummy.position.set(x, ty + scale * 0.15, z);
      dummy.rotation.set(
        noise2D(x * 0.5, z * 0.3) * 0.08,
        noise2D(x * 0.2, z * 0.2) * Math.PI * 2,
        noise2D(x * 0.3, z * 0.5) * 0.08,
      );
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      baMats.push(dummy.matrix.clone());
      const cn = hash2(x * 0.3, z * 0.3);
      baCols.push(new THREE.Color().setHSL(0.30 + cn * 0.05, 0.50 + cn * 0.15, 0.24 + cn * 0.08));
    }

    const tMats: THREE.Matrix4[] = [];
    const tCols: THREE.Color[] = [];
    for (const { x, z, scale } of treeArr) {
      const ty = getTerrainHeight(noise2D, x, z, worldSize);
      dummy.position.set(x, ty, z);
      dummy.rotation.set(
        noise2D(x * 0.4, z * 0.15) * 0.1,
        noise2D(x * 0.1, z * 0.1) * Math.PI * 2,
        noise2D(x * 0.15, z * 0.4) * 0.08,
      );
      dummy.scale.set(scale * 0.9, scale, scale * 0.9);
      dummy.updateMatrix();
      tMats.push(dummy.matrix.clone());
      const cn = hash2(x * 0.15, z * 0.15);
      tCols.push(new THREE.Color().setHSL(0.2 + cn * 0.05, 0.28 + cn * 0.15, 0.38 + cn * 0.12));
    }

    const bMats: THREE.Matrix4[] = [];
    const bCols: THREE.Color[] = [];
    for (const { x, z, scale } of bushArr) {
      const ty = getTerrainHeight(noise2D, x, z, worldSize);
      const height = scale * (0.5 + hash2(x * 0.41, z * 0.77) * 0.8);
      // Raise bushes so branching base clears terrain surface
      dummy.position.set(x, ty + scale * 0.28, z);
      dummy.rotation.set(0, noise2D(x * 0.09, z * 0.09) * Math.PI, noise2D(x * 0.4, z * 0.22) * 0.06);
      dummy.scale.set(scale * (0.8 + hash2(x, z) * 0.85), height, scale * (0.7 + hash2(z, x) * 0.9));
      dummy.updateMatrix();
      bMats.push(dummy.matrix.clone());
      const hue = 0.12 + hash2(x * 0.3, z * 0.3) * 0.06;
      const sat = 0.3 + hash2(z * 0.4, x * 0.4) * 0.2;
      const lit = 0.22 + hash2(x * 0.61, z * 0.81) * 0.12;
      bCols.push(new THREE.Color().setHSL(hue, sat, lit));
    }

    const gMats: THREE.Matrix4[] = [];
    const gCols: THREE.Color[] = [];
    for (const { x, z, scale } of grassArr) {
      const ty = getTerrainHeight(noise2D, x, z, worldSize);
      const rotY = noise2D(x * 0.2, z * 0.2) * Math.PI;
      // Place base exactly on terrain — no vertical offset since blade base is at y=0
      dummy.position.set(x, ty, z);
      dummy.rotation.set(0, rotY, noise2D(x * 0.6, z * 0.4) * 0.04);
      dummy.scale.set(scale, scale * (0.9 + hash2(x * 0.33, z * 0.51) * 0.5), scale);
      dummy.updateMatrix();
      gMats.push(dummy.matrix.clone());
      const cn = hash2(x * 0.7, z * 0.7);
      gCols.push(new THREE.Color().setHSL(0.12 + cn * 0.05, 0.35 + cn * 0.15, 0.56 + cn * 0.12));
    }

    const pMats: THREE.Matrix4[] = [];
    const pCols: THREE.Color[] = [];
    for (const { x, z, scale } of pebbleArr) {
      const ty = getTerrainHeight(noise2D, x, z, worldSize);
      dummy.position.set(x, ty + scale * 0.05, z);
      dummy.rotation.set(
        noise2D(x * 0.4, z * 0.2) * 0.3,
        noise2D(x * 0.1, z * 0.1) * Math.PI,
        noise2D(x * 0.2, z * 0.5) * 0.2,
      );
      dummy.scale.set(scale, scale * (0.7 + hash2(x, z) * 0.6), scale * (0.8 + hash2(z, x) * 0.4));
      dummy.updateMatrix();
      pMats.push(dummy.matrix.clone());
      const cn = hash2(x * 0.25, z * 0.25);
      pCols.push(new THREE.Color().setHSL(0.08 + cn * 0.04, 0.18 + cn * 0.12, 0.45 + cn * 0.12));
    }

    return {
      rockMatrices: rMats, rockColors: rCols,
      cactusMatrices: cMats, cactusColors: cCols,
      barrelMatrices: baMats, barrelColors: baCols,
      bushMatrices: bMats, bushColors: bCols,
      treeMatrices: tMats, treeColors: tCols,
      grassMatrices: gMats, grassColors: gCols,
      pebbleMatrices: pMats, pebbleColors: pCols,
    };
  }, [costmapData, costmapWidth, costmapHeight, worldSize, densityScale]);

  const rockCount = rockMatrices.length;
  const cactusCount = cactusMatrices.length;
  const barrelCount = barrelMatrices.length;
  const bushCount = bushMatrices.length;
  const treeCount = treeMatrices.length;
  const grassCount = grassMatrices.length;
  const pebbleCount = pebbleMatrices.length;

  useEffect(() => {
    const mesh = rocksRef.current;
    if (!mesh || rockCount === 0) return;
    for (let i = 0; i < rockCount; i++) { mesh.setMatrixAt(i, rockMatrices[i]); mesh.setColorAt(i, rockColors[i]); }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [rockCount, rockMatrices, rockColors]);

  useEffect(() => {
    const mesh = cactiRef.current;
    if (!mesh || cactusCount === 0) return;
    for (let i = 0; i < cactusCount; i++) { mesh.setMatrixAt(i, cactusMatrices[i]); mesh.setColorAt(i, cactusColors[i]); }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cactusCount, cactusMatrices, cactusColors]);

  useEffect(() => {
    const mesh = barrelRef.current;
    if (!mesh || barrelCount === 0) return;
    for (let i = 0; i < barrelCount; i++) { mesh.setMatrixAt(i, barrelMatrices[i]); mesh.setColorAt(i, barrelColors[i]); }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [barrelCount, barrelMatrices, barrelColors]);

  useEffect(() => {
    const mesh = bushRef.current;
    if (!mesh || bushCount === 0) return;
    for (let i = 0; i < bushCount; i++) { mesh.setMatrixAt(i, bushMatrices[i]); mesh.setColorAt(i, bushColors[i]); }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [bushCount, bushMatrices, bushColors]);

  useEffect(() => {
    const mesh = treeRef.current;
    if (!mesh || treeCount === 0) return;
    for (let i = 0; i < treeCount; i++) { mesh.setMatrixAt(i, treeMatrices[i]); mesh.setColorAt(i, treeColors[i]); }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [treeCount, treeMatrices, treeColors]);

  useEffect(() => {
    const mesh = grassRef.current;
    if (!mesh || grassCount === 0) return;
    for (let i = 0; i < grassCount; i++) { mesh.setMatrixAt(i, grassMatrices[i]); mesh.setColorAt(i, grassColors[i]); }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [grassCount, grassMatrices, grassColors]);

  useEffect(() => {
    const mesh = pebbleRef.current;
    if (!mesh || pebbleCount === 0) return;
    for (let i = 0; i < pebbleCount; i++) { mesh.setMatrixAt(i, pebbleMatrices[i]); mesh.setColorAt(i, pebbleColors[i]); }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [pebbleCount, pebbleMatrices, pebbleColors]);

  const totalCount = rockCount + cactusCount + barrelCount + bushCount + treeCount + grassCount + pebbleCount;
  if (totalCount === 0) return null;

  return (
    <group>
      {rockCount > 0 && <instancedMesh ref={rocksRef} args={[rockGeo, rockMat, rockCount]} castShadow receiveShadow frustumCulled={false} />}
      {cactusCount > 0 && <instancedMesh ref={cactiRef} args={[cactusGeo, cactusMat, cactusCount]} castShadow receiveShadow frustumCulled={false} />}
      {barrelCount > 0 && <instancedMesh ref={barrelRef} args={[barrelGeo, barrelMat, barrelCount]} castShadow receiveShadow frustumCulled={false} />}
      {bushCount > 0 && <instancedMesh ref={bushRef} args={[bushGeo, bushMat, bushCount]} castShadow receiveShadow frustumCulled={false} />}
      {treeCount > 0 && <instancedMesh ref={treeRef} args={[treeGeo, treeMat, treeCount]} castShadow receiveShadow frustumCulled={false} />}
      {grassCount > 0 && <instancedMesh ref={grassRef} args={[grassGeo, grassMat, grassCount]} castShadow receiveShadow frustumCulled={false} />}
      {pebbleCount > 0 && <instancedMesh ref={pebbleRef} args={[pebbleGeo, pebbleMat, pebbleCount]} castShadow receiveShadow frustumCulled={false} />}
    </group>
  );
}
