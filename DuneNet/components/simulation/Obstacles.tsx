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

// ─── Procedural geometry builders ──────────────────────────────

/**
 * Desert boulder – noise-displaced icosahedron with Y-flattening for
 * a natural weathered-sandstone look.
 */
function createRockGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 2); // 42 verts
  const pos = geo.attributes.position;
  const noise = createNoise2D(() => 0.42);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // Multi-scale displacement for craggy surface
    const d =
      noise(x * 1.6 + y * 0.7, z * 1.6 + y * 0.3) * 0.28 +
      noise(x * 3.2, z * 3.2 + y) * 0.14 +
      noise(x * 6.0 + z, z * 6.0) * 0.06;

    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    // Flatten Y to ~60 % for boulder proportions
    pos.setXYZ(
      i,
      x + (x / len) * d,
      (y + (y / len) * d) * 0.6,
      z + (z / len) * d,
    );
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Saguaro cactus – merged cylinders: trunk + two arms + dome caps.
 * Low radial-seg count gives a natural ribbed look.
 */
function createCactusGeometry(): THREE.BufferGeometry {
  const r = 8; // radial segments → visible ribs

  // Main trunk
  const trunk = new THREE.CylinderGeometry(0.1, 0.14, 1.6, r, 1);
  trunk.translate(0, 0.8, 0);

  // Dome cap on trunk
  const cap = new THREE.SphereGeometry(
    0.1, r, 4, 0, Math.PI * 2, 0, Math.PI / 2,
  );
  cap.translate(0, 1.6, 0);

  // Left arm – angled upward
  const armL = new THREE.CylinderGeometry(0.065, 0.08, 0.55, r, 1);
  armL.translate(0, 0.275, 0);
  const mL = new THREE.Matrix4()
    .makeRotationZ(Math.PI / 3)
    .setPosition(-0.18, 1.0, 0);
  armL.applyMatrix4(mL);

  // Left arm vertical tip
  const armLTip = new THREE.CylinderGeometry(0.055, 0.065, 0.35, r, 1);
  armLTip.translate(-0.4, 1.38, 0);

  const armLC = new THREE.SphereGeometry(
    0.055, r, 4, 0, Math.PI * 2, 0, Math.PI / 2,
  );
  armLC.translate(-0.4, 1.55, 0);

  // Right arm – shorter
  const armR = new THREE.CylinderGeometry(0.06, 0.075, 0.42, r, 1);
  armR.translate(0, 0.21, 0);
  const mR = new THREE.Matrix4()
    .makeRotationZ(-Math.PI / 3.5)
    .setPosition(0.16, 0.7, 0);
  armR.applyMatrix4(mR);

  // Right arm vertical stub
  const armRTip = new THREE.CylinderGeometry(0.05, 0.06, 0.25, r, 1);
  armRTip.translate(0.35, 1.0, 0);

  const armRC = new THREE.SphereGeometry(
    0.05, r, 4, 0, Math.PI * 2, 0, Math.PI / 2,
  );
  armRC.translate(0.35, 1.12, 0);

  const merged = mergeGeometries([
    trunk, cap, armL, armLTip, armLC, armR, armRTip, armRC,
  ]);
  if (!merged) return trunk;
  merged.computeVertexNormals();
  return merged;
}

/**
 * Dry desert shrub — cluster of noise-deformed overlapping spheres
 * creating an irregular bushy silhouette.
 */
function createBushGeometry(): THREE.BufferGeometry {
  const noise = createNoise2D(() => 0.73);
  const parts: THREE.BufferGeometry[] = [];

  // Central body
  const main = new THREE.IcosahedronGeometry(0.45, 1);
  main.scale(1, 0.55, 1);
  parts.push(main);

  // Surrounding irregular clumps
  const offsets: [number, number, number][] = [
    [0.28, 0.06, 0.20],
    [-0.24, 0.0, 0.28],
    [0.08, 0.12, -0.30],
    [-0.28, 0.03, -0.14],
    [0.22, -0.04, -0.22],
    [-0.10, 0.10, 0.32],
    [0.30, 0.0, 0.0],
  ];

  for (const [ox, oy, oz] of offsets) {
    const s = new THREE.IcosahedronGeometry(0.25 + Math.abs(ox) * 0.3, 1);
    s.scale(1, 0.5, 1);
    s.translate(ox, oy, oz);
    parts.push(s);
  }

  const merged = mergeGeometries(parts);
  if (!merged) return main;

  // Organic vertex displacement
  const pos = merged.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n =
      noise(x * 3.0, z * 3.0) * 0.1 + noise(x * 7.0, z * 7.0 + y) * 0.04;
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    pos.setXYZ(
      i,
      x + (x / len) * n,
      y + (y / len) * n * 0.4,
      z + (z / len) * n,
    );
  }

  merged.computeVertexNormals();
  return merged;
}

