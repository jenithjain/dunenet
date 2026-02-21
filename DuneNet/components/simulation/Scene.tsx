'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdaptiveDpr, AdaptiveEvents, Preload, Stats } from '@react-three/drei';
import {
  EffectComposer,
  Bloom,
  ToneMapping,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';

import Terrain from './Terrain';
import Lighting from './Lighting';
import Obstacles from './Obstacles';
import Robot from './Robot';
import PathVisualizer from './PathVisualizer';
import CameraController from './CameraController';
import GoalMarker from './GoalMarker';
import DustParticles from './DustParticles';
import MiniMap from './MiniMap';
import SettingsPanel from './SettingsPanel';
import LiveInferencePanel, { type InferenceResult } from './LiveInferencePanel';
import RoverChat from './RoverChat';
import {
  type SimSettings,
  DEFAULT_SETTINGS,
  simSettings,
  sunPositionFromAngles,
} from './simulationSettings';

import { astar, smoothPath, type PathPoint } from './utils/astar';
import {
  generateProceduralCostmap,
  gridToWorld,
  worldToGrid,
  type CostmapData,
} from './utils/costmapLoader';
import { createNoise2D } from 'simplex-noise';import { robotState } from './robotState';
// ── Terrain height helper (must match Terrain.tsx noise) ──
const terrainNoise = createNoise2D(() => 0.5);
function getTerrainHeight(
  wx: number,
  wz: number,
  worldSize: number = 320,
  terrainRelief: number = 1,
  terrainHeightOffset: number = 0,
): number {
  const relief = THREE.MathUtils.clamp(terrainRelief, 0.4, 3.5);
  const reliefCurve = Math.pow(relief, 1.65);
  const reliefBoost = Math.max(0, reliefCurve - 1);

  let h = 0;
  h += terrainNoise(wx * 0.0025, wz * 0.0025) * (2.2 * (0.72 + reliefCurve * 0.42));
  h += terrainNoise(wx * 0.008, wz * 0.008) * (1.1 * (0.74 + reliefCurve * 0.48));
  h += terrainNoise(wx * 0.03, wz * 0.03) * (0.6 * (0.64 + reliefCurve * 0.72));
  h += terrainNoise(wx * 0.12, wz * 0.12) * (0.22 * (0.58 + reliefCurve * 1.05));

  const ridgeRaw = 1 - Math.abs(terrainNoise(wx * 0.0055, wz * 0.0055));
  const ridge = ridgeRaw * ridgeRaw;
  h += ridge * reliefBoost * 4.8;

  const slope = (wz / (worldSize * 0.5)) * 1.4 * (0.85 + reliefCurve * 0.32);
  h += slope;

  const d = Math.sqrt(wx * wx + wz * wz) / (worldSize * 0.5);
  h *= Math.max(0, 1 - d * d * 0.55);
  return h + terrainHeightOffset;
}

// ── Robot movement controller (inside Canvas) ──
// Writes to the shared robotState every frame — no React setState.
function RobotController({
  costmap,
  path,
  worldSize,
  terrainRelief,
  terrainHeightOffset,
  onReachedGoal,
  resetTrigger,
  liveInferenceMode,
}: {
  costmap: CostmapData;
  path: PathPoint[];
  worldSize: number;
  terrainRelief: number;
  terrainHeightOffset: number;
  onReachedGoal: () => void;
  resetTrigger: number;
  liveInferenceMode: boolean;
}) {
  const pathIdx = useRef(0);
  const currentPos = useRef<[number, number, number]>([0, 0, 0]);
  const targetPos = useRef<[number, number, number]>([0, 0, 0]);
  const reached = useRef(false);

  // Reset when path or reset trigger changes
  useEffect(() => {
    reached.current = false;
    if (path.length > 0) {
      if (liveInferenceMode) {
        // Live inference: snap to nearest path point without teleporting
        let minDist = Infinity;
        let closest = 0;
        const [rx, , rz] = robotState.position;
        for (let i = 0; i < Math.min(path.length, 50); i++) {
          const [wx, wz] = gridToWorld(path[i].x, path[i].y, costmap.width, costmap.height, worldSize);
          const dist = (wx - rx) ** 2 + (wz - rz) ** 2;
          if (dist < minDist) { minDist = dist; closest = i; }
        }
        pathIdx.current = closest;
      } else {
        pathIdx.current = 0;
        const first = path[0];
        const [wx, wz] = gridToWorld(first.x, first.y, costmap.width, costmap.height, worldSize);
        const wy = getTerrainHeight(wx, wz, worldSize, terrainRelief, terrainHeightOffset);
        currentPos.current = [wx, wy + 0.6, wz];
        robotState.position = [wx, wy + 0.6, wz];
        robotState.rotation = 0;
        robotState.moving = false;
      }
    }
  }, [path, resetTrigger, terrainRelief, terrainHeightOffset, liveInferenceMode]);

  useFrame((_, delta) => {
    if (path.length < 2 || reached.current) {
      robotState.moving = false;
      robotState.pathIdx = pathIdx.current;
      robotState.pathLength = path.length;
      return;
    }

    // Move smoothly along path points
    const speed = simSettings.robotSpeed;

    let idx = pathIdx.current;
    if (idx >= path.length - 1) {
      reached.current = true;
      robotState.moving = false;
      onReachedGoal();
      return;
    }

    // Slight look-ahead for smoother steering, but advance index one-by-one
    const lookAhead = Math.max(1, Math.floor(path.length / 350));
    const tp = path[Math.min(idx + lookAhead, path.length - 1)];
    const [twx, twz] = gridToWorld(tp.x, tp.y, costmap.width, costmap.height, worldSize);
    const twy = getTerrainHeight(twx, twz, worldSize, terrainRelief, terrainHeightOffset);
    targetPos.current = [twx, twy + 0.6, twz];

    // Direction
    const dx = targetPos.current[0] - currentPos.current[0];
    const dz = targetPos.current[2] - currentPos.current[2];
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.35) {
      pathIdx.current = Math.min(idx + 1, path.length - 1);
      return;
    }

    const moveStep = Math.min(speed * delta, dist);
    const nx = currentPos.current[0] + (dx / dist) * moveStep;
    const nz = currentPos.current[2] + (dz / dist) * moveStep;
    const terrainY = getTerrainHeight(nx, nz, worldSize, terrainRelief, terrainHeightOffset) + 0.6;
    const ny = THREE.MathUtils.lerp(currentPos.current[1], terrainY, Math.min(1, delta * 6));

    currentPos.current = [nx, ny, nz];
    // Rover's local "forward" is along negative-X, so use atan2(dz, -dx)
    const rot = Math.atan2(dz, -dx);

    // Write directly to shared mutable state — NO setState here!
    robotState.position = [nx, ny, nz];
    robotState.rotation = rot;
    robotState.moving = true;
    robotState.pathIdx = pathIdx.current;
    robotState.pathLength = path.length;
  });

  return null;
}

