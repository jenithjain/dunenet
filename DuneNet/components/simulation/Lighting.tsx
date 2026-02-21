'use client';

import { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Environment, Sky, Clouds, Cloud } from '@react-three/drei';
import * as THREE from 'three';

interface LightingProps {
  sunPosition?: [number, number, number];
  sunIntensity?: number;
  lightSourceBrightness?: number;
  ambientIntensity?: number;
  fogDensity?: number;
  fogColor?: string;
  skyTurbidity?: number;
  skyRayleigh?: number;
  shadowRes?: number;
  shadowRadius?: number;
  shadowBias?: number;
  shadowNormalBias?: number;
  shadowCameraSize?: number;
  shadowFar?: number;
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
  lightSourceBrightness = 1.0,
  ambientIntensity = 0.1,
  fogDensity = 0.0016,
  fogColor = '#cbb389',
  skyTurbidity = 5.2,
  skyRayleigh = 2.75,
  shadowRes = 4096,
  shadowRadius = 2.0,
  shadowBias = -0.00025,
  shadowNormalBias = 0.03,
  shadowCameraSize = 88,
  shadowFar = 300,
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
          bounds={[220, 10, 120]}
          volume={34}
          segments={80}
          color="#ffffff"
          fade={420}
          position={[0, 24, -170]}
          opacity={0.82}
          growth={7}
          speed={0.11}
          concentrate="outside"
        />
        <Cloud
          seed={37}
          bounds={[180, 8, 90]}
          volume={20}
          segments={50}
          color="#f5f0ea"
          fade={360}
          position={[150, 22, -85]}
          opacity={0.62}
          growth={4.5}
          speed={0.08}
          concentrate="random"
        />
        <Cloud
          seed={55}
          bounds={[165, 7, 85]}
          volume={16}
          segments={35}
          color="#faf5ef"
          fade={340}
          position={[-150, 21, -90]}
          opacity={0.48}
          growth={3.8}
          speed={0.07}
        />
        <Cloud
          seed={71}
          bounds={[180, 8, 95]}
          volume={22}
          segments={52}
          color="#f8f4ef"
          fade={370}
          position={[165, 23, 70]}
          opacity={0.6}
          growth={4.6}
          speed={0.08}
          concentrate="outside"
        />
        <Cloud
          seed={88}
          bounds={[185, 8, 100]}
          volume={24}
          segments={56}
          color="#ffffff"
          fade={390}
          position={[-165, 23, 75]}
          opacity={0.62}
          growth={5.0}
          speed={0.09}
          concentrate="outside"
        />
        <Cloud
          seed={96}
          bounds={[210, 9, 120]}
          volume={28}
          segments={64}
          color="#f7f1ea"
          fade={420}
          position={[0, 24, 185]}
          opacity={0.74}
          growth={6.2}
          speed={0.1}
          concentrate="outside"
        />
      </Clouds>

      <directionalLight
        ref={dirLightRef}
        position={sunPosition}
        intensity={sunIntensity * lightSourceBrightness}
        color="#ffecd2"
        castShadow
        shadow-mapSize-width={shadowRes}
        shadow-mapSize-height={shadowRes}
        shadow-camera-near={1}
        shadow-camera-far={shadowFar}
        shadow-camera-left={-shadowCameraSize}
        shadow-camera-right={shadowCameraSize}
        shadow-camera-top={shadowCameraSize}
        shadow-camera-bottom={-shadowCameraSize}
        shadow-bias={shadowBias}
        shadow-normalBias={shadowNormalBias}
        shadow-radius={shadowRadius}
      />

      <directionalLight position={[-60, 20, -50]} intensity={0.32 * lightSourceBrightness} color="#ffcc88" />
      <directionalLight position={[0, 80, 0]} intensity={0.14 * lightSourceBrightness} color="#99bbdd" />
      <hemisphereLight args={['#8ecae6', '#cf9d64', 0.36 * lightSourceBrightness]} />
      <ambientLight intensity={ambientIntensity * lightSourceBrightness} color="#f2dfc5" />
    </>
  );
}
