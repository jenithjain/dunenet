'use client';

import { useRef, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

interface TerrainProps {
  size?: number;
  segments?: number;
  terrainRelief?: number;
  terrainHeightOffset?: number;
  costmapData?: number[][] | null;
  costmapWidth?: number;
  costmapHeight?: number;
  showSegmentation?: boolean;
  showCostmap?: boolean;
}

export default function Terrain({
  size = 320,
  segments = 256,
  terrainRelief = 1,
  terrainHeightOffset = 0,
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
    const warmSand = new THREE.Color('#c8a071');
    const brightSand = new THREE.Color('#e3c49b');
    const claySoil = new THREE.Color('#875a3c');
    const dryGrassTint = new THREE.Color('#b39a63');
    const stoneTint = new THREE.Color('#9d7a58');
    const color = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const relief = THREE.MathUtils.clamp(terrainRelief, 0.4, 3.5);
      const reliefCurve = Math.pow(relief, 1.65);
      const reliefBoost = Math.max(0, reliefCurve - 1);

      // Multi-octave noise → semi-arid rolling hills
      let h = 0;
      h += noise2D(x * 0.0025, z * 0.0025) * (2.2 * (0.72 + reliefCurve * 0.42)); // broad hills
      h += noise2D(x * 0.008, z * 0.008) * (1.1 * (0.74 + reliefCurve * 0.48)); // medium bumps
      h += noise2D(x * 0.03, z * 0.03) * (0.6 * (0.64 + reliefCurve * 0.72)); // small ripples
      h += noise2D(x * 0.12, z * 0.12) * (0.22 * (0.58 + reliefCurve * 1.05)); // micro

      const ridgeRaw = 1 - Math.abs(noise2D(x * 0.0055, z * 0.0055));
      const ridge = ridgeRaw * ridgeRaw;
      h += ridge * reliefBoost * 4.8;

      // Directional slope (subtle hillside)
      const slope = (z / (size * 0.5)) * 1.4 * (0.85 + reliefCurve * 0.32);
      h += slope;

      // Soft edge falloff
      const d = Math.sqrt(x * x + z * z) / (size * 0.5);
      h *= Math.max(0, 1 - d * d * 0.55);
      h += terrainHeightOffset;

      pos.setY(i, h);

      const soilNoise = tintNoise(x * 0.03, z * 0.03) * 0.5 + 0.5;
      const patchNoise = tintNoise(x * 0.095 + 11.7, z * 0.095 - 8.2) * 0.5 + 0.5;
      const stoneNoise = tintNoise(x * 0.15 + 4.1, z * 0.15 + 2.7) * 0.5 + 0.5;
      const grassMask = THREE.MathUtils.smoothstep(patchNoise, 0.55, 0.82) * THREE.MathUtils.smoothstep(h, -1.2, 3.8);
      const stoneMask = THREE.MathUtils.smoothstep(stoneNoise, 0.62, 0.9) * 0.38;

      color.copy(warmSand).lerp(brightSand, soilNoise * 0.5);
      color.lerp(claySoil, THREE.MathUtils.smoothstep(soilNoise, 0.7, 1.0) * 0.55);
      color.lerp(dryGrassTint, grassMask * 0.5);
      color.lerp(stoneTint, stoneMask);

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('uv2', new THREE.BufferAttribute((geo.attributes.uv.array as Float32Array).slice(), 2));
    geo.computeVertexNormals();
    return geo;
  }, [size, segments, terrainRelief, terrainHeightOffset]);

  const textures = useTexture({
    dirtColor: '/textures/terrain/ground103/Ground103_2K-JPG_Color.jpg',
    dirtNormal: '/textures/terrain/ground103/Ground103_2K-JPG_NormalGL.jpg',
    dirtRough: '/textures/terrain/ground103/Ground103_2K-JPG_Roughness.jpg',
    dirtAO: '/textures/terrain/ground103/Ground103_2K-JPG_AmbientOcclusion.jpg',
    greenColor: '/textures/terrain/ground102/Ground102_2K-JPG_Color.jpg',
    greenNormal: '/textures/terrain/ground102/Ground102_2K-JPG_NormalGL.jpg',
    greenRough: '/textures/terrain/ground102/Ground102_2K-JPG_Roughness.jpg',
    greenAO: '/textures/terrain/ground102/Ground102_2K-JPG_AmbientOcclusion.jpg',
    grassColor: '/textures/terrain/grass005/Grass005_2K-JPG_Color.jpg',
    grassNormal: '/textures/terrain/grass005/Grass005_2K-JPG_NormalGL.jpg',
    grassRough: '/textures/terrain/grass005/Grass005_2K-JPG_Roughness.jpg',
    grassAO: '/textures/terrain/grass005/Grass005_2K-JPG_AmbientOcclusion.jpg',
  });

  const sandMaterial = useMemo(() => {
    const blendNoise = (() => {
      const size = 512;
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d')!;
      const n1 = createNoise2D(() => 0.35);
      const n2 = createNoise2D(() => 0.85);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const u = x / size;
          const v = y / size;
          const a = n1(u * 6, v * 6) * 0.5 + 0.5;
          const b = n2(u * 18, v * 18) * 0.5 + 0.5;
          const mix = a * 0.65 + b * 0.35;
          const g = Math.floor(90 + mix * 140);
          ctx.fillStyle = `rgb(${g},${g},${g})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 8;
      return tex;
    })();

    const { dirtColor, dirtNormal, dirtRough, dirtAO, greenColor, greenNormal, greenRough, greenAO, grassColor, grassNormal, grassRough, grassAO } = textures;

    [dirtColor, greenColor, grassColor].forEach((tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 8;
      tex.colorSpace = THREE.SRGBColorSpace;
    });

    [dirtNormal, greenNormal, grassNormal, dirtRough, greenRough, grassRough, dirtAO, greenAO, grassAO].forEach((tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 8;
    });

    dirtColor.repeat.set(20, 20);
    greenColor.repeat.set(22, 22);
    grassColor.repeat.set(40, 40);
    dirtNormal.repeat.set(20, 20);
    greenNormal.repeat.set(22, 22);
    grassNormal.repeat.set(40, 40);
    dirtRough.repeat.set(20, 20);
    greenRough.repeat.set(22, 22);
    grassRough.repeat.set(40, 40);
    dirtAO.repeat.set(20, 20);
    greenAO.repeat.set(22, 22);
    grassAO.repeat.set(40, 40);
    blendNoise.repeat.set(6, 6);

    const material = new THREE.MeshStandardMaterial({
      map: dirtColor,
      normalMap: dirtNormal,
      roughnessMap: dirtRough,
      aoMap: dirtAO,
      aoMapIntensity: 0.35,
      roughness: 0.95,
      metalness: 0.0,
      envMapIntensity: 0.35,
      side: THREE.FrontSide,
    });
    material.normalScale = new THREE.Vector2(1.0, 1.0);

    material.onBeforeCompile = (shader) => {
      shader.uniforms.map2 = { value: greenColor };
      shader.uniforms.map3 = { value: grassColor };
      shader.uniforms.noiseMap = { value: blendNoise };

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vWorldNormal;\nvarying vec2 vUv2;'
        )
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWorldNormal = normalize(mat3(modelMatrix) * normal);'
        )
        .replace(
          '#include <uv_vertex>',
          '#include <uv_vertex>\nvUv2 = uv;'
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform sampler2D map2;\nuniform sampler2D map3;\nuniform sampler2D noiseMap;\nvarying vec3 vWorldPos;\nvarying vec3 vWorldNormal;\nvarying vec2 vUv2;\nvec2 baseUv;\nvec2 greenUv;\nvec2 grassUv;\nfloat baseMask;\nfloat greenMask;\nfloat grassMask;'
        )
        .replace(
          '#include <map_fragment>',
          `#ifdef USE_MAP
            vec2 uvJitter = (texture2D(noiseMap, vUv2 * 0.7).rg - 0.5) * 0.03;
            baseUv = vUv2 * 20.0 + uvJitter;
            greenUv = vUv2 * 22.0 + uvJitter * 1.4;
            grassUv = vUv2 * 40.0 + uvJitter * 2.0;

            float heightNorm = clamp((vWorldPos.y + 1.5) / 5.0, 0.0, 1.0);
            float slope = 1.0 - clamp(vWorldNormal.y, 0.0, 1.0);
            float n = texture2D(noiseMap, vUv2 * 4.0).r;

            greenMask = smoothstep(0.35, 0.7, n) * smoothstep(0.12, 0.55, heightNorm) * (1.0 - slope * 1.1);
            grassMask = smoothstep(0.55, 0.92, n) * smoothstep(0.18, 0.6, heightNorm) * (1.0 - slope * 1.5);
            baseMask = 1.0 - clamp(greenMask + grassMask, 0.0, 1.0);
            float total = baseMask + greenMask + grassMask + 0.0001;
            baseMask /= total;
            greenMask /= total;
            grassMask /= total;

            vec4 baseColor = texture2D(map, baseUv);
            vec4 greenColor = texture2D(map2, greenUv);
            vec4 grassColor = texture2D(map3, grassUv);
            vec4 blendedColor = baseColor * baseMask + greenColor * greenMask + grassColor * grassMask;
            diffuseColor *= blendedColor;
          #endif`
        );
    };

    return material;
  }, [textures]);

  // ── Costmap / segmentation overlay texture ──
  const overlayTexture = useMemo(() => {
    if (!costmapData || (!showCostmap && !showSegmentation)) return null;

    const c = document.createElement('canvas');
    c.width = costmapWidth; c.height = costmapHeight;
    const ctx = c.getContext('2d')!;

    const toHeatColor = (value: number) => {
      const t = THREE.MathUtils.clamp(value / 10, 0, 1);
      // Viridis-like ramp (dark purple -> blue -> green -> yellow)
      const colorStops = [
        new THREE.Color('#440154'),
        new THREE.Color('#31688e'),
        new THREE.Color('#35b779'),
        new THREE.Color('#fde725'),
      ];
      const scaled = t * (colorStops.length - 1);
      const i = Math.min(colorStops.length - 2, Math.floor(scaled));
      const f = scaled - i;
      return colorStops[i].clone().lerp(colorStops[i + 1], f);
    };

    for (let y = 0; y < costmapHeight; y++) {
      for (let x = 0; x < costmapWidth; x++) {
        const val = costmapData[y]?.[x] ?? 0;
        if (showSegmentation) {
          if (val >= 10) ctx.fillStyle = 'rgba(220,38,38,0.92)';      // obstacle
          else if (val >= 5) ctx.fillStyle = 'rgba(234,179,8,0.88)';  // rough
          else ctx.fillStyle = 'rgba(34,197,94,0.84)';                // drivable
        } else {
          const heat = toHeatColor(val);
          const r = Math.floor(heat.r * 255);
          const g = Math.floor(heat.g * 255);
          const b = Math.floor(heat.b * 255);
          ctx.fillStyle = `rgba(${r},${g},${b},0.86)`;
        }
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
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
          <meshBasicMaterial
            map={overlayTexture}
            transparent
            opacity={showSegmentation ? 0.95 : 0.82}
            depthWrite={false}
            toneMapped={false}
            side={THREE.FrontSide}
          />
        </mesh>
      )}
    </group>
  );
}
