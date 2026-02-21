'use client';

import { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Environment, Sky, Clouds, Cloud } from '@react-three/drei';
import * as THREE from 'three';

interface LightingProps {
  sunPosition?: [number, number, number];
  sunIntensity?: number;
  ambientIntensity?: number;
  fogDensity?: number;
  fogColor?: string;
  skyTurbidity?: number;
  skyRayleigh?: number;
  shadowRes?: number;
}

/**
 * Photorealistic desert lighting rig
 * - Physical sky dome as background
 * - HDRI env for PBR reflections
 * - Directional sun with configurable soft shadows
 * - Hemisphere sky/ground bounce
 * - Exponential depth fog for atmosphere
 * All parameters exposed for the settings panel.
 */
export default function Lighting({
  sunPosition = [105, 58, 32],
  sunIntensity = 3.25,
  ambientIntensity = 0.1,
  fogDensity = 0.0016,
  fogColor = '#cbb389',
  skyTurbidity = 2.8,
  skyRayleigh = 1.55,
  shadowRes = 4096,
}: LightingProps) {
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();

  useEffect(() => {
    scene.fog = new THREE.FogExp2(fogColor, fogDensity);
    return () => { scene.fog = null; };
  }, [scene, fogDensity, fogColor]);

  return (
    <>
      <Sky
        sunPosition={sunPosition}
        turbidity={skyTurbidity}
        rayleigh={skyRayleigh}
        mieCoefficient={0.0025}
        mieDirectionalG={0.8}
        distance={450000}
      />

      <Environment preset="park" background={false} environmentIntensity={0.36} />

      {/* Sparse cumulus cloud layer */}
      <Clouds limit={180} range={150}>
        <Cloud
          seed={12}
          bounds={[155, 10, 155]}
          volume={52}
          segments={70}
          color="#ffffff"
          fade={200}
          position={[-8, 76, -18]}
          opacity={0.62}
          growth={7}
          speed={0.045}
          concentrate="outside"
        />
        <Cloud
          seed={37}
          bounds={[130, 8, 130]}
          volume={28}
          segments={52}
          color="#f8f8f8"
          fade={175}
          position={[52, 82, 24]}
          opacity={0.52}
          growth={5}
          speed={0.035}
          concentrate="random"
        />
        <Cloud
          seed={55}
          bounds={[110, 7, 110]}
          volume={20}
          segments={42}
          color="#f6f6f6"
          fade={165}
          position={[-62, 70, 42]}
          opacity={0.42}
          growth={4}
          speed={0.03}
        />
      </Clouds>

      <directionalLight
        ref={dirLightRef}
        position={sunPosition}
        intensity={sunIntensity}
        color="#ffecd2"
        castShadow
        shadow-mapSize-width={shadowRes}
        shadow-mapSize-height={shadowRes}
        shadow-camera-near={1}
        shadow-camera-far={250}
        shadow-camera-left={-72}
        shadow-camera-right={72}
        shadow-camera-top={72}
        shadow-camera-bottom={-72}
        shadow-bias={-0.0002}
        shadow-normalBias={0.03}
      />

      <directionalLight position={[-60, 20, -50]} intensity={0.45} color="#ffcc88" />
      <directionalLight position={[0, 80, 0]} intensity={0.19} color="#99bbdd" />
      <hemisphereLight args={['#8ecae6', '#cf9d64', 0.42]} />
      <ambientLight intensity={ambientIntensity} color="#f2dfc5" />
    </>
  );
}
