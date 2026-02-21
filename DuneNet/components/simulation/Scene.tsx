'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { AdaptiveDpr, AdaptiveEvents, Preload, Stats } from '@react-three/drei';
import {
  EffectComposer,
  Bloom,
  ToneMapping,
  Vignette,
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
function getTerrainHeight(wx: number, wz: number, worldSize: number = 200): number {
  let h = 0;
  h += terrainNoise(wx * 0.006, wz * 0.006) * 10;
  h += terrainNoise(wx * 0.015, wz * 0.015) * 4;
  h += terrainNoise(wx * 0.04, wz * 0.04) * 1.5;
  h += terrainNoise(wx * 0.1,  wz * 0.1)  * 0.4;
  h += terrainNoise(wx * 0.25, wz * 0.25) * 0.1;
  const d = Math.sqrt(wx * wx + wz * wz) / (worldSize * 0.5);
  h *= Math.max(0, 1 - d * d * d);
  return h;
}

// ── Robot movement controller (inside Canvas) ──
// Writes to the shared robotState every frame — no React setState.
function RobotController({
  costmap,
  path,
  worldSize,
  onReachedGoal,
  resetTrigger,
}: {
  costmap: CostmapData;
  path: PathPoint[];
  worldSize: number;
  onReachedGoal: () => void;
  resetTrigger: number;
}) {
  const pathIdx = useRef(0);
  const currentPos = useRef<[number, number, number]>([0, 0, 0]);
  const targetPos = useRef<[number, number, number]>([0, 0, 0]);
  const reached = useRef(false);

  // Reset when path or reset trigger changes
  useEffect(() => {
    pathIdx.current = 0;
    reached.current = false;
    if (path.length > 0) {
      const first = path[0];
      const [wx, wz] = gridToWorld(first.x, first.y, costmap.width, costmap.height, worldSize);
      const wy = getTerrainHeight(wx, wz, worldSize);
      currentPos.current = [wx, wy + 0.6, wz];
      robotState.position = [wx, wy + 0.6, wz];
      robotState.rotation = 0;
      robotState.moving = false;
    }
  }, [path, resetTrigger]);

  useFrame((_, delta) => {
    if (path.length < 2 || reached.current) {
      robotState.moving = false;
      return;
    }

    // Move along path points
    const speed = 12; // world units per second
    const step = Math.max(1, Math.floor(path.length / 200));

    let idx = pathIdx.current;
    if (idx >= path.length - 1) {
      reached.current = true;
      robotState.moving = false;
      onReachedGoal();
      return;
    }

    // Get target point
    const tp = path[Math.min(idx + step, path.length - 1)];
    const [twx, twz] = gridToWorld(tp.x, tp.y, costmap.width, costmap.height, worldSize);
    const twy = getTerrainHeight(twx, twz, worldSize);
    targetPos.current = [twx, twy + 0.6, twz];

    // Direction
    const dx = targetPos.current[0] - currentPos.current[0];
    const dz = targetPos.current[2] - currentPos.current[2];
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.5) {
      pathIdx.current = Math.min(idx + step, path.length - 1);
      return;
    }

    const moveStep = Math.min(speed * delta, dist);
    const nx = currentPos.current[0] + (dx / dist) * moveStep;
    const nz = currentPos.current[2] + (dz / dist) * moveStep;
    const ny = getTerrainHeight(nx, nz, worldSize) + 0.6;

    currentPos.current = [nx, ny, nz];
    const rot = Math.atan2(dx, dz);

    // Write directly to shared mutable state — NO setState here!
    robotState.position = [nx, ny, nz];
    robotState.rotation = rot;
    robotState.moving = true;
  });

  return null;
}

// ── Throttled UI sync (inside Canvas) ──
// Reads robotState at ~5 Hz and pushes it into React state for telemetry UI.
function UISync({
  onSync,
}: {
  onSync: (pos: [number, number, number], rot: number, moving: boolean) => void;
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
      );
    }
  });
  return null;
}

// ── Post Processing (lightweight – no SSAO to avoid context loss) ──
function PostProcessing() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={0.15}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.4}
        mipmapBlur
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.25} darkness={0.3} />
    </EffectComposer>
  );
}

// ── Main Scene ──
export interface SimulationSceneProps {
  className?: string;
}

