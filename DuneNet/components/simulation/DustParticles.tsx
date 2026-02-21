'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { robotState } from './robotState';

interface DustParticlesProps {
  count?: number;
}

/**
 * Ambient wind-blown dust particles for atmosphere.
 * Reads emitter position and active flag from the shared robotState.
 */
export default function DustParticles({
  count = 500,
}: DustParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      pos[i3] = (Math.random() - 0.5) * 150;
      pos[i3 + 1] = Math.random() * 20 + 0.5;
      pos[i3 + 2] = (Math.random() - 0.5) * 150;

      vel[i3] = (Math.random() - 0.3) * 2; // wind direction bias
      vel[i3 + 1] = (Math.random() - 0.5) * 0.3;
      vel[i3 + 2] = (Math.random() - 0.5) * 1;
    }

    return { positions: pos, velocities: vel };
  }, [count]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;

    const active = robotState.moving;
    const emitterPosition = robotState.position;

    const posAttr = pointsRef.current.geometry.attributes.position;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      arr[i3] += velocities[i3] * delta * 3;
      arr[i3 + 1] += velocities[i3 + 1] * delta * 2;
      arr[i3 + 2] += velocities[i3 + 2] * delta * 3;

      // Reset particles that drift too far
      if (Math.abs(arr[i3]) > 100 || arr[i3 + 1] > 25 || arr[i3 + 1] < 0) {
        arr[i3] = emitterPosition[0] + (Math.random() - 0.5) * 80;
        arr[i3 + 1] = Math.random() * 8 + 0.3;
        arr[i3 + 2] = emitterPosition[2] + (Math.random() - 0.5) * 80;
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        color="#d4b896"
        transparent
        opacity={0.35}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
