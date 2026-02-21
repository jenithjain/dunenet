'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { robotState } from './robotState';

interface RobotProps {
  worldSize?: number;
}

/**
 * Procedural rover robot built from primitives.
 * Reads position / rotation / moving from the shared robotState each frame.
 */
export default function Robot({
  worldSize = 200,
}: RobotProps) {
  const groupRef = useRef<THREE.Group>(null);
  const wheelRefs = useRef<THREE.Mesh[]>([]);
  const prevPos = useRef(new THREE.Vector3(...robotState.position));
  const currentRot = useRef(robotState.rotation);

  // Smooth interpolated position — reads from robotState, NOT from React props
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Smooth position interpolation
    const target = new THREE.Vector3(...robotState.position);
    groupRef.current.position.lerp(target, Math.min(1, delta * 5));

    // Smooth rotation
    let targetRot = robotState.rotation;
    let diff = targetRot - currentRot.current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    currentRot.current += diff * Math.min(1, delta * 5);
    groupRef.current.rotation.y = currentRot.current;

    // Animate wheel rotation when moving
    if (robotState.moving) {
      for (const wheel of wheelRefs.current) {
        if (wheel) {
          wheel.rotation.x += delta * 8;
        }
      }
    }

    prevPos.current.copy(groupRef.current.position);
  });

  const addWheelRef = (index: number) => (ref: THREE.Mesh | null) => {
    if (ref) wheelRefs.current[index] = ref;
  };

  // Body material
  const bodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2a2a2a',
        roughness: 0.4,
        metalness: 0.7,
        envMapIntensity: 1.0,
      }),
    []
  );

  const panelMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1a3a5c',
        roughness: 0.3,
        metalness: 0.5,
        envMapIntensity: 0.8,
      }),
    []
  );

  const wheelMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1a1a1a',
        roughness: 0.7,
        metalness: 0.3,
      }),
    []
  );

  const accentMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#e74c3c',
        roughness: 0.3,
        metalness: 0.6,
        emissive: '#e74c3c',
        emissiveIntensity: 0.15,
      }),
    []
  );

  const antennaMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#888888',
        roughness: 0.3,
        metalness: 0.8,
      }),
    []
  );

  // Wheel positions: 6 wheels (3 per side)
  const wheelPositions: [number, number, number][] = [
    [-1.1, -0.3, -0.85], // front left
    [-1.1, -0.3, 0.85],  // front right
    [0, -0.35, -0.9],    // mid left
    [0, -0.35, 0.9],     // mid right
    [1.1, -0.3, -0.85],  // rear left
    [1.1, -0.3, 0.85],   // rear right
  ];

  return (
    <group ref={groupRef} position={robotState.position} rotation={[0, robotState.rotation, 0]} castShadow>
      {/* Main body chassis */}
      <mesh material={bodyMat} castShadow receiveShadow position={[0, 0.15, 0]}>
        <boxGeometry args={[2.4, 0.5, 1.4]} />
      </mesh>

      {/* Top deck plate */}
      <mesh material={panelMat} castShadow position={[0, 0.45, 0]}>
        <boxGeometry args={[2, 0.12, 1.2]} />
      </mesh>

      {/* Solar panel arrays */}
      <mesh material={panelMat} castShadow position={[-0.3, 0.55, 0]}>
        <boxGeometry args={[1.6, 0.04, 1.0]} />
      </mesh>

      {/* Camera mast */}
      <mesh material={antennaMat} castShadow position={[0.9, 0.7, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.6, 8]} />
      </mesh>

      {/* Camera head */}
      <mesh material={bodyMat} castShadow position={[0.9, 1.05, 0]}>
        <boxGeometry args={[0.2, 0.15, 0.25]} />
      </mesh>

      {/* Camera lens */}
      <mesh material={accentMat} position={[0.8, 1.05, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.08, 12]} />
      </mesh>

      {/* Antenna */}
      <mesh material={antennaMat} castShadow position={[-0.8, 0.7, 0.3]}>
        <cylinderGeometry args={[0.02, 0.015, 0.5, 6]} />
      </mesh>
      <mesh material={accentMat} position={[-0.8, 1.0, 0.3]}>
        <sphereGeometry args={[0.04, 8, 8]} />
      </mesh>

      {/* Signal dish */}
      <mesh material={antennaMat} castShadow position={[-0.8, 0.85, -0.3]} rotation={[0.3, 0, 0.2]}>
        <cylinderGeometry args={[0.15, 0.08, 0.05, 12]} />
      </mesh>

      {/* Front bumper */}
      <mesh material={bodyMat} castShadow position={[-1.25, 0, 0]}>
        <boxGeometry args={[0.15, 0.3, 1.5]} />
      </mesh>

      {/* Rear bumper */}
      <mesh material={bodyMat} castShadow position={[1.25, 0, 0]}>
        <boxGeometry args={[0.15, 0.3, 1.2]} />
      </mesh>

      {/* Status LEDs */}
      {[-0.4, 0, 0.4].map((z, i) => (
        <mesh key={`led-${i}`} position={[-1.34, 0.1, z]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial
            color={i === 1 ? '#22c55e' : '#3b82f6'}
            emissive={i === 1 ? '#22c55e' : '#3b82f6'}
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}

      {/* Wheels */}
      {wheelPositions.map((pos, i) => (
        <group key={`wheel-${i}`} position={pos}>
          {/* Suspension arm */}
          <mesh material={antennaMat} position={[0, 0.15, pos[2] > 0 ? -0.15 : 0.15]}>
            <boxGeometry args={[0.15, 0.08, 0.3]} />
          </mesh>
          {/* Wheel */}
          <mesh
            ref={addWheelRef(i)}
            material={wheelMat}
            castShadow
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.3, 0.3, 0.2, 16]} />
          </mesh>
          {/* Wheel hub */}
          <mesh
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, 0, pos[2] > 0 ? 0.11 : -0.11]}
          >
            <cylinderGeometry args={[0.12, 0.12, 0.02, 8]} />
            <meshStandardMaterial color="#555" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* Ground shadow hint */}
      <mesh position={[0, -0.55, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3, 2]} />
        <shadowMaterial opacity={0.3} />
      </mesh>
    </group>
  );
}
