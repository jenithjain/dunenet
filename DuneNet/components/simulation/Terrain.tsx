'use client';

import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

interface TerrainProps {
  size?: number;
  segments?: number;
  costmapData?: number[][] | null;
  costmapWidth?: number;
  costmapHeight?: number;
  showSegmentation?: boolean;
  showCostmap?: boolean;
}

export default function Terrain({
  size = 200,
  segments = 256,
  costmapData = null,
  costmapWidth = 256,
  costmapHeight = 256,
  showSegmentation = false,
  showCostmap = false,
}: TerrainProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // ── Build displaced plane geometry ──
  const geometry = useMemo(() => {
    const noise2D = createNoise2D(() => 0.5);
    const tintNoise = createNoise2D(() => 0.33);
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const warmSand = new THREE.Color('#c7a374');
    const brightSand = new THREE.Color('#e1c598');
    const claySoil = new THREE.Color('#8f6b49');
    const dryGrassTint = new THREE.Color('#9f8d58');
    const color = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // Multi-octave noise → realistic dunes
      let h = 0;
      h += noise2D(x * 0.006, z * 0.006) * 10; // broad dunes
      h += noise2D(x * 0.015, z * 0.015) * 4; // medium ridges
      h += noise2D(x * 0.04, z * 0.04) * 1.5; // ripples
      h += noise2D(x * 0.1, z * 0.1) * 0.4; // fine grain
      h += noise2D(x * 0.25, z * 0.25) * 0.1; // micro

      // Edge falloff
      const d = Math.sqrt(x * x + z * z) / (size * 0.5);
      h *= Math.max(0, 1 - d * d * d);

      pos.setY(i, h);

      const soilNoise = tintNoise(x * 0.03, z * 0.03) * 0.5 + 0.5;
      const patchNoise = tintNoise(x * 0.07 + 11.7, z * 0.07 - 8.2) * 0.5 + 0.5;
      const grassMask = THREE.MathUtils.smoothstep(patchNoise, 0.56, 0.78) * THREE.MathUtils.smoothstep(h, -1.5, 5);

      color.copy(warmSand).lerp(brightSand, soilNoise * 0.45);
      color.lerp(claySoil, THREE.MathUtils.smoothstep(soilNoise, 0.75, 1.0) * 0.5);
      color.lerp(dryGrassTint, grassMask * 0.35);

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('uv2', new THREE.BufferAttribute((geo.attributes.uv.array as Float32Array).slice(), 2));
    geo.computeVertexNormals();
    return geo;
  }, [size, segments]);

  // ── Procedural PBR sand material ──
  const sandMaterial = useMemo(() => {
    // --- diffuse (color) ---
    const TEX = 1024;
    const dc = document.createElement('canvas');
    dc.width = TEX;
    dc.height = TEX;
    const dctx = dc.getContext('2d')!;
    const dn = createNoise2D(() => 0.3);

    for (let y = 0; y < TEX; y++) {
      for (let x = 0; x < TEX; x++) {
        const u = x / TEX;
        const v = y / TEX;
        const n1 = dn(u * 50, v * 50) * 0.5 + 0.5;
        const n2 = dn(u * 110, v * 110) * 0.5 + 0.5;
        const n3 = dn(u * 250, v * 250) * 0.5 + 0.5;
        const c = n1 * 0.45 + n2 * 0.35 + n3 * 0.2;

        const r = Math.floor(173 + c * 62);
        const g = Math.floor(138 + c * 50);
        const b = Math.floor(90 + c * 38);
        dctx.fillStyle = `rgb(${r},${g},${b})`;
        dctx.fillRect(x, y, 1, 1);
      }
    }
    const diffuse = new THREE.CanvasTexture(dc);
    diffuse.wrapS = diffuse.wrapT = THREE.RepeatWrapping;
    diffuse.repeat.set(26, 26);
    diffuse.anisotropy = 8;
    diffuse.colorSpace = THREE.SRGBColorSpace;

    // --- normal map ---
    const NC = 512;
    const nc = document.createElement('canvas');
    nc.width = NC;
    nc.height = NC;
    const nctx = nc.getContext('2d')!;
    const nn = createNoise2D(() => 0.7);
    const nn2 = createNoise2D(() => 0.2);

    for (let y = 0; y < NC; y++) {
      for (let x = 0; x < NC; x++) {
        const u = x / NC, v = y / NC;
        const a = nn(u * 80, v * 80) * 0.5 + 0.5;
        const b2 = nn(u * 200, v * 200) * 0.5 + 0.5;
        const c2 = nn2(u * 40, v * 40) * 0.5 + 0.5;

        const r = Math.floor(128 + (a - 0.5) * 90 + (c2 - 0.5) * 30);
        const g = Math.floor(128 + (b2 - 0.5) * 90 + (c2 - 0.5) * 30);
        nctx.fillStyle = `rgb(${Math.min(255, Math.max(0, r))},${Math.min(255, Math.max(0, g))},255)`;
        nctx.fillRect(x, y, 1, 1);
      }
    }
    const normalMap = new THREE.CanvasTexture(nc);
    normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.set(30, 30);

    // --- roughness map ---
    const RC = 512;
    const rc = document.createElement('canvas');
    rc.width = RC;
    rc.height = RC;
    const rctx = rc.getContext('2d')!;
    const rn = createNoise2D(() => 0.1);

    for (let y = 0; y < RC; y++) {
      for (let x = 0; x < RC; x++) {
        const n = rn(x / RC * 40, y / RC * 40) * 0.5 + 0.5;
        const val = Math.floor(188 + n * 58);
        rctx.fillStyle = `rgb(${val},${val},${val})`;
        rctx.fillRect(x, y, 1, 1);
      }
    }
    const roughMap = new THREE.CanvasTexture(rc);
    roughMap.wrapS = roughMap.wrapT = THREE.RepeatWrapping;
    roughMap.repeat.set(28, 28);

    // --- ambient occlusion map ---
    const AC = 512;
    const ac = document.createElement('canvas');
    ac.width = AC;
    ac.height = AC;
    const actx = ac.getContext('2d')!;
    const an = createNoise2D(() => 0.87);
    for (let y = 0; y < AC; y++) {
      for (let x = 0; x < AC; x++) {
        const n = an((x / AC) * 35, (y / AC) * 35) * 0.5 + 0.5;
        const val = Math.floor(135 + n * 90);
        actx.fillStyle = `rgb(${val},${val},${val})`;
        actx.fillRect(x, y, 1, 1);
      }
    }
    const aoMap = new THREE.CanvasTexture(ac);
    aoMap.wrapS = aoMap.wrapT = THREE.RepeatWrapping;
    aoMap.repeat.set(20, 20);

    return new THREE.MeshStandardMaterial({
      map: diffuse,
      vertexColors: true,
      normalMap,
      normalScale: new THREE.Vector2(1.35, 1.35),
      roughnessMap: roughMap,
      roughness: 0.94,
      aoMap,
      aoMapIntensity: 0.55,
      metalness: 0.0,
      envMapIntensity: 0.45,
      side: THREE.FrontSide,
    });
  }, []);

  // ── Costmap / segmentation overlay texture ──
  const overlayTexture = useMemo(() => {
    if (!costmapData || (!showCostmap && !showSegmentation)) return null;

    const c = document.createElement('canvas');
    c.width = costmapWidth; c.height = costmapHeight;
    const ctx = c.getContext('2d')!;

    for (let y = 0; y < costmapHeight; y++) {
      for (let x = 0; x < costmapWidth; x++) {
        const val = costmapData[y]?.[x] ?? 0;
        if (showSegmentation) {
          if (val >= 10) ctx.fillStyle = 'rgba(220,38,38,0.7)';
          else if (val >= 5) ctx.fillStyle = 'rgba(234,179,8,0.5)';
          else ctx.fillStyle = 'rgba(34,197,94,0.3)';
        } else {
          const i = Math.min(255, val * 25);
          ctx.fillStyle = `rgba(${i},${Math.max(0,100-i)},${Math.max(0,200-i*2)},0.6)`;
        }
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }, [costmapData, costmapWidth, costmapHeight, showSegmentation, showCostmap]);

  const overlayVisible = showCostmap || showSegmentation;

  return (
    <group>
      {/* Main sand terrain */}
      <mesh ref={meshRef} geometry={geometry} material={sandMaterial} receiveShadow />

      {/* Overlay */}
      {overlayVisible && overlayTexture && (
        <mesh geometry={geometry} position={[0, 0.08, 0]}>
          <meshBasicMaterial map={overlayTexture} transparent opacity={0.55} depthWrite={false} side={THREE.FrontSide} />
        </mesh>
      )}
    </group>
  );
}
