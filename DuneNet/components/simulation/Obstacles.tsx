'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { gridToWorld } from './utils/costmapLoader';

interface ObstaclesProps {
  costmapData: number[][] | null;
  costmapWidth?: number;
  costmapHeight?: number;
  worldSize?: number;
  terrainSegments?: number;
}

/* Must match Terrain.tsx & Scene.tsx getTerrainHeight exactly */
function getTerrainHeight(noise2D: ReturnType<typeof createNoise2D>, x: number, z: number, worldSize: number) {
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

export default function Obstacles({
  costmapData,
  costmapWidth = 256,
  costmapHeight = 256,
  worldSize = 200,
}: ObstaclesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const { count, matrices, colors } = useMemo(() => {
    if (!costmapData) return { count: 0, matrices: [], colors: [] };

    const noise2D = createNoise2D(() => 0.5);
    const obstaclePositions: { x: number; z: number; scale: number }[] = [];

    const step = 3;
    for (let gy = 0; gy < costmapHeight; gy += step) {
      for (let gx = 0; gx < costmapWidth; gx += step) {
        const val = costmapData[gy]?.[gx] ?? 0;
        if (val >= 10) {
          const [wx, wz] = gridToWorld(gx, gy, costmapWidth, costmapHeight, worldSize);

          const scaleNoise = noise2D(wx * 0.1, wz * 0.1) * 0.5 + 0.5;
          const scale = 0.8 + scaleNoise * 2.5;

          obstaclePositions.push({
            x: wx + (noise2D(wx, wz) * 0.5),
            z: wz + (noise2D(wz, wx) * 0.5),
            scale,
          });
        }
      }
    }

    const n = obstaclePositions.length;
    const mats: THREE.Matrix4[] = [];
    const cols: THREE.Color[] = [];
    const dummy = new THREE.Object3D();

    for (let i = 0; i < n; i++) {
      const { x, z, scale } = obstaclePositions[i];

      const terrainY = getTerrainHeight(noise2D, x, z, worldSize);

      dummy.position.set(x, terrainY + scale * 0.3, z);
      dummy.rotation.set(
        noise2D(x * 0.3, z * 0.2) * 0.3,
        noise2D(x * 0.5, z * 0.4) * Math.PI,
        noise2D(x * 0.2, z * 0.6) * 0.2
      );
      dummy.scale.set(
        scale * (0.8 + noise2D(x * 0.7, z * 0.1) * 0.4),
        scale * (0.6 + noise2D(x * 0.1, z * 0.7) * 0.5),
        scale * (0.8 + noise2D(x * 0.4, z * 0.3) * 0.4)
      );
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());

      // Vary rock colors: sandy-brown palette for desert realism
      const colorNoise = noise2D(x * 0.05, z * 0.05) * 0.5 + 0.5;
      const r = 0.35 + colorNoise * 0.2;
      const g = 0.28 + colorNoise * 0.14;
      const b = 0.18 + colorNoise * 0.1;
      cols.push(new THREE.Color(r, g, b));
    }

    return { count: n, matrices: mats, colors: cols };
  }, [costmapData, costmapWidth, costmapHeight, worldSize]);

  // Apply instance matrices and colors
  useMemo(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;

    for (let i = 0; i < count; i++) {
      mesh.setMatrixAt(i, matrices[i]);
      mesh.setColorAt(i, colors[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count, matrices, colors]);

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      castShadow
      receiveShadow
    >
      <dodecahedronGeometry args={[1, 1]} />
      <meshStandardMaterial
        roughness={0.85}
        metalness={0.05}
        flatShading={false}
        envMapIntensity={0.8}
      />
    </instancedMesh>
  );
}