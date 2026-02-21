'use client';

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { robotState } from './robotState';

interface CameraControllerProps {
  offset?: [number, number, number];
  damping?: number;
  cameraMode?: 'follow' | 'orbit' | 'fpv';
  orbitSpeed?: number;
  fov?: number;
  followDistance?: number;
  followHeight?: number;
}

/**
 * Multi-mode camera controller:
 * - follow: Third-person cinematic follow
 * - orbit: Auto-orbiting view
 * - fpv: First-person from rover camera mast
 */
export default function CameraController({
  offset = [15, 12, 15],
  damping = 0.06,
  cameraMode = 'follow',
  orbitSpeed = 0.12,
  fov = 50,
  followDistance = 15,
  followHeight = 12,
}: CameraControllerProps) {
  const { camera } = useThree();
  const targetVec = useRef(new THREE.Vector3(...robotState.position));
  const orbitAngle = useRef(0);
  const initialised = useRef(false);
  const currentFov = useRef(fov);
  const jitterClock = useRef(0);

  // Snap camera on mount
  useEffect(() => {
    const t = new THREE.Vector3(...robotState.position);
    targetVec.current.copy(t);
    camera.position.set(t.x + offset[0], t.y + offset[1], t.z + offset[2]);
    camera.lookAt(t);
    initialised.current = true;
  }, []);

  useFrame((_, delta) => {
    if (!initialised.current) return;
    jitterClock.current += delta;

    const t = new THREE.Vector3(...robotState.position);
    const rot = robotState.rotation;

    // Smooth FOV transitions
    const targetFov = cameraMode === 'fpv' ? 85 : fov;
    currentFov.current += (targetFov - currentFov.current) * 0.05;
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = currentFov.current;
      camera.updateProjectionMatrix();
    }

    const jitter = new THREE.Vector3(
      Math.sin(jitterClock.current * 0.7) * 0.12,
      Math.sin(jitterClock.current * 1.1) * 0.08,
      Math.cos(jitterClock.current * 0.9) * 0.12,
    );

    if (cameraMode === 'fpv') {
      // First person — camera at the rover's camera mast position
      // Robot's forward is -X in local space
      const fpvHeight = 1.4; // Camera mast height
      const fpvForwardOffset = 0.9; // Slightly in front of mast

      // Calculate forward direction based on robot rotation
      const forwardX = -Math.cos(rot);
      const forwardZ = Math.sin(rot);

      const eyePos = new THREE.Vector3(
        t.x + forwardX * fpvForwardOffset,
        t.y + fpvHeight,
        t.z + forwardZ * fpvForwardOffset,
      );

      // Look ahead of the rover
      const lookAhead = 10;
      const lookTarget = new THREE.Vector3(
        t.x + forwardX * lookAhead,
        t.y + fpvHeight * 0.7,
        t.z + forwardZ * lookAhead,
      );

      camera.position.lerp(eyePos.add(jitter.multiplyScalar(0.6)), damping * 5);
      targetVec.current.lerp(lookTarget, damping * 4);
      camera.lookAt(targetVec.current);
    } else if (cameraMode === 'orbit') {
      targetVec.current.lerp(t, damping);
      orbitAngle.current += delta * orbitSpeed;
      const radius = Math.sqrt(followDistance ** 2 + followDistance ** 2);
      const desiredPos = new THREE.Vector3(
        targetVec.current.x + Math.cos(orbitAngle.current) * radius,
        targetVec.current.y + followHeight,
        targetVec.current.z + Math.sin(orbitAngle.current) * radius,
      );
      camera.position.lerp(desiredPos.add(jitter), damping * 2);
      camera.lookAt(targetVec.current);
    } else {
      // Follow mode
      targetVec.current.lerp(t, damping);

      // Position camera behind and above robot based on its heading
      const behindX = Math.cos(rot) * followDistance;
      const behindZ = -Math.sin(rot) * followDistance;

      const desiredPos = new THREE.Vector3(
        targetVec.current.x + behindX,
        targetVec.current.y + followHeight,
        targetVec.current.z + behindZ,
      );
      camera.position.lerp(desiredPos.add(jitter), damping * 2);
      camera.lookAt(targetVec.current);
    }
  });

  return null;
}
