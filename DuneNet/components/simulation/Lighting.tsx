'use client';

import { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Environment, Sky } from '@react-three/drei';
import * as THREE from 'three';

interface LightingProps {
  sunPosition?: [number, number, number];
}

/**
 * Photorealistic desert lighting rig
 * - Physical sky dome as background
 * - HDRI env for PBR reflections
 * - Directional sun with 4K soft shadows
 * - Hemisphere sky/ground bounce
 * - Exponential depth fog for atmosphere
 */
export default function Lighting({ sunPosition = [105, 58, 32] }: LightingProps) {
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();

  // Set scene fog via imperative API so it works with Sky
  useEffect(() => {
    scene.fog = new THREE.FogExp2('#cbb389', 0.0016);
    return () => { scene.fog = null; };
  }, [scene]);

  return (
    <>
      {/* Physical sun sky — rendered as the actual scene background */}
      <Sky
        sunPosition={sunPosition}
        turbidity={5.2}
        rayleigh={2.75}
        mieCoefficient={0.004}
        mieDirectionalG={0.83}
        distance={450000}
      />

      {/* HDRI env map for realistic PBR reflections on materials (not background) */}
      <Environment preset="park" background={false} environmentIntensity={0.36} />

      {/* ── Main sun directional light ── */}
      <directionalLight
        ref={dirLightRef}
        position={sunPosition}
        intensity={3.25}
        color="#ffecd2"
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-near={1}
        shadow-camera-far={250}
        shadow-camera-left={-72}
        shadow-camera-right={72}
        shadow-camera-top={72}
        shadow-camera-bottom={-72}
        shadow-bias={-0.0002}
        shadow-normalBias={0.03}
      />

      {/* Warm rim / fill light from low angle opposite side */}
      <directionalLight
        position={[-60, 20, -50]}
        intensity={0.45}
        color="#ffcc88"
      />

      {/* Cool sky bounce fill from above */}
      <directionalLight
        position={[0, 80, 0]}
        intensity={0.19}
        color="#99bbdd"
      />

      {/* Hemisphere: sky blue on top, warm sand on bottom */}
      <hemisphereLight
        args={['#8ecae6', '#cf9d64', 0.42]}
      />

      {/* Subtle ambient so nothing is pitch black */}
      <ambientLight intensity={0.1} color="#f2dfc5" />
    </>
  );
}
