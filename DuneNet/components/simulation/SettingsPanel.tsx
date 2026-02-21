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
  const display =
    step >= 1 ? value.toFixed(0) : step >= 0.01 ? value.toFixed(2) : value.toFixed(4);
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
        value={value}
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
}: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const s = settings;
  const set = onChange;

  return (
    <div ref={panelRef} className="absolute top-14 right-4 z-20">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: open ? 'rgba(59,130,246,0.3)' : 'rgba(0,0,0,0.5)',
          border: `1px solid ${open ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.1)'}`,
          color: open ? '#60a5fa' : '#e2e8f0',
          borderRadius: 10,
          padding: '7px 14px',
          fontSize: 11,
          fontFamily: 'monospace',
          cursor: 'pointer',
          backdropFilter: 'blur(12px)',
          transition: 'all 150ms',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
        Settings
      </button>

      {/* Panel */}
      {open && (
        <div
          style={{
            marginTop: 8,
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: '14px 18px 16px',
            width: 290,
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

          <div style={{ height: 4 }} />
          <Slider label="Dust Count" value={s.dustCount} min={0} max={6000} step={100} onChange={(v) => set({ dustCount: v })} />
          <Slider label="Dust Opacity" value={s.dustOpacity} min={0} max={0.85} step={0.01} onChange={(v) => set({ dustOpacity: v })} />
          <Slider label="Dust Size" value={s.dustSize} min={0.02} max={0.45} step={0.005} onChange={(v) => set({ dustSize: v })} />
          <Slider label="Fog Density" value={s.fogDensity} min={0} max={0.02} step={0.0002} onChange={(v) => set({ fogDensity: v })} />

          {/* ── Lighting / Sky ── */}
          <SectionHeader title="Lighting & Sky" />

          <Slider label="Sun Azimuth" value={s.sunAzimuth} min={0} max={360} step={1} unit="°" onChange={(v) => set({ sunAzimuth: v })} />
          <Slider label="Sun Elevation" value={s.sunElevation} min={5} max={85} step={1} unit="°" onChange={(v) => set({ sunElevation: v })} />
          <Slider label="Sun Intensity" value={s.sunIntensity} min={0.5} max={8} step={0.1} onChange={(v) => set({ sunIntensity: v })} />
          <Slider label="Ambient" value={s.ambientIntensity} min={0} max={0.5} step={0.01} onChange={(v) => set({ ambientIntensity: v })} />
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
      )}

      {/* Custom scrollbar styles */}
      <style>{`
        .sim-settings-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .sim-settings-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .sim-settings-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.12);
          border-radius: 2px;
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
