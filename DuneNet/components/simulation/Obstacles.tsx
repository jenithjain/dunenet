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
  const raw =
    noise2D(x * 0.006, z * 0.006) * 10 +
    noise2D(x * 0.015, z * 0.015) * 4 +
    noise2D(x * 0.04, z * 0.04) * 1.5 +
    noise2D(x * 0.1, z * 0.1) * 0.4 +
    noise2D(x * 0.25, z * 0.25) * 0.1;
  const dist = Math.sqrt(x * x + z * z) / (worldSize * 0.5);
  const falloff = Math.max(0, 1 - Math.pow(dist, 3));
  return raw * falloff;
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
 * Barrel cactus — short squat ribbed sphere with flower crown.
 */
function createBarrelCactusGeometry(): THREE.BufferGeometry {
  const r = 16;
  const body = new THREE.SphereGeometry(0.35, r, 12);
  body.scale(1, 0.75, 1);

  const pos = body.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const angle = Math.atan2(z, x);
    const ribFactor = Math.sin(angle * 10) * 0.025;
    const len = Math.sqrt(x * x + z * z) || 1;
    pos.setXYZ(i, x + (x / len) * ribFactor, y, z + (z / len) * ribFactor);
  }

  const crown = new THREE.TorusGeometry(0.08, 0.02, 6, 12);
  crown.translate(0, 0.26, 0);

  const merged = mergeGeometries([body, crown]);
  if (!merged) return body;
  merged.computeVertexNormals();
  return merged;
}

/**
 * Dry desert shrub — cluster with elongated tendrils.
 */
function createBushGeometry(): THREE.BufferGeometry {
  const noise = createNoise2D(() => 0.73);
  const parts: THREE.BufferGeometry[] = [];

  const main = new THREE.IcosahedronGeometry(0.40, 2);
  main.scale(1, 0.5, 1);
  parts.push(main);

  const offsets: [number, number, number, number][] = [
    [0.30, 0.06, 0.22, 0.20], [-0.26, 0.0, 0.30, 0.18],
    [0.08, 0.14, -0.32, 0.22], [-0.30, 0.03, -0.16, 0.15],
    [0.24, -0.04, -0.24, 0.17], [-0.12, 0.10, 0.34, 0.19],
    [0.32, 0.0, 0.0, 0.16], [-0.05, 0.08, -0.28, 0.14],
    [0.18, 0.06, 0.16, 0.12],
  ];

  for (const [ox, oy, oz, sz] of offsets) {
    const s = new THREE.IcosahedronGeometry(sz, 1);
    s.scale(1, 0.45, 1);
    s.translate(ox, oy, oz);
    parts.push(s);
  }

  // thin branch-like cylinders
  const branchAngles = [0, 0.8, 1.6, 2.4, 3.2, 4.0, 5.0];
  for (const a of branchAngles) {
    const branch = new THREE.CylinderGeometry(0.012, 0.018, 0.35, 4, 1);
    branch.translate(0, 0.175, 0);
    const m = new THREE.Matrix4()
      .makeRotationZ(0.4 + Math.sin(a) * 0.3)
      .multiply(new THREE.Matrix4().makeRotationY(a));
    m.setPosition(Math.cos(a) * 0.15, 0.1, Math.sin(a) * 0.15);
    branch.applyMatrix4(m);
    parts.push(branch);
  }

  const merged = mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g));
  if (!merged) return main;

  const pos = merged.attributes.position;
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
  }

  merged.computeVertexNormals();
  return merged;
}

/**
 * Dead tree — gnarled trunk with bare forked branches.
 */
function createDeadTreeGeometry(): THREE.BufferGeometry {
  const noise = createNoise2D(() => 0.55);
  const parts: THREE.BufferGeometry[] = [];

  const trunk = new THREE.CylinderGeometry(0.06, 0.12, 1.6, 8, 6);
  const tPos = trunk.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    const y = tPos.getY(i);
    const bend = (y / 1.6) * 0.1;
    tPos.setX(i, tPos.getX(i) + bend);
    const n = noise(tPos.getX(i) * 5, y * 3) * 0.015;
    tPos.setX(i, tPos.getX(i) + n);
    tPos.setZ(i, tPos.getZ(i) + n * 0.7);
  }
  trunk.translate(0, 0.8, 0);
  parts.push(trunk);

  const branchConfigs = [
    { angle: 0.5, rotY: 0, length: 0.6, radius: 0.04, yOff: 1.2 },
    { angle: -0.4, rotY: Math.PI * 0.6, length: 0.5, radius: 0.035, yOff: 1.3 },
    { angle: 0.6, rotY: Math.PI * 1.2, length: 0.45, radius: 0.03, yOff: 1.0 },
    { angle: 0.3, rotY: Math.PI * 0.3, length: 0.3, radius: 0.025, yOff: 1.5 },
  ];

  for (const cfg of branchConfigs) {
    const branch = new THREE.CylinderGeometry(cfg.radius * 0.5, cfg.radius, cfg.length, 6, 3);
    branch.translate(0, cfg.length / 2, 0);
    const m = new THREE.Matrix4()
      .makeRotationZ(cfg.angle)
      .multiply(new THREE.Matrix4().makeRotationY(cfg.rotY));
    m.setPosition(0.05, cfg.yOff, 0);
    branch.applyMatrix4(m);
    parts.push(branch);
  }

  const merged = mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g));
  if (!merged) return trunk;
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

  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const u = x / TEX, v = y / TEX;
      const c = n(u * 50, v * 50) * 0.5 + 0.5;
      const r = Math.floor(55 + c * 25);
      const g = Math.floor(100 + c * 30);
      const b = Math.floor(35 + c * 15);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const diffuse = new THREE.CanvasTexture(canvas);
  diffuse.colorSpace = THREE.SRGBColorSpace;

  return new THREE.MeshStandardMaterial({
    map: diffuse, roughness: 0.6, metalness: 0.0, envMapIntensity: 0.2,
    emissive: '#1a3015', emissiveIntensity: 0.04,
  });
}

