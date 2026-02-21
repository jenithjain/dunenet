'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { robotState } from './robotState';

interface DustParticlesProps {
  count?: number;
  opacity?: number;
  size?: number;
  windStrength?: number;
}

/**
 * Ambient wind-blown dust particles for atmosphere.
 * Reads emitter position and active flag from the shared robotState.
 * Now with multiple layers for volumetric depth.
 */
export default function DustParticles({
  count = 850,
  opacity = 0.18,
  size = 0.085,
  windStrength = 1.0,
}: DustParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const fineRef = useRef<THREE.Points>(null);

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      pos[i3] = (Math.random() - 0.5) * 150;
      pos[i3 + 1] = Math.random() * 20 + 0.5;
      pos[i3 + 2] = (Math.random() - 0.5) * 150;

      vel[i3] = (Math.random() - 0.3) * 2;
      vel[i3 + 1] = (Math.random() - 0.5) * 0.16;
      vel[i3 + 2] = (Math.random() - 0.5) * 0.75;
    }

    return { positions: pos, velocities: vel };
  }, [count]);

  // Secondary fine dust layer — smaller, denser, closer to ground
  const fineCount = Math.floor(count * 0.6);
  const { finePositions, fineVelocities } = useMemo(() => {
    const pos = new Float32Array(fineCount * 3);
    const vel = new Float32Array(fineCount * 3);

    for (let i = 0; i < fineCount; i++) {
      const i3 = i * 3;
      pos[i3] = (Math.random() - 0.5) * 120;
      pos[i3 + 1] = Math.random() * 6 + 0.2;
      pos[i3 + 2] = (Math.random() - 0.5) * 120;

      vel[i3] = (Math.random() - 0.3) * 1.5;
      vel[i3 + 1] = (Math.random() - 0.5) * 0.08;
      vel[i3 + 2] = (Math.random() - 0.5) * 0.5;
    }

    return { finePositions: pos, fineVelocities: vel };
  }, [fineCount]);

  useFrame((_, delta) => {
    const emitterPosition = robotState.position;
    const ws = windStrength;

    // Main particles
    if (pointsRef.current) {
      const posAttr = pointsRef.current.geometry.attributes.position;
      const arr = posAttr.array as Float32Array;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        arr[i3] += velocities[i3] * delta * 2.2 * ws;
        arr[i3 + 1] += velocities[i3 + 1] * delta * 1.4;
        arr[i3 + 2] += velocities[i3 + 2] * delta * 2.1 * ws;

        if (Math.abs(arr[i3]) > 100 || arr[i3 + 1] > 25 || arr[i3 + 1] < 0) {
          arr[i3] = emitterPosition[0] + (Math.random() - 0.5) * 80;
          arr[i3 + 1] = Math.random() * 8 + 0.3;
          arr[i3 + 2] = emitterPosition[2] + (Math.random() - 0.5) * 80;
        }
      }
      posAttr.needsUpdate = true;
    }

    // Fine particles
    if (fineRef.current) {
      const posAttr = fineRef.current.geometry.attributes.position;
      const arr = posAttr.array as Float32Array;

      for (let i = 0; i < fineCount; i++) {
        const i3 = i * 3;
        arr[i3] += fineVelocities[i3] * delta * 1.8 * ws;
        arr[i3 + 1] += fineVelocities[i3 + 1] * delta * 1.0;
        arr[i3 + 2] += fineVelocities[i3 + 2] * delta * 1.6 * ws;

        if (Math.abs(arr[i3]) > 80 || arr[i3 + 1] > 8 || arr[i3 + 1] < 0) {
          arr[i3] = emitterPosition[0] + (Math.random() - 0.5) * 60;
          arr[i3 + 1] = Math.random() * 3 + 0.1;
          arr[i3 + 2] = emitterPosition[2] + (Math.random() - 0.5) * 60;
        }
      }
      posAttr.needsUpdate = true;
    }
  });

  if (opacity <= 0.001) return null;

  return (
    <group>
      {/* Main dust layer */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
        </bufferGeometry>
        <pointsMaterial
          size={size}
          color="#c7ad89"
          transparent
          opacity={opacity}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </points>

      {/* Fine ground-hugging haze */}
      <points ref={fineRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[finePositions, 3]} count={fineCount} />
        </bufferGeometry>
        <pointsMaterial
          size={size * 0.6}
          color="#d4c4a0"
          transparent
          opacity={opacity * 0.5}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </points>
    </group>
  );
}
