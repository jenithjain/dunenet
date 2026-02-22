'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  type SimSettings,
  DEFAULT_SETTINGS,
  sunPositionFromAngles,
} from './simulationSettings';

interface SettingsPanelProps {
  settings: SimSettings;
  onChange: (patch: Partial<SimSettings>) => void;
  onRegenerateTerrain?: () => void;
  open?: boolean;
  onToggle?: (open: boolean) => void;
}

/* ── tiny slider ── */
function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const safeValue = Number.isFinite(value) ? value : min;
  const display =
    step >= 1 ? safeValue.toFixed(0) : step >= 0.01 ? safeValue.toFixed(2) : safeValue.toFixed(4);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between text-[10px]" style={{ color: '#94a3b8' }}>
        <span>{label}</span>
        <span>
          {display}
          {unit ?? ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeValue}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="sim-slider"
        style={{ width: '100%', accentColor: '#3b82f6' }}
      />
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        fontSize: 9,
        fontFamily: 'monospace',
        marginTop: 8,
        marginBottom: 4,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        paddingBottom: 4,
      }}
    >
      {title}
    </div>
  );
}

export default function SettingsPanel({
  settings,
  onChange,
  onRegenerateTerrain,
  open: controlledOpen,
  onToggle,
}: SettingsPanelProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (v: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof v === 'function' ? v(open) : v;
    if (onToggle) onToggle(next);
    else setInternalOpen(next);
  };
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click — but ignore clicks on the toggle button itself
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if the click landed on the settings toggle button
      if (target.closest?.('[data-settings-toggle]')) return;
      if (panelRef.current && !panelRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const s = { ...DEFAULT_SETTINGS, ...settings };
  const set = onChange;

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute top-12 left-1/2 z-30"
      style={{ transform: 'translateX(-50%)' }}
    >
      {/* Panel */}
      <div
        style={{
          background: 'rgba(0,0,0,0.78)',
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 14,
          padding: '14px 18px 16px',
          width: 320,
          maxHeight: 'calc(100vh - 120px)',
          overflowY: 'auto',
          color: '#e2e8f0',
          fontSize: 11,
          fontFamily: 'monospace',
        }}
        className="sim-settings-scroll"
      >
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Simulation Settings
          </div>

          {/* ── Camera ── */}
          <SectionHeader title="Camera" />

          <div className="flex gap-1 mb-2">
            {(['follow', 'orbit', 'fpv'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => set({ cameraMode: mode })}
                style={{
                  flex: 1,
                  background:
                    s.cameraMode === mode
                      ? 'rgba(59,130,246,0.35)'
                      : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${
                    s.cameraMode === mode
                      ? 'rgba(59,130,246,0.6)'
                      : 'rgba(255,255,255,0.08)'
                  }`,
                  color: s.cameraMode === mode ? '#60a5fa' : '#94a3b8',
                  borderRadius: 6,
                  padding: '4px 0',
                  fontSize: 10,
                  cursor: 'pointer',
                  transition: 'all 100ms',
                  textTransform: 'uppercase',
                  fontFamily: 'monospace',
                }}
              >
                {mode === 'fpv' ? '1st Person' : mode === 'orbit' ? 'Orbit' : 'Follow'}
              </button>
            ))}
          </div>

          <Slider label="FOV" value={s.cameraFov} min={30} max={120} step={1} unit="°" onChange={(v) => set({ cameraFov: v })} />
          <Slider label="Damping" value={s.cameraDamping} min={0.01} max={0.2} step={0.005} onChange={(v) => set({ cameraDamping: v })} />
          {s.cameraMode === 'follow' && (
            <>
              <Slider label="Follow Distance" value={s.followDistance} min={5} max={40} step={0.5} onChange={(v) => set({ followDistance: v })} />
              <Slider label="Follow Height" value={s.followHeight} min={3} max={30} step={0.5} onChange={(v) => set({ followHeight: v })} />
            </>
          )}
          {s.cameraMode === 'orbit' && (
            <Slider label="Orbit Speed" value={s.orbitSpeed} min={0.01} max={0.5} step={0.01} onChange={(v) => set({ orbitSpeed: v })} />
          )}

          {/* ── Environment ── */}
          <SectionHeader title="Environment" />

          <Slider label="Obstacle Density" value={s.obstacleDensity} min={0.005} max={0.12} step={0.005} onChange={(v) => set({ obstacleDensity: v })} />
          <Slider label="Rough Terrain" value={s.roughDensity} min={0.02} max={0.3} step={0.01} onChange={(v) => set({ roughDensity: v })} />

          {/* ── Per-obstacle density ── */}
          <SectionHeader title="Obstacles" />
          <Slider label="Rocks" value={s.rockDensity} min={0} max={3} step={0.1} onChange={(v) => set({ rockDensity: v })} />
          <Slider label="Saguaro Cactus" value={s.cactusDensity} min={0} max={3} step={0.1} onChange={(v) => set({ cactusDensity: v })} />
          <Slider label="Barrel Cactus" value={s.barrelCactusDensity} min={0} max={3} step={0.1} onChange={(v) => set({ barrelCactusDensity: v })} />
          <Slider label="Dry Bushes" value={s.bushDensity} min={0} max={3} step={0.1} onChange={(v) => set({ bushDensity: v })} />
          <Slider label="Ocotillo" value={s.ocotilloDensity} min={0} max={3} step={0.1} onChange={(v) => set({ ocotilloDensity: v })} />
          <Slider label="Joshua Trees" value={s.joshuaTreeDensity} min={0} max={3} step={0.1} onChange={(v) => set({ joshuaTreeDensity: v })} />
          <Slider label="Grass Clumps" value={s.grassDensity} min={0} max={3} step={0.1} onChange={(v) => set({ grassDensity: v })} />
          <Slider label="Pebbles" value={s.pebbleDensity} min={0} max={3} step={0.1} onChange={(v) => set({ pebbleDensity: v })} />

          <div style={{ height: 4 }} />
          <Slider label="Dust Count" value={s.dustCount} min={0} max={6000} step={100} onChange={(v) => set({ dustCount: v })} />
          <Slider label="Dust Opacity" value={s.dustOpacity} min={0} max={0.85} step={0.01} onChange={(v) => set({ dustOpacity: v })} />
          <Slider label="Dust Size" value={s.dustSize} min={0.02} max={0.45} step={0.005} onChange={(v) => set({ dustSize: v })} />
          <Slider label="Fog Density" value={s.fogDensity} min={0} max={0.02} step={0.0002} onChange={(v) => set({ fogDensity: v })} />

          {/* ── Terrain ── */}
          <SectionHeader title="Terrain Shape" />
          <Slider
            label="Mountainousness"
            value={s.terrainRelief}
            min={0.4}
            max={3.5}
            step={0.05}
            onChange={(v) => set({ terrainRelief: v })}
          />
          <Slider
            label="Altitude Offset"
            value={s.terrainHeightOffset}
            min={-8}
            max={8}
            step={0.1}
            onChange={(v) => set({ terrainHeightOffset: v })}
          />

          {/* ── Lighting / Sky ── */}
          <SectionHeader title="Lighting & Sky" />

          <Slider label="Sun Azimuth" value={s.sunAzimuth} min={0} max={360} step={1} unit="°" onChange={(v) => set({ sunAzimuth: v })} />
          <Slider label="Sun Elevation" value={s.sunElevation} min={5} max={85} step={1} unit="°" onChange={(v) => set({ sunElevation: v })} />
          <Slider label="Sun Intensity" value={s.sunIntensity} min={0.5} max={8} step={0.1} onChange={(v) => set({ sunIntensity: v })} />
          <Slider label="Light Brightness" value={s.lightSourceBrightness} min={0.2} max={2.5} step={0.05} onChange={(v) => set({ lightSourceBrightness: v })} />
          <Slider label="Ambient" value={s.ambientIntensity} min={0} max={0.5} step={0.01} onChange={(v) => set({ ambientIntensity: v })} />
          <Slider label="Shadow Resolution" value={s.shadowRes} min={512} max={8192} step={256} onChange={(v) => set({ shadowRes: v })} />
          <Slider label="Shadow Softness" value={s.shadowRadius} min={0} max={8} step={0.1} onChange={(v) => set({ shadowRadius: v })} />
          <Slider label="Shadow Bias" value={s.shadowBias} min={-0.002} max={0} step={0.00005} onChange={(v) => set({ shadowBias: v })} />
          <Slider label="Shadow Normal Bias" value={s.shadowNormalBias} min={0} max={0.08} step={0.001} onChange={(v) => set({ shadowNormalBias: v })} />
          <Slider label="Shadow Coverage" value={s.shadowCameraSize} min={40} max={180} step={2} onChange={(v) => set({ shadowCameraSize: v })} />
          <Slider label="Shadow Distance" value={s.shadowFar} min={120} max={420} step={5} onChange={(v) => set({ shadowFar: v })} />
          <Slider label="Sky Turbidity" value={s.skyTurbidity} min={1} max={20} step={0.1} onChange={(v) => set({ skyTurbidity: v })} />
          <Slider label="Sky Rayleigh" value={s.skyRayleigh} min={0} max={6} step={0.05} onChange={(v) => set({ skyRayleigh: v })} />
          <Slider label="Bloom" value={s.bloomIntensity} min={0} max={0.3} step={0.005} onChange={(v) => set({ bloomIntensity: v })} />

          {/* ── Robot ── */}
          <SectionHeader title="Robot" />

          <Slider label="Speed" value={s.robotSpeed} min={2} max={40} step={1} unit=" u/s" onChange={(v) => set({ robotSpeed: v })} />

          {/* ── Actions ── */}
          <SectionHeader title="Actions" />

          <div className="flex gap-2 mt-1">
            <button
              onClick={() => set({ ...DEFAULT_SETTINGS })}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8',
                borderRadius: 6,
                padding: '5px 0',
                fontSize: 10,
                cursor: 'pointer',
                fontFamily: 'monospace',
              }}
            >
              Reset Defaults
            </button>
            {onRegenerateTerrain && (
              <button
                onClick={onRegenerateTerrain}
                style={{
                  flex: 1,
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#fca5a5',
                  borderRadius: 6,
                  padding: '5px 0',
                  fontSize: 10,
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                Regenerate
              </button>
            )}
          </div>
      </div>

      {/* Custom scrollbar styles — blue theme for settings */}
      <style>{`
        .sim-settings-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .sim-settings-scroll::-webkit-scrollbar-track {
          background: rgba(30, 41, 59, 0.5);
          border-radius: 3px;
        }
        .sim-settings-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #3b82f6, #1d4ed8);
          border-radius: 3px;
        }
        .sim-settings-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #60a5fa, #3b82f6);
        }
        .sim-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 3px;
          background: rgba(255,255,255,0.12);
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }
        .sim-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid rgba(0,0,0,0.3);
        }
        .sim-slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
}
