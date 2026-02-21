'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

interface GoalMarkerProps {
  position: [number, number, number];
  color?: string;
}

/**
 * Animated goal marker that floats above the target location
 */
export default function GoalMarker({ position, color = '#ef4444' }: GoalMarkerProps) {
  return (
    <group position={position}>
      {/* Beacon pillar */}
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 6, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Ground ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <ringGeometry args={[1.5, 2, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Inner ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
        <ringGeometry args={[0.5, 0.8, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Floating diamond */}
      <mesh position={[0, 6.5, 0]} rotation={[0, 0, Math.PI / 4]}>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}
