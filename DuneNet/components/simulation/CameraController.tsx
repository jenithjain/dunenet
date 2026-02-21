'use client';

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { robotState } from './robotState';

interface CameraControllerProps {
  offset?: [number, number, number];
  damping?: number;
  orbitMode?: boolean;
  orbitSpeed?: number;
}

/**
 * Third-person cinematic follow camera with smooth damping.
 * Reads the robot position from the shared robotState each frame.
 */
export default function CameraController({
  offset = [15, 12, 15],
  damping = 0.06,
  orbitMode = false,
  orbitSpeed = 0.12,
}: CameraControllerProps) {
  const { camera } = useThree();
  const targetVec = useRef(new THREE.Vector3(...robotState.position));
  const orbitAngle = useRef(0);
  const initialised = useRef(false);

  // Snap camera on mount so the very first frame shows the scene
  useEffect(() => {
    const t = new THREE.Vector3(...robotState.position);
    targetVec.current.copy(t);
    camera.position.set(t.x + offset[0], t.y + offset[1], t.z + offset[2]);
    camera.lookAt(t);
    initialised.current = true;
  }, []);

  useFrame((_, delta) => {
    if (!initialised.current) return;

    const t = new THREE.Vector3(...robotState.position);
    targetVec.current.lerp(t, damping);

    let desiredPos: THREE.Vector3;

    if (orbitMode) {
      orbitAngle.current += delta * orbitSpeed;
      const radius = Math.sqrt(offset[0] ** 2 + offset[2] ** 2);
      desiredPos = new THREE.Vector3(
        targetVec.current.x + Math.cos(orbitAngle.current) * radius,
        targetVec.current.y + offset[1],
        targetVec.current.z + Math.sin(orbitAngle.current) * radius,
      );
    } else {
      desiredPos = new THREE.Vector3(
        targetVec.current.x + offset[0],
        targetVec.current.y + offset[1],
        targetVec.current.z + offset[2],
      );
    }

    camera.position.lerp(desiredPos, damping * 2);
    camera.lookAt(targetVec.current);
  });

  return null;
}