// ─── Component ─────────────────────────────────────────────────

export default function Obstacles({
  costmapData,
  costmapWidth = 256,
  costmapHeight = 256,
  worldSize = 200,
}: ObstaclesProps) {
  const rocksRef = useRef<THREE.InstancedMesh>(null);
  const cactiRef = useRef<THREE.InstancedMesh>(null);
  const bushRef = useRef<THREE.InstancedMesh>(null);

  const fract = (v: number) => v - Math.floor(v);
  const hash2 = (a: number, b: number) =>
    fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453123);

  // ── Procedural geometries (created once) ────────────────────
  const rockGeo = useMemo(() => createRockGeometry(), []);
  const cactusGeo = useMemo(() => createCactusGeometry(), []);
  const bushGeo = useMemo(() => createBushGeometry(), []);

  // ── Materials ───────────────────────────────────────────────
  const rockMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#b59e78',
        roughness: 0.94,
        metalness: 0.02,
        flatShading: true,
        envMapIntensity: 0.2,
      }),
    [],
  );

  const cactusMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#3a6632',
        roughness: 0.72,
        metalness: 0.0,
        flatShading: false,
        envMapIntensity: 0.18,
      }),
    [],
  );

  const bushMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#6b7942',
        roughness: 0.88,
        metalness: 0.0,
        flatShading: true,
        envMapIntensity: 0.12,
      }),
    [],
  );

  // ── Instance placement ──────────────────────────────────────
  const {
    rockMatrices,
    rockColors,
    cactusMatrices,
    cactusColors,
    bushMatrices,
    bushColors,
  } = useMemo(() => {
    if (!costmapData) {
      return {
        rockMatrices: [] as THREE.Matrix4[],
        rockColors: [] as THREE.Color[],
        cactusMatrices: [] as THREE.Matrix4[],
        cactusColors: [] as THREE.Color[],
        bushMatrices: [] as THREE.Matrix4[],
        bushColors: [] as THREE.Color[],
      };
    }

    const noise2D = createNoise2D(() => 0.5);
    const rockArr: { x: number; z: number; scale: number }[] = [];
    const cactusArr: { x: number; z: number; scale: number }[] = [];
    const bushArr: { x: number; z: number; scale: number }[] = [];

    const step = 2;
    for (let gy = 0; gy < costmapHeight; gy += step) {
      for (let gx = 0; gx < costmapWidth; gx += step) {
        const val = costmapData[gy]?.[gx] ?? 0;
        const [wx, wz] = gridToWorld(
          gx, gy, costmapWidth, costmapHeight, worldSize,
        );
        const jitterX = (hash2(gx, gy) - 0.5) * 1.7;
        const jitterZ = (hash2(gy, gx) - 0.5) * 1.7;
        const px = wx + jitterX;
        const pz = wz + jitterZ;
        const densityNoise = noise2D(px * 0.025, pz * 0.025) * 0.5 + 0.5;

        // ── Rocks: hard obstacle areas ──
        if (val >= 10 && hash2(gx + 9.3, gy - 2.1) > 0.52) {
          const scale =
            0.5 + (noise2D(px * 0.12, pz * 0.12) * 0.5 + 0.5) * 1.8;
          rockArr.push({ x: px, z: pz, scale });
        }

        // ── Cacti: sparse, prefer flatter areas ──
        if (
          val < 7 &&
          densityNoise > 0.52 &&
          hash2(gx * 2.31, gy * 1.47) > 0.88
        ) {
          const scale = 1.2 + hash2(gx * 0.77, gy * 0.33) * 1.6;
          cactusArr.push({ x: px, z: pz, scale });
        }

        // ── Bushes / scrub: moderate density on open ground ──
        if (
          val < 9 &&
          densityNoise > 0.46 &&
          hash2(gx * 1.91, gy * 0.83) > 0.67
        ) {
          const scale = 0.5 + densityNoise * 0.9;
          bushArr.push({ x: px, z: pz, scale });
        }
      }
    }

    const dummy = new THREE.Object3D();

    // ── Rock instances ──
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

      // Warm sandy desert-stone tones
      const cn = noise2D(x * 0.05, z * 0.05) * 0.5 + 0.5;
      rCols.push(
        new THREE.Color().setHSL(
          0.07 + cn * 0.04,
          0.25 + cn * 0.15,
          0.42 + cn * 0.18,
        ),
      );
    }

    // ── Cactus instances ──
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
      cCols.push(
        new THREE.Color().setHSL(
          0.28 + cn * 0.06,
          0.45 + cn * 0.2,
          0.22 + cn * 0.1,
        ),
      );
    }

    // ── Bush / scrub instances ──
    const bMats: THREE.Matrix4[] = [];
    const bCols: THREE.Color[] = [];
    for (const { x, z, scale } of bushArr) {
      const ty = getTerrainHeight(noise2D, x, z, worldSize);
      const height = scale * (0.5 + hash2(x * 0.41, z * 0.77) * 0.8);
      dummy.position.set(x, ty + height * 0.22, z);
      dummy.rotation.set(
        0,
        noise2D(x * 0.09, z * 0.09) * Math.PI,
        noise2D(x * 0.4, z * 0.22) * 0.06,
      );
      dummy.scale.set(
        scale * (0.8 + hash2(x, z) * 0.85),
        height,
        scale * (0.7 + hash2(z, x) * 0.9),
      );
      dummy.updateMatrix();
      bMats.push(dummy.matrix.clone());

      // Dry sage / olive tones
      const hue = 0.12 + hash2(x * 0.3, z * 0.3) * 0.06;
      const sat = 0.3 + hash2(z * 0.4, x * 0.4) * 0.2;
      const lit = 0.22 + hash2(x * 0.61, z * 0.81) * 0.12;
      bCols.push(new THREE.Color().setHSL(hue, sat, lit));
    }

    return {
      rockMatrices: rMats,
      rockColors: rCols,
      cactusMatrices: cMats,
      cactusColors: cCols,
      bushMatrices: bMats,
      bushColors: bCols,
    };
  }, [costmapData, costmapWidth, costmapHeight, worldSize]);

  const rockCount = rockMatrices.length;
  const cactusCount = cactusMatrices.length;
  const bushCount = bushMatrices.length;

  // ── Apply matrices to instanced meshes ──────────────────────
  useEffect(() => {
    const mesh = rocksRef.current;
    if (!mesh || rockCount === 0) return;
    for (let i = 0; i < rockCount; i++) {
      mesh.setMatrixAt(i, rockMatrices[i]);
      mesh.setColorAt(i, rockColors[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [rockCount, rockMatrices, rockColors]);

  useEffect(() => {
    const mesh = cactiRef.current;
    if (!mesh || cactusCount === 0) return;
    for (let i = 0; i < cactusCount; i++) {
      mesh.setMatrixAt(i, cactusMatrices[i]);
      mesh.setColorAt(i, cactusColors[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cactusCount, cactusMatrices, cactusColors]);

  useEffect(() => {
    const mesh = bushRef.current;
    if (!mesh || bushCount === 0) return;
    for (let i = 0; i < bushCount; i++) {
      mesh.setMatrixAt(i, bushMatrices[i]);
      mesh.setColorAt(i, bushColors[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [bushCount, bushMatrices, bushColors]);

  if (rockCount === 0 && cactusCount === 0 && bushCount === 0) return null;

  return (
    <group>
      {rockCount > 0 && (
        <instancedMesh
          ref={rocksRef}
          args={[rockGeo, rockMat, rockCount]}
          castShadow
          receiveShadow
        />
      )}

      {cactusCount > 0 && (
        <instancedMesh
          ref={cactiRef}
          args={[cactusGeo, cactusMat, cactusCount]}
          castShadow
          receiveShadow
        />
      )}

      {bushCount > 0 && (
        <instancedMesh
          ref={bushRef}
          args={[bushGeo, bushMat, bushCount]}
          castShadow
          receiveShadow
        />
      )}
    </group>
  );
}