function createBushMaterial(): THREE.MeshStandardMaterial {
  const TEX = 128;
  const canvas = document.createElement('canvas');
  canvas.width = TEX; canvas.height = TEX;
  const ctx = canvas.getContext('2d')!;
  const n = createNoise2D(() => 0.61);

  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const u = x / TEX, v = y / TEX;
      const c = n(u * 60, v * 60) * 0.5 + 0.5;
      const c2 = n(u * 150, v * 150) * 0.5 + 0.5;
      const mix = c * 0.6 + c2 * 0.4;
      const r = Math.floor(85 + mix * 35);
      const g = Math.floor(95 + mix * 30);
      const b = Math.floor(48 + mix * 22);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const diffuse = new THREE.CanvasTexture(canvas);
  diffuse.colorSpace = THREE.SRGBColorSpace;

  return new THREE.MeshStandardMaterial({
    map: diffuse, roughness: 0.88, metalness: 0.0, envMapIntensity: 0.12, side: THREE.DoubleSide,
  });
}

function createDeadTreeMaterial(): THREE.MeshStandardMaterial {
  const TEX = 128;
  const canvas = document.createElement('canvas');
  canvas.width = TEX; canvas.height = TEX;
  const ctx = canvas.getContext('2d')!;
  const n = createNoise2D(() => 0.22);

  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const u = x / TEX, v = y / TEX;
      const bark = Math.sin(v * 80 + n(u * 10, v * 10) * 4) * 0.5 + 0.5;
      const fine = n(u * 100, v * 100) * 0.5 + 0.5;
      const c = bark * 0.6 + fine * 0.4;
      const r = Math.floor(130 + c * 50);
      const g = Math.floor(115 + c * 45);
      const b = Math.floor(95 + c * 35);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const diffuse = new THREE.CanvasTexture(canvas);
  diffuse.colorSpace = THREE.SRGBColorSpace;

  return new THREE.MeshStandardMaterial({
    map: diffuse, roughness: 0.9, metalness: 0.0, envMapIntensity: 0.15,
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

  const fract = (v: number) => v - Math.floor(v);
  const hash2 = (a: number, b: number) =>
    fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453123);

  const rockGeo = useMemo(() => createRockGeometry(), []);
  const cactusGeo = useMemo(() => createCactusGeometry(), []);
  const barrelGeo = useMemo(() => createBarrelCactusGeometry(), []);
  const bushGeo = useMemo(() => createBushGeometry(), []);
  const treeGeo = useMemo(() => createDeadTreeGeometry(), []);

  const rockMat = useMemo(() => createRockMaterial(), []);
  const cactusMat = useMemo(() => createCactusMaterial(), []);
  const barrelMat = useMemo(() => createBarrelCactusMaterial(), []);
  const bushMat = useMemo(() => createBushMaterial(), []);
  const treeMat = useMemo(() => createDeadTreeMaterial(), []);

  const {
    rockMatrices, rockColors,
    cactusMatrices, cactusColors,
    barrelMatrices, barrelColors,
    bushMatrices, bushColors,
    treeMatrices, treeColors,
  } = useMemo(() => {
    if (!costmapData) {
      return {
        rockMatrices: [] as THREE.Matrix4[], rockColors: [] as THREE.Color[],
        cactusMatrices: [] as THREE.Matrix4[], cactusColors: [] as THREE.Color[],
        barrelMatrices: [] as THREE.Matrix4[], barrelColors: [] as THREE.Color[],
        bushMatrices: [] as THREE.Matrix4[], bushColors: [] as THREE.Color[],
        treeMatrices: [] as THREE.Matrix4[], treeColors: [] as THREE.Color[],
      };
    }

    const noise2D = createNoise2D(() => 0.5);
    const rockArr: { x: number; z: number; scale: number }[] = [];
    const cactusArr: { x: number; z: number; scale: number }[] = [];
    const barrelArr: { x: number; z: number; scale: number }[] = [];
    const bushArr: { x: number; z: number; scale: number }[] = [];
    const treeArr: { x: number; z: number; scale: number }[] = [];

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
        const ds = densityScale;

        if (val >= 10 && hash2(gx + 9.3, gy - 2.1) > (1 - 0.48 * ds)) {
          const scale = 0.5 + (noise2D(px * 0.12, pz * 0.12) * 0.5 + 0.5) * 1.8;
          rockArr.push({ x: px, z: pz, scale });
        }

        if (val < 7 && densityNoise > (1 - 0.48 * ds) && hash2(gx * 2.31, gy * 1.47) > (1 - 0.12 * ds)) {
          const scale = 1.2 + hash2(gx * 0.77, gy * 0.33) * 1.6;
          cactusArr.push({ x: px, z: pz, scale });
        }

        if (val < 6 && densityNoise > 0.40 && hash2(gx * 3.17, gy * 2.53) > (1 - 0.08 * ds)) {
          const scale = 0.6 + hash2(gx * 0.91, gy * 0.62) * 1.0;
          barrelArr.push({ x: px, z: pz, scale });
        }

        if (val < 8 && hash2(gx * 4.11, gy * 3.07) > (1 - 0.04 * ds)) {
          const scale = 1.0 + hash2(gx * 0.59, gy * 0.41) * 1.5;
          treeArr.push({ x: px, z: pz, scale });
        }

        if (val < 9 && densityNoise > (1 - 0.54 * ds) && hash2(gx * 1.91, gy * 0.83) > (1 - 0.33 * ds)) {
          const scale = 0.5 + densityNoise * 0.9;
          bushArr.push({ x: px, z: pz, scale });
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
      tCols.push(new THREE.Color().setHSL(0.08 + cn * 0.03, 0.15 + cn * 0.1, 0.45 + cn * 0.15));
    }

    const bMats: THREE.Matrix4[] = [];
    const bCols: THREE.Color[] = [];
    for (const { x, z, scale } of bushArr) {
      const ty = getTerrainHeight(noise2D, x, z, worldSize);
      const height = scale * (0.5 + hash2(x * 0.41, z * 0.77) * 0.8);
      dummy.position.set(x, ty + height * 0.22, z);
      dummy.rotation.set(0, noise2D(x * 0.09, z * 0.09) * Math.PI, noise2D(x * 0.4, z * 0.22) * 0.06);
      dummy.scale.set(scale * (0.8 + hash2(x, z) * 0.85), height, scale * (0.7 + hash2(z, x) * 0.9));
      dummy.updateMatrix();
      bMats.push(dummy.matrix.clone());
      const hue = 0.12 + hash2(x * 0.3, z * 0.3) * 0.06;
      const sat = 0.3 + hash2(z * 0.4, x * 0.4) * 0.2;
      const lit = 0.22 + hash2(x * 0.61, z * 0.81) * 0.12;
      bCols.push(new THREE.Color().setHSL(hue, sat, lit));
    }

    return {
      rockMatrices: rMats, rockColors: rCols,
      cactusMatrices: cMats, cactusColors: cCols,
      barrelMatrices: baMats, barrelColors: baCols,
      bushMatrices: bMats, bushColors: bCols,
      treeMatrices: tMats, treeColors: tCols,
    };
  }, [costmapData, costmapWidth, costmapHeight, worldSize, densityScale]);

  const rockCount = rockMatrices.length;
  const cactusCount = cactusMatrices.length;
  const barrelCount = barrelMatrices.length;
  const bushCount = bushMatrices.length;
  const treeCount = treeMatrices.length;

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

  const totalCount = rockCount + cactusCount + barrelCount + bushCount + treeCount;
  if (totalCount === 0) return null;

  return (
    <group>
      {rockCount > 0 && <instancedMesh ref={rocksRef} args={[rockGeo, rockMat, rockCount]} castShadow receiveShadow frustumCulled={false} />}
      {cactusCount > 0 && <instancedMesh ref={cactiRef} args={[cactusGeo, cactusMat, cactusCount]} castShadow receiveShadow frustumCulled={false} />}
      {barrelCount > 0 && <instancedMesh ref={barrelRef} args={[barrelGeo, barrelMat, barrelCount]} castShadow receiveShadow frustumCulled={false} />}
      {bushCount > 0 && <instancedMesh ref={bushRef} args={[bushGeo, bushMat, bushCount]} castShadow receiveShadow frustumCulled={false} />}
      {treeCount > 0 && <instancedMesh ref={treeRef} args={[treeGeo, treeMat, treeCount]} castShadow receiveShadow frustumCulled={false} />}
    </group>
  );
}
