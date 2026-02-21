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
export default function Lighting({ sunPosition = [100, 50, 60] }: LightingProps) {
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();

  // Set scene fog via imperative API so it works with Sky
  useEffect(() => {
    scene.fog = new THREE.FogExp2('#d4b88c', 0.002);
    return () => { scene.fog = null; };
  }, [scene]);

  return (
    <>
      {/* Physical sun sky — rendered as the actual scene background */}
      <Sky
        sunPosition={sunPosition}
        turbidity={10}
        rayleigh={2.2}
        mieCoefficient={0.005}
        mieDirectionalG={0.85}
        distance={450000}
      />

      {/* HDRI env map for realistic PBR reflections on materials (not background) */}
      <Environment preset="sunset" background={false} environmentIntensity={0.6} />

      {/* ── Main sun directional light ── */}
      <directionalLight
        ref={dirLightRef}
        position={sunPosition}
        intensity={4.5}
        color="#ffecd2"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={250}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-bias={-0.0003}
        shadow-normalBias={0.04}
      />

      {/* Warm rim / fill light from low angle opposite side */}
      <directionalLight
        position={[-60, 20, -50]}
        intensity={0.7}
        color="#ffcc88"
      />

      {/* Cool sky bounce fill from above */}
      <directionalLight
        position={[0, 80, 0]}
        intensity={0.25}
        color="#99bbdd"
      />

      {/* Hemisphere: sky blue on top, warm sand on bottom */}
      <hemisphereLight
        args={['#8ecae6', '#d4a76a', 0.5]}
      />

      {/* Subtle ambient so nothing is pitch black */}
      <ambientLight intensity={0.15} color="#f5e0c0" />
    </>
  );
}
