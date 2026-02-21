'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

interface PathVisualizerProps {
  path: { x: number; y: number }[];
  gridWidth: number;
  gridHeight: number;
  worldSize?: number;
  getTerrainHeight?: (wx: number, wz: number) => number;
  color?: string;
}

/**
 * Visualizes the planned A* path as a glowing line above the terrain
 */
export default function PathVisualizer({
  path,
  gridWidth,
  gridHeight,
  worldSize = 200,
  getTerrainHeight,
  color = '#22c55e',
}: PathVisualizerProps) {
  const { lineObj, glowLineObj, dotPositions } = useMemo(() => {
    if (!path || path.length < 2) return { lineObj: null, glowLineObj: null, dotPositions: [] };

    const points: THREE.Vector3[] = [];
    const dots: THREE.Vector3[] = [];

    // Subsample the path for smoother rendering
    const step = Math.max(1, Math.floor(path.length / 100));

    for (let i = 0; i < path.length; i += step) {
      const p = path[i];
      const wx = (p.x / gridWidth - 0.5) * worldSize;
      const wz = (p.y / gridHeight - 0.5) * worldSize;
      const wy = getTerrainHeight ? getTerrainHeight(wx, wz) + 1.0 : 1.0;
      points.push(new THREE.Vector3(wx, wy, wz));

      // Place dots at intervals
      if (i % (step * 5) === 0) {
        dots.push(new THREE.Vector3(wx, wy + 0.3, wz));
      }
    }

    // Always include last point
    const last = path[path.length - 1];
    const lwx = (last.x / gridWidth - 0.5) * worldSize;
    const lwz = (last.y / gridHeight - 0.5) * worldSize;
    const lwy = getTerrainHeight ? getTerrainHeight(lwx, lwz) + 1.0 : 1.0;
    points.push(new THREE.Vector3(lwx, lwy, lwz));

    const geo = new THREE.BufferGeometry().setFromPoints(points);

    const mainMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const glowMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3 });

    const mainLine = new THREE.Line(geo, mainMat);
    const glowLine = new THREE.Line(geo.clone(), glowMat);

    return { lineObj: mainLine, glowLineObj: glowLine, dotPositions: dots };
  }, [path, gridWidth, gridHeight, worldSize, getTerrainHeight, color]);

  if (!lineObj) return null;

  return (
    <group>
      {/* Main path line */}
      <primitive object={lineObj} />

      {/* Glowing path line (wider, more transparent) */}
      {glowLineObj && <primitive object={glowLineObj} />}

      {/* Waypoint dots along path */}
      {dotPositions.map((pos, i) => (
        <mesh key={`waypoint-${i}`} position={pos}>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.5}
            transparent
            opacity={0.7}
          />
        </mesh>
      ))}
    </group>
  );
}
