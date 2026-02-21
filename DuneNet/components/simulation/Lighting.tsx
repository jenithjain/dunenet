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
  skyTurbidity = 5.2,
  skyRayleigh = 2.75,
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
        mieCoefficient={0.005}
        mieDirectionalG={0.85}
        distance={450000}
      />

      <Environment preset="park" background={false} environmentIntensity={0.36} />

      {/* Volumetric cloud layer */}
      <Clouds material={THREE.MeshBasicMaterial} limit={400}>
        <Cloud
          seed={12}
          bounds={[120, 8, 120]}
          volume={40}
          segments={80}
          color="#ffffff"
          fade={250}
          position={[0, 65, 0]}
          opacity={0.85}
          growth={6}
          speed={0.15}
          concentrate="outside"
        />
        <Cloud
          seed={37}
          bounds={[100, 5, 100]}
          volume={25}
          segments={50}
          color="#f5f0ea"
          fade={200}
          position={[40, 72, -30]}
          opacity={0.65}
          growth={4}
          speed={0.1}
          concentrate="random"
        />
        <Cloud
          seed={55}
          bounds={[80, 4, 80]}
          volume={18}
          segments={35}
          color="#faf5ef"
          fade={180}
          position={[-50, 60, 40]}
          opacity={0.5}
          growth={3}
          speed={0.08}
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