// ── Throttled UI sync (inside Canvas) ──
// Reads robotState at ~5 Hz and pushes it into React state for telemetry UI.
function UISync({
  onSync,
}: {
  onSync: (pos: [number, number, number], rot: number, moving: boolean, pathIdx: number, pathLength: number) => void;
}) {
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    elapsed.current += delta;
    if (elapsed.current > 0.2) {
      elapsed.current = 0;
      onSync(
        [...robotState.position] as [number, number, number],
        robotState.rotation,
        robotState.moving,
        robotState.pathIdx,
        robotState.pathLength,
      );
    }
  });
  return null;
}

// ── Post Processing (lightweight – no SSAO to avoid context loss) ──
function PostProcessing({ bloomIntensity = 0.035 }: { bloomIntensity?: number }) {
  const { gl } = useThree();
  const attrs = gl.getContextAttributes?.();

  if (!attrs || gl.isContextLost?.()) return null;

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={0.93}
        luminanceSmoothing={0.25}
        mipmapBlur
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

// ── Main Scene ──
export interface SimulationSceneProps {
  className?: string;
}

export default function SimulationScene({ className }: SimulationSceneProps) {
  const WORLD_SIZE = 320;
  const GRID_SIZE = 128; // Keep 128 for performance

  // State
  const [costmap, setCostmap] = useState<CostmapData | null>(null);
  const [path, setPath] = useState<PathPoint[]>([]);
  const [robotPos, setRobotPos] = useState<[number, number, number]>([0, 2, 0]);
  const [robotRot, setRobotRot] = useState(0);
  const [robotMoving, setRobotMoving] = useState(false);
  const [robotPathIdx, setRobotPathIdx] = useState(0);
  const [robotPathLength, setRobotPathLength] = useState(0);
  const [resetTrigger, setResetTrigger] = useState(0);

  const [showSegmentation, setShowSegmentation] = useState(false);
  const [showCostmap, setShowCostmap] = useState(false);

  // ── Live inference state ──
  const [liveInferenceEnabled, setLiveInferenceEnabled] = useState(false);
  const [inferenceData, setInferenceData] = useState<InferenceResult | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [inferenceCount, setInferenceCount] = useState(0);
  const [isInferencing, setIsInferencing] = useState(false);
  const [inferenceError, setInferenceError] = useState<string | null>(null);
  const [showOverlayUi, setShowOverlayUi] = useState(true);
  const [contextLost, setContextLost] = useState(false);
  const [gpuSafeMode, setGpuSafeMode] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [hasReachedGoal, setHasReachedGoal] = useState(false);
  const [simStatus, setSimStatus] = useState('Initializing...');

  // ── Simulation settings ──
  const [settings, setSettingsState] = useState<SimSettings>({ ...DEFAULT_SETTINGS });
  const [densityKey, setDensityKey] = useState(0);

  const contextRestoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasListenersCleanupRef = useRef<(() => void) | null>(null);
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const liveStartRef = useRef<PathPoint>({ x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) });

  // Merge settings patch & sync mutable store
  const updateSettings = useCallback((patch: Partial<SimSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      Object.assign(simSettings, next);
      return next;
    });
  }, []);

  // Derived sun position
  const sunPos = useMemo<[number, number, number]>(
    () => sunPositionFromAngles(settings.sunAzimuth, settings.sunElevation),
    [settings.sunAzimuth, settings.sunElevation],
  );

  const dustStormStrength = useMemo(() => {
    const opacityFactor = Math.pow(Math.min(1, settings.dustOpacity / 0.85), 1.2);
    const fogFactor = Math.pow(Math.min(1, settings.fogDensity / 0.02), 1.4);
    const countFactor = Math.min(1, settings.dustCount / 6000);
    return 0.5 + opacityFactor * 1.9 + fogFactor * 1.4 + countFactor * 0.7;
  }, [settings.dustOpacity, settings.dustCount, settings.fogDensity]);

  // Goal position in grid coords
  const [goalGrid, setGoalGrid] = useState<PathPoint>({ x: GRID_SIZE - 20, y: GRID_SIZE - 20 });
  const startGrid = useMemo<PathPoint>(() => ({ x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) }), []);

  // Robot grid position for minimap
  const robotGridPos = useMemo(() => {
    const [gx, gy] = worldToGrid(robotPos[0], robotPos[2], GRID_SIZE, GRID_SIZE, WORLD_SIZE);
    return { x: gx, y: gy };
  }, [robotPos]);

  // Goal world position
  const goalWorldPos = useMemo<[number, number, number]>(() => {
    const [wx, wz] = gridToWorld(goalGrid.x, goalGrid.y, GRID_SIZE, GRID_SIZE, WORLD_SIZE);
    const wy = getTerrainHeight(wx, wz, WORLD_SIZE, settings.terrainRelief, settings.terrainHeightOffset);
    return [wx, wy, wz];
  }, [goalGrid, settings.terrainRelief, settings.terrainHeightOffset]);

  // Generate costmap on mount or when density settings change
  useEffect(() => {
    setSimStatus('Generating terrain costmap...');
    const cm = generateProceduralCostmap(GRID_SIZE, GRID_SIZE, settings.obstacleDensity, settings.roughDensity, 42 + densityKey);
    setCostmap(cm);
    setSimStatus('Costmap loaded. Computing path...');
  }, [densityKey, settings.obstacleDensity, settings.roughDensity]);

  // Compute path when costmap or goal changes
  useEffect(() => {
    if (!costmap) return;
    const start = liveInferenceEnabled ? liveStartRef.current : startGrid;

    const timer = setTimeout(() => {
      const rawPath = astar(costmap.data, start, goalGrid);
      if (rawPath.length > 0) {
        const smoothed = smoothPath(rawPath, 3, 0.25);
        setPath(smoothed);
        setSimStatus(
          liveInferenceEnabled
            ? `Live path update: ${smoothed.length} pts`
            : `Path found: ${rawPath.length} nodes → ${smoothed.length} smoothed. Ready.`,
        );
        setIsRunning(true);
        setHasReachedGoal(false);
      } else {
        setPath([]);
        setSimStatus('No valid path found! Try changing the goal.');
      }
    }, liveInferenceEnabled ? 100 : 300);

    return () => clearTimeout(timer);
  }, [costmap, goalGrid, startGrid, liveInferenceEnabled]);

  const handleResetRobot = useCallback(() => {
    setResetTrigger((t) => t + 1);
    setHasReachedGoal(false);
    setIsRunning(true);
    setRobotPathIdx(0);
    setSimStatus('Robot reset. Navigating...');
  }, []);

  const handleRandomGoal = useCallback(() => {
    if (!costmap) return;
    // Find a valid goal position
    let gx: number, gy: number;
    let attempts = 0;
    do {
      gx = Math.floor(Math.random() * (GRID_SIZE - 20)) + 10;
      gy = Math.floor(Math.random() * (GRID_SIZE - 20)) + 10;
      attempts++;
    } while (costmap.data[gy]?.[gx] >= 10 && attempts < 100);

    setGoalGrid({ x: gx, y: gy });
    setHasReachedGoal(false);
    setSimStatus('New goal set. Recomputing path...');
  }, [costmap]);

  const handleReachedGoal = useCallback(() => {
    setHasReachedGoal(true);
    setIsRunning(false);
    setSimStatus('Goal reached! ✓');
  }, []);

  // ── Live Inference: toggle handler ──
  const handleToggleLiveInference = useCallback(() => {
    setLiveInferenceEnabled(prev => {
      const next = !prev;
      if (next) {
        updateSettings({ cameraMode: 'fpv' });
        setInferenceCount(0);
        setInferenceData(null);
        setInferenceError(null);
        setCapturedImage(null);
        const [gx, gy] = worldToGrid(
          robotState.position[0], robotState.position[2],
          GRID_SIZE, GRID_SIZE, WORLD_SIZE,
        );
        liveStartRef.current = { x: Math.round(gx), y: Math.round(gy) };
      }
      return next;
    });
  }, [updateSettings]);

  // ── Live Inference: project traversability grid onto simulation costmap ──
  const updateCostmapFromInference = useCallback((travGrid: number[][]) => {
    setCostmap(prev => {
      if (!prev || !travGrid?.length) return prev;
      const newData = prev.data.map(row => [...row]);
      const rx = robotState.position[0];
      const rz = robotState.position[2];
      const heading = robotState.rotation;
      const gridRows = travGrid.length;
      const gridCols = travGrid[0]?.length || 0;
      const angularSpread = (50 * Math.PI) / 180;
      const cellSize = WORLD_SIZE / GRID_SIZE;
      const minDepth = 2;
      const maxDepth = 16;

      for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
          const aOff = (c / Math.max(1, gridCols - 1) - 0.5) * angularSpread;
          const depth = minDepth + (1 - r / Math.max(1, gridRows - 1)) * (maxDepth - minDepth);
          const dir = heading + aOff;
          const fwX = -Math.cos(dir);
          const fwZ = Math.sin(dir);
          const wx = rx + fwX * depth * cellSize;
          const wz = rz + fwZ * depth * cellSize;
          const [gx, gy] = worldToGrid(wx, wz, GRID_SIZE, GRID_SIZE, WORLD_SIZE);
          // Fill 3×3 area for smoother coverage
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = gx + dx;
              const ny = gy + dy;
              if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                newData[ny][nx] = travGrid[r][c];
              }
            }
          }
        }
      }
      return { width: prev.width, height: prev.height, data: newData };
    });
  }, []);

  // ── Live Inference: periodic capture → API → costmap update loop ──
  useEffect(() => {
    if (!liveInferenceEnabled) return;
    let busy = false;
    let cancelled = false;

    const capture = async () => {
      if (busy || cancelled || !glRef.current) return;
      busy = true;
      setIsInferencing(true);
      try {
        const canvas = glRef.current.domElement;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        setCapturedImage(dataUrl);

        const blob = await fetch(dataUrl).then(r => r.blob());
        const fd = new FormData();
        fd.append('file', blob, 'fpv_capture.jpg');

        const res = await fetch('http://localhost:8000/predict/sim', {
          method: 'POST',
          body: fd,
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data: InferenceResult = await res.json();
        if (cancelled) return;

        setInferenceData(data);
        setInferenceCount(c => c + 1);
        setInferenceError(null);

        // Update start position and costmap
        const [gx, gy] = worldToGrid(
          robotState.position[0], robotState.position[2],
          GRID_SIZE, GRID_SIZE, WORLD_SIZE,
        );
        liveStartRef.current = { x: Math.round(gx), y: Math.round(gy) };
        updateCostmapFromInference(data.traversability_grid);
      } catch (err: any) {
        if (!cancelled) setInferenceError(err.message || 'Inference failed');
      } finally {
        busy = false;
        if (!cancelled) setIsInferencing(false);
      }
    };

    const initTimer = setTimeout(capture, 1500);
    const loopTimer = setInterval(capture, 5000);
    return () => {
      cancelled = true;
      clearTimeout(initTimer);
      clearInterval(loopTimer);
    };
  }, [liveInferenceEnabled, updateCostmapFromInference]);

  const handleCanvasCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    glRef.current = gl;
    // Fresh renderer was created successfully; clear any stale recovery overlay.
    setContextLost(false);

    if (canvasListenersCleanupRef.current) {
      canvasListenersCleanupRef.current();
      canvasListenersCleanupRef.current = null;
    }

    const canvas = gl.domElement;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;

    const onContextLost = (e: Event) => {
      e.preventDefault();
      console.warn('WebGL context lost – remounting renderer');
      setContextLost(true);
      setGpuSafeMode(true);

      if (contextRestoreTimerRef.current) {
        clearTimeout(contextRestoreTimerRef.current);
      }

      contextRestoreTimerRef.current = setTimeout(() => {
        setCanvasKey((k) => k + 1);
        // If browser doesn't emit contextrestored for the old canvas, ensure UI unblocks.
        setContextLost(false);
      }, 1200);
    };

    const onContextRestored = () => {
      console.info('WebGL context restored');
      if (contextRestoreTimerRef.current) {
        clearTimeout(contextRestoreTimerRef.current);
        contextRestoreTimerRef.current = null;
      }
      setContextLost(false);
      gl.setSize(canvas.clientWidth, canvas.clientHeight);
    };

    canvas.addEventListener('webglcontextlost', onContextLost, false);
    canvas.addEventListener('webglcontextrestored', onContextRestored, false);

    canvasListenersCleanupRef.current = () => {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (contextRestoreTimerRef.current) {
        clearTimeout(contextRestoreTimerRef.current);
      }
      if (canvasListenersCleanupRef.current) {
        canvasListenersCleanupRef.current();
        canvasListenersCleanupRef.current = null;
      }
    };
  }, []);

  // Throttled sync callback — called at ~5 Hz from UISync inside the Canvas
  const handleUISync = useCallback(
    (pos: [number, number, number], rot: number, moving: boolean, pathIdx: number, pathLength: number) => {
      setRobotPos(pos);
      setRobotRot(rot);
      setRobotMoving(moving);
      setRobotPathIdx(pathIdx);
      setRobotPathLength(pathLength);
    },
    [],
  );

  // Keep rover grounded when terrain shape/offset changes, even if robot is idle.
  useEffect(() => {
    const [x, , z] = robotState.position;
    const groundedY = getTerrainHeight(
      x,
      z,
      WORLD_SIZE,
      settings.terrainRelief,
      settings.terrainHeightOffset,
    ) + 0.6;

    if (Number.isFinite(groundedY)) {
      robotState.position = [x, groundedY, z];
      setRobotPos([x, groundedY, z]);
    }
  }, [settings.terrainRelief, settings.terrainHeightOffset]);

  return (
    <div className={`relative w-full h-full ${className ?? ''}`}>
      {/* 3D Canvas */}
      <Canvas
        key={canvasKey}
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.3,
          outputColorSpace: THREE.SRGBColorSpace,
          physicallyCorrectLights: true,
          powerPreference: 'default',
          failIfMajorPerformanceCaveat: false,
          preserveDrawingBuffer: true,
        }}
        camera={{ fov: settings.cameraFov, near: 0.1, far: 1200, position: [26, 12, 26] }}
        dpr={gpuSafeMode ? [1, 1] : [1, 1.2]}
        style={{ background: '#87CEEB' }}
        onCreated={handleCanvasCreated}
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        {!gpuSafeMode && <Preload all />}

        {/* Lighting */}
        <Lighting
          sunPosition={sunPos}
          sunIntensity={settings.sunIntensity}
          lightSourceBrightness={settings.lightSourceBrightness}
          ambientIntensity={settings.ambientIntensity}
          fogDensity={settings.fogDensity}
          fogColor={settings.fogColor}
          skyTurbidity={settings.skyTurbidity}
          skyRayleigh={settings.skyRayleigh}
          shadowRes={settings.shadowRes}
          shadowRadius={settings.shadowRadius}
          shadowBias={settings.shadowBias}
          shadowNormalBias={settings.shadowNormalBias}
          shadowCameraSize={settings.shadowCameraSize}
          shadowFar={settings.shadowFar}
        />

        {/* Terrain */}
        <Terrain
          size={WORLD_SIZE}
          segments={settings.terrainSegments}
          terrainRelief={settings.terrainRelief}
          terrainHeightOffset={settings.terrainHeightOffset}
          costmapData={costmap?.data ?? null}
          costmapWidth={GRID_SIZE}
          costmapHeight={GRID_SIZE}
          showSegmentation={showOverlayUi && showSegmentation}
          showCostmap={showOverlayUi && showCostmap}
        />

        {/* Obstacles */}
        {costmap && (
          <Obstacles
            costmapData={costmap.data}
            costmapWidth={GRID_SIZE}
            costmapHeight={GRID_SIZE}
            worldSize={WORLD_SIZE}
            terrainRelief={settings.terrainRelief}
            terrainHeightOffset={settings.terrainHeightOffset}
            densityScale={settings.obstacleDensity / DEFAULT_SETTINGS.obstacleDensity}
            rockDensity={settings.rockDensity}
            cactusDensity={settings.cactusDensity}
            barrelCactusDensity={settings.barrelCactusDensity}
            bushDensity={settings.bushDensity}
            ocotilloDensity={settings.ocotilloDensity}
            grassDensity={settings.grassDensity}
            pebbleDensity={settings.pebbleDensity}
            joshuaTreeDensity={settings.joshuaTreeDensity}
          />
        )}

        {/* Robot */}
        {showOverlayUi && (
          <Robot
            worldSize={WORLD_SIZE}
          />
        )}

        {/* Robot Controller */}
        {costmap && path.length > 0 && isRunning && (
          <RobotController
            costmap={costmap}
            path={path}
            worldSize={WORLD_SIZE}
            terrainRelief={settings.terrainRelief}
            terrainHeightOffset={settings.terrainHeightOffset}
            onReachedGoal={handleReachedGoal}
            resetTrigger={resetTrigger}
            liveInferenceMode={liveInferenceEnabled}
          />
        )}

        {/* Throttled UI sync for telemetry display */}
        <UISync onSync={handleUISync} />

        {/* Path visualization */}
        {showOverlayUi && path.length > 0 && (
          <PathVisualizer
            path={path}
            gridWidth={GRID_SIZE}
            gridHeight={GRID_SIZE}
            worldSize={WORLD_SIZE}
            getTerrainHeight={(wx, wz) =>
              getTerrainHeight(wx, wz, WORLD_SIZE, settings.terrainRelief, settings.terrainHeightOffset)
            }
          />
        )}

        {/* Goal marker */}
        {showOverlayUi && <GoalMarker position={goalWorldPos} />}

        {/* Dust particles */}
        <DustParticles
          count={gpuSafeMode ? Math.max(900, Math.floor(settings.dustCount * 0.65)) : settings.dustCount}
          opacity={settings.dustOpacity}
          size={settings.dustSize}
          windStrength={0.6 + dustStormStrength * 0.55}
          stormStrength={dustStormStrength}
        />

        {/* Camera */}
        <CameraController
          cameraMode={settings.cameraMode}
          fov={settings.cameraFov}
          damping={settings.cameraDamping}
          orbitSpeed={settings.orbitSpeed}
          followDistance={settings.followDistance}
          followHeight={settings.followHeight}
        />

        {/* Post processing */}
        {!gpuSafeMode && !hasReachedGoal && <PostProcessing bloomIntensity={settings.bloomIntensity} />}
      </Canvas>

      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-2">
        <button
          onClick={() => setShowOverlayUi((v) => !v)}
          style={{
            background: showOverlayUi ? 'rgba(0,0,0,0.55)' : 'rgba(34,197,94,0.3)',
            border: `1px solid ${showOverlayUi ? 'rgba(255,255,255,0.14)' : 'rgba(34,197,94,0.55)'}`,
            color: '#e2e8f0',
            borderRadius: 10,
            padding: '6px 12px',
            fontSize: 11,
            fontFamily: 'monospace',
            backdropFilter: 'blur(10px)',
            cursor: 'pointer',
          }}
        >
          {showOverlayUi ? 'Hide UI' : 'Show UI'}
        </button>
        <button
          onClick={handleToggleLiveInference}
          style={{
            background: liveInferenceEnabled
              ? 'rgba(168,85,247,0.35)'
              : 'rgba(0,0,0,0.55)',
            border: `1px solid ${
              liveInferenceEnabled
                ? 'rgba(168,85,247,0.6)'
                : 'rgba(255,255,255,0.14)'
            }`,
            color: liveInferenceEnabled ? '#c084fc' : '#e2e8f0',
            borderRadius: 10,
            padding: '6px 12px',
            fontSize: 11,
            fontFamily: 'monospace',
            backdropFilter: 'blur(10px)',
            cursor: 'pointer',
            transition: 'all 200ms',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: liveInferenceEnabled ? '#a855f7' : '#64748b',
              boxShadow: liveInferenceEnabled ? '0 0 8px #a855f7' : 'none',
              transition: 'all 200ms',
            }}
          />
          {liveInferenceEnabled ? '⚡ Inference ON' : '⚡ Inference'}
        </button>
      </div>

      {showOverlayUi && contextLost && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none bg-black/35 backdrop-blur-[2px]">
          <div className="px-3 py-2 rounded-md text-xs font-mono text-white bg-black/50 border border-white/15">
            Restoring WebGL renderer...
          </div>
        </div>
      )}

      {/* ── Overlay UI ── */}
      {showOverlayUi && (
        <>

      {/* Top status bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 pointer-events-none z-10">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono backdrop-blur-md"
            style={{
              background: 'rgba(0,0,0,0.5)',
              color: hasReachedGoal ? '#22c55e' : '#e2e8f0',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{
                background: hasReachedGoal ? '#22c55e' : robotMoving ? '#3b82f6' : '#f59e0b',
                boxShadow: `0 0 6px ${hasReachedGoal ? '#22c55e' : robotMoving ? '#3b82f6' : '#f59e0b'}`,
              }}
            />
            {simStatus}
          </div>
        </div>
      </div>

      {/* Telemetry panel */}
      <div
        className="absolute top-14 left-4 z-10 pointer-events-none"
        style={{
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: '12px 16px',
          color: '#e2e8f0',
          fontSize: 11,
          fontFamily: 'monospace',
          minWidth: 200,
        }}
      >
        <div style={{ marginBottom: 4, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, fontSize: 9 }}>
          Telemetry
        </div>
        <div className="flex justify-between gap-6">
          <span style={{ color: '#64748b' }}>POS</span>
          <span>
            {robotPos[0].toFixed(1)}, {robotPos[1].toFixed(1)}, {robotPos[2].toFixed(1)}
          </span>
        </div>
        <div className="flex justify-between gap-6">
          <span style={{ color: '#64748b' }}>HDG</span>
          <span>{((robotRot * 180) / Math.PI).toFixed(1)}°</span>
        </div>
        <div className="flex justify-between gap-6">
          <span style={{ color: '#64748b' }}>PATH</span>
          <span>{path.length} pts</span>
        </div>
        <div className="flex justify-between gap-6">
          <span style={{ color: '#64748b' }}>GRID</span>
          <span>{robotGridPos.x}, {robotGridPos.y}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span style={{ color: '#64748b' }}>STATUS</span>
          <span style={{ color: hasReachedGoal ? '#22c55e' : robotMoving ? '#3b82f6' : '#f59e0b' }}>
            {hasReachedGoal ? 'ARRIVED' : robotMoving ? 'MOVING' : 'IDLE'}
          </span>
        </div>
      </div>

      {/* Controls panel */}
      <div
        className="absolute bottom-5 left-5 z-10 flex flex-col gap-2 pointer-events-auto"
        style={{
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: 12,
        }}
      >
        <div
          style={{
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontSize: 9,
            marginBottom: 4,
            fontFamily: 'monospace',
          }}
        >
          Controls
        </div>

        <button
          onClick={() => setShowSegmentation((v) => !v)}
          className="sim-btn"
          style={{
            background: showSegmentation ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)',
            border: `1px solid ${showSegmentation ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.1)'}`,
            color: showSegmentation ? '#22c55e' : '#e2e8f0',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 11,
            fontFamily: 'monospace',
            cursor: 'pointer',
            transition: 'all 150ms',
            textAlign: 'left',
          }}
        >
          {showSegmentation ? '◉' : '○'} Segmentation
        </button>

        <button
          onClick={() => setShowCostmap((v) => !v)}
          className="sim-btn"
          style={{
            background: showCostmap ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)',
            border: `1px solid ${showCostmap ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.1)'}`,
            color: showCostmap ? '#3b82f6' : '#e2e8f0',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 11,
            fontFamily: 'monospace',
            cursor: 'pointer',
            transition: 'all 150ms',
            textAlign: 'left',
          }}
        >
          {showCostmap ? '◉' : '○'} Costmap
        </button>

        <button
          onClick={() =>
            updateSettings({ cameraMode: settings.cameraMode === 'fpv' ? 'follow' : 'fpv' })
          }
          className="sim-btn"
          style={{
            background: settings.cameraMode === 'fpv' ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.08)',
            border: `1px solid ${settings.cameraMode === 'fpv' ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.1)'}`,
            color: settings.cameraMode === 'fpv' ? '#a855f7' : '#e2e8f0',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 11,
            fontFamily: 'monospace',
            cursor: 'pointer',
            transition: 'all 150ms',
            textAlign: 'left',
          }}
        >
          {settings.cameraMode === 'fpv' ? '◉' : '○'} First Person
        </button>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />

        <button
          onClick={handleResetRobot}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#e2e8f0',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 11,
            fontFamily: 'monospace',
            cursor: 'pointer',
            transition: 'all 150ms',
            textAlign: 'left',
          }}
        >
          ↺ Reset Robot
        </button>

        <button
          onClick={handleRandomGoal}
          style={{
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#fca5a5',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 11,
            fontFamily: 'monospace',
            cursor: 'pointer',
            transition: 'all 150ms',
            textAlign: 'left',
          }}
        >
          ⊕ Random Goal
        </button>
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        settings={settings}
        onChange={updateSettings}
        onRegenerateTerrain={() => {
          setDensityKey((k) => k + 1);
          handleResetRobot();
        }}
      />

      {/* Minimap */}
      {costmap && (
        <MiniMap
          costmapData={costmap.data}
          costmapWidth={GRID_SIZE}
          costmapHeight={GRID_SIZE}
          robotGridPos={robotGridPos}
          goalGridPos={goalGrid}
          path={path}
        />
      )}

      {/* Legend */}
      {(showSegmentation || showCostmap) && (
        <div
          className="absolute bottom-5 right-5 z-10 mb-[200px]"
          style={{
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#e2e8f0',
          }}
        >
          <div style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, fontSize: 9, marginBottom: 6 }}>
            Legend
          </div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#22c55e' }} />
            Drivable
          </div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#eab308' }} />
            Rough Terrain
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#dc2626' }} />
            Obstacle
          </div>
        </div>
      )}
        </>
      )}

      {/* Live Inference Panel */}
      <LiveInferencePanel
        enabled={liveInferenceEnabled}
        data={inferenceData}
        capturedImage={capturedImage}
        inferenceCount={inferenceCount}
        isProcessing={isInferencing}
        error={inferenceError}
      />

      {/* Rover Chat Interface */}
      <RoverChat
        roverStatus={{
          position: robotPos,
          goalPosition: goalWorldPos,
          obstaclesCleared: robotPathIdx > 0 ? Math.floor(robotPathIdx / 15) : 0,
          isMoving: robotMoving,
          batteryLevel: robotPathLength > 0
            ? Math.max(20, Math.round(100 - (robotPathIdx / robotPathLength) * 40))
            : 100,
          currentTask: simStatus,
          speed: simSettings.robotSpeed,
          estimatedTimeToGoal: (robotMoving && robotPathLength > 0)
            ? Math.max(0, Math.round((robotPathLength - robotPathIdx) * 0.35 / simSettings.robotSpeed))
            : null,
          pathProgress: robotPathLength > 0 ? robotPathIdx / robotPathLength : 0,
          pathLength: robotPathLength,
        }}
      />
    </div>
  );
}