export default function SimulationScene({ className }: SimulationSceneProps) {
  const WORLD_SIZE = 200;
  const GRID_SIZE = 128; // Use 128 for performance, looks great

  // State
  const [costmap, setCostmap] = useState<CostmapData | null>(null);
  const [path, setPath] = useState<PathPoint[]>([]);
  const [robotPos, setRobotPos] = useState<[number, number, number]>([0, 2, 0]);
  const [robotRot, setRobotRot] = useState(0);
  const [robotMoving, setRobotMoving] = useState(false);
  const [resetTrigger, setResetTrigger] = useState(0);

  const [showSegmentation, setShowSegmentation] = useState(false);
  const [showCostmap, setShowCostmap] = useState(false);
  const [orbitCamera, setOrbitCamera] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [hasReachedGoal, setHasReachedGoal] = useState(false);
  const [simStatus, setSimStatus] = useState('Initializing...');

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
    const wy = getTerrainHeight(wx, wz, WORLD_SIZE);
    return [wx, wy, wz];
  }, [goalGrid]);

  // Generate costmap on mount
  useEffect(() => {
    setSimStatus('Generating terrain costmap...');
    const cm = generateProceduralCostmap(GRID_SIZE, GRID_SIZE, 0.035, 0.1, 42);
    setCostmap(cm);
    setSimStatus('Costmap loaded. Computing path...');
  }, []);

  // Compute path when costmap or goal changes
  useEffect(() => {
    if (!costmap) return;

    const timer = setTimeout(() => {
      const rawPath = astar(costmap.data, startGrid, goalGrid);
      if (rawPath.length > 0) {
        const smoothed = smoothPath(rawPath, 3, 0.25);
        setPath(smoothed);
        setSimStatus(`Path found: ${rawPath.length} nodes → ${smoothed.length} smoothed. Ready.`);
        setIsRunning(true);
        setHasReachedGoal(false);
      } else {
        setPath([]);
        setSimStatus('No valid path found! Try changing the goal.');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [costmap, goalGrid, startGrid]);

  const handleResetRobot = useCallback(() => {
    setResetTrigger((t) => t + 1);
    setHasReachedGoal(false);
    setIsRunning(true);
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

  // Throttled sync callback — called at ~5 Hz from UISync inside the Canvas
  const handleUISync = useCallback(
    (pos: [number, number, number], rot: number, moving: boolean) => {
      setRobotPos(pos);
      setRobotRot(rot);
      setRobotMoving(moving);
    },
    [],
  );

  return (
    <div className={`relative w-full h-full ${className ?? ''}`}>
      {/* 3D Canvas */}
      <Canvas
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          outputColorSpace: THREE.SRGBColorSpace,
          powerPreference: 'default',
          preserveDrawingBuffer: true,
          failIfMajorPerformanceCaveat: false,
        }}
        camera={{ fov: 50, near: 0.1, far: 1000, position: [20, 15, 20] }}
        dpr={[1, 1.5]}
        style={{ background: '#87CEEB' }}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            console.warn('WebGL context lost – will restore');
          });
          canvas.addEventListener('webglcontextrestored', () => {
            console.info('WebGL context restored');
            gl.setSize(canvas.clientWidth, canvas.clientHeight);
          });
        }}
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <Preload all />

        {/* Lighting */}
        <Lighting />

        {/* Terrain */}
        <Terrain
          size={WORLD_SIZE}
          segments={GRID_SIZE}
          costmapData={costmap?.data ?? null}
          costmapWidth={GRID_SIZE}
          costmapHeight={GRID_SIZE}
          showSegmentation={showSegmentation}
          showCostmap={showCostmap}
        />

        {/* Obstacles */}
        {costmap && (
          <Obstacles
            costmapData={costmap.data}
            costmapWidth={GRID_SIZE}
            costmapHeight={GRID_SIZE}
            worldSize={WORLD_SIZE}
          />
        )}

        {/* Robot */}
        <Robot
          worldSize={WORLD_SIZE}
        />

        {/* Robot Controller */}
        {costmap && path.length > 0 && isRunning && (
          <RobotController
            costmap={costmap}
            path={path}
            worldSize={WORLD_SIZE}
            onReachedGoal={handleReachedGoal}
            resetTrigger={resetTrigger}
          />
        )}

        {/* Throttled UI sync for telemetry display */}
        <UISync onSync={handleUISync} />

        {/* Path visualization */}
        {path.length > 0 && (
          <PathVisualizer
            path={path}
            gridWidth={GRID_SIZE}
            gridHeight={GRID_SIZE}
            worldSize={WORLD_SIZE}
            getTerrainHeight={(wx, wz) => getTerrainHeight(wx, wz, WORLD_SIZE)}
          />
        )}

        {/* Goal marker */}
        <GoalMarker position={goalWorldPos} />

        {/* Dust particles */}
        <DustParticles />

        {/* Camera */}
        <CameraController
          orbitMode={orbitCamera}
        />

        {/* Post processing */}
        <PostProcessing />
      </Canvas>

      {/* ── Overlay UI ── */}

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
          onClick={() => setOrbitCamera((v) => !v)}
          className="sim-btn"
          style={{
            background: orbitCamera ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.08)',
            border: `1px solid ${orbitCamera ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.1)'}`,
            color: orbitCamera ? '#a855f7' : '#e2e8f0',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 11,
            fontFamily: 'monospace',
            cursor: 'pointer',
            transition: 'all 150ms',
            textAlign: 'left',
          }}
        >
          {orbitCamera ? '◉' : '○'} Orbit Camera
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
    </div>
  );
}
