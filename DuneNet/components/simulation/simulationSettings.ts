/**
 * Shared mutable simulation settings.
 * Components read these each frame — no React re-renders needed.
 * The SettingsPanel writes to these via React state, then syncs here.
 */
export interface SimSettings {
  // ── Environment ──
  obstacleDensity: number;      // 0.005 – 0.12   (fraction)
  roughDensity: number;         // 0.02  – 0.3
  dustCount: number;            // 0    – 6000
  dustOpacity: number;          // 0.0  – 0.85
  dustSize: number;             // 0.02 – 0.45
  fogDensity: number;           // 0.0  – 0.02
  fogColor: string;             // hex

  // ── Lighting / sky ──
  sunAzimuth: number;           // 0 – 360
  sunElevation: number;         // 5 – 85
  sunIntensity: number;         // 0.5 – 8
  lightSourceBrightness: number; // 0.2 – 2.5
  skyTurbidity: number;         // 1 – 20
  skyRayleigh: number;          // 0 – 6
  bloomIntensity: number;       // 0 – 0.3
  ambientIntensity: number;     // 0 – 0.5
  shadowRes: number;            // 512 – 8192
  shadowRadius: number;         // 0 – 8
  shadowBias: number;           // -0.002 – 0
  shadowNormalBias: number;     // 0 – 0.08
  shadowCameraSize: number;     // 40 – 180
  shadowFar: number;            // 120 – 420

  // ── Camera ──
  cameraMode: 'follow' | 'orbit' | 'fpv';
  cameraFov: number;            // 30 – 120
  cameraDamping: number;        // 0.01 – 0.2
  orbitSpeed: number;           // 0.01 – 0.5
  followDistance: number;       // 5 – 40
  followHeight: number;         // 3 – 30

  // ── Robot ──
  robotSpeed: number;           // 2 – 40

  // ── Terrain ──
  terrainSegments: number;      // 64 – 512
  terrainRelief: number;        // 0.4 – 3.5
  terrainHeightOffset: number;  // -8 – 8
}

export const DEFAULT_SETTINGS: SimSettings = {
  obstacleDensity: 0.035,
  roughDensity: 0.1,
  dustCount: 850,
  dustOpacity: 0.18,
  dustSize: 0.085,
  fogDensity: 0.0009,
  fogColor: '#cfc3a4',

  sunAzimuth: 210,
  sunElevation: 35,
  sunIntensity: 4.6,
  lightSourceBrightness: 1.0,
  skyTurbidity: 3.6,
  skyRayleigh: 0.05,
  bloomIntensity: 0.035,
  ambientIntensity: 0.1,
  shadowRes: 6144,
  shadowRadius: 2.4,
  shadowBias: -0.0003,
  shadowNormalBias: 0.028,
  shadowCameraSize: 96,
  shadowFar: 320,

  cameraMode: 'follow',
  cameraFov: 52,
  cameraDamping: 0.05,
  orbitSpeed: 0.12,
  followDistance: 22,
  followHeight: 10,

  robotSpeed: 2,

  terrainSegments: 256,
  terrainRelief: 1.0,
  terrainHeightOffset: 0,
};

/**
 * Live mutable copy that useFrame readers consume.
 * SettingsPanel syncs React state → this object.
 */
export const simSettings: SimSettings = { ...DEFAULT_SETTINGS };

/** Helper: compute sun vec from azimuth + elevation */
export function sunPositionFromAngles(
  azimuth: number,
  elevation: number,
): [number, number, number] {
  const a = (azimuth * Math.PI) / 180;
  const e = (elevation * Math.PI) / 180;
  const r = 120;
  return [
    r * Math.cos(e) * Math.sin(a),
    r * Math.sin(e),
    r * Math.cos(e) * Math.cos(a),
  ];
}
