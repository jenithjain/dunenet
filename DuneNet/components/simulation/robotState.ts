/**
 * Shared **mutable** state for the robot.
 *
 * 3-D components (Robot, CameraController, DustParticles) read this directly
 * inside `useFrame` every tick, which avoids calling React `setState` 60 fps
 * and therefore avoids re-rendering the parent (which would corrupt the
 * EffectComposer / PostProcessing pipeline).
 *
 * Only the telemetry UI reads React state, which is synced from here at a
 * low frequency (~5 Hz).
 */
export const robotState = {
  position: [0, 0.6, 0] as [number, number, number],
  rotation: 0,
  moving: false,
};
