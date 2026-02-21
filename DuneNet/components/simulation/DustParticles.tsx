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
  stormStrength?: number;
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
  stormStrength = 1.0,
}: DustParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const fineRef = useRef<THREE.Points>(null);
  const stormRef = useRef<THREE.Points>(null);

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
  const fineCount = Math.floor(count * 0.65);
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

  // Storm layer for high intensity scenes
  const stormCount = Math.max(0, Math.floor(count * Math.max(0, stormStrength - 0.7) * 0.6));
  const { stormPositions, stormVelocities } = useMemo(() => {
    const pos = new Float32Array(stormCount * 3);
    const vel = new Float32Array(stormCount * 3);

    for (let i = 0; i < stormCount; i++) {
      const i3 = i * 3;
      pos[i3] = (Math.random() - 0.5) * 200;
      pos[i3 + 1] = Math.random() * 30 + 2;
      pos[i3 + 2] = (Math.random() - 0.5) * 200;

      vel[i3] = (Math.random() - 0.2) * 3.2;
      vel[i3 + 1] = (Math.random() - 0.5) * 0.22;
      vel[i3 + 2] = (Math.random() - 0.4) * 1.4;
    }

    return { stormPositions: pos, stormVelocities: vel };
  }, [stormCount]);

  useFrame((_, delta) => {
    const emitterPosition = robotState.position;
    const ws = windStrength;
    const ss = stormStrength;

    // Main particles
    if (pointsRef.current) {
      const posAttr = pointsRef.current.geometry.attributes.position;
      const arr = posAttr.array as Float32Array;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        arr[i3] += velocities[i3] * delta * 2.4 * ws * (0.85 + ss * 0.25);
        arr[i3 + 1] += velocities[i3 + 1] * delta * (1.25 + ss * 0.35);
        arr[i3 + 2] += velocities[i3 + 2] * delta * 2.25 * ws * (0.85 + ss * 0.3);

        if (Math.abs(arr[i3]) > 110 || arr[i3 + 1] > 30 || arr[i3 + 1] < 0) {
          arr[i3] = emitterPosition[0] + (Math.random() - 0.5) * 90;
          arr[i3 + 1] = Math.random() * 10 + 0.4;
          arr[i3 + 2] = emitterPosition[2] + (Math.random() - 0.5) * 90;
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
        arr[i3] += fineVelocities[i3] * delta * 2.1 * ws * (0.85 + ss * 0.3);
        arr[i3 + 1] += fineVelocities[i3 + 1] * delta * (0.9 + ss * 0.25);
        arr[i3 + 2] += fineVelocities[i3 + 2] * delta * 1.8 * ws * (0.85 + ss * 0.3);

        if (Math.abs(arr[i3]) > 90 || arr[i3 + 1] > 10 || arr[i3 + 1] < 0) {
          arr[i3] = emitterPosition[0] + (Math.random() - 0.5) * 70;
          arr[i3 + 1] = Math.random() * 4 + 0.1;
          arr[i3 + 2] = emitterPosition[2] + (Math.random() - 0.5) * 70;
        }
      }
      posAttr.needsUpdate = true;
    }

    // Storm particles
    if (stormRef.current && stormCount > 0) {
      const posAttr = stormRef.current.geometry.attributes.position;
      const arr = posAttr.array as Float32Array;

      for (let i = 0; i < stormCount; i++) {
        const i3 = i * 3;
        arr[i3] += stormVelocities[i3] * delta * 2.8 * ws * ss;
        arr[i3 + 1] += stormVelocities[i3 + 1] * delta * (1.3 + ss * 0.5);
        arr[i3 + 2] += stormVelocities[i3 + 2] * delta * 2.6 * ws * ss;

        if (Math.abs(arr[i3]) > 140 || arr[i3 + 1] > 40 || arr[i3 + 1] < 1) {
          arr[i3] = emitterPosition[0] + (Math.random() - 0.5) * 120;
          arr[i3 + 1] = Math.random() * 20 + 4;
          arr[i3 + 2] = emitterPosition[2] + (Math.random() - 0.5) * 120;
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
          size={size * (0.9 + stormStrength * 0.15)}
          color="#c7ad89"
          transparent
          opacity={Math.min(0.98, opacity * (0.85 + stormStrength * 0.25))}
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
          size={size * 0.55 * (0.9 + stormStrength * 0.2)}
          color="#d4c4a0"
          transparent
          opacity={Math.min(0.75, opacity * (0.5 + stormStrength * 0.18))}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </points>

      {/* Storm haze layer */}
      {stormCount > 0 && (
        <points ref={stormRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[stormPositions, 3]} count={stormCount} />
          </bufferGeometry>
          <pointsMaterial
            size={size * (1.4 + stormStrength * 0.5)}
            color="#d0b690"
            transparent
            opacity={Math.min(0.6, opacity * 0.55 * stormStrength)}
            sizeAttenuation
            depthWrite={false}
            blending={THREE.NormalBlending}
          />
        </points>
      )}
    </group>
  );
}
