'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

interface MiniMapProps {
  costmapData: number[][] | null;
  costmapWidth: number;
  costmapHeight: number;
  robotGridPos: { x: number; y: number };
  goalGridPos: { x: number; y: number };
  path: { x: number; y: number }[];
  size?: number;
}

/**
 * Top-down minimap overlay rendered as a canvas
 */
export default function MiniMap({
  costmapData,
  costmapWidth,
  costmapHeight,
  robotGridPos,
  goalGridPos,
  path,
  size = 180,
}: MiniMapProps) {
  const canvasDataUrl = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = costmapWidth;
    canvas.height = costmapHeight;
    const ctx = canvas.getContext('2d')!;

    // Draw terrain
    if (costmapData) {
      for (let y = 0; y < costmapHeight; y++) {
        for (let x = 0; x < costmapWidth; x++) {
          const val = costmapData[y]?.[x] ?? 0;
          if (val >= 10) {
            ctx.fillStyle = '#991b1b';
          } else if (val >= 5) {
            ctx.fillStyle = '#78716c';
          } else {
            ctx.fillStyle = '#a8956e';
          }
          ctx.fillRect(x, y, 1, 1);
        }
      }
    } else {
      ctx.fillStyle = '#a8956e';
      ctx.fillRect(0, 0, costmapWidth, costmapHeight);
    }

    // Draw path
    if (path.length > 1) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }
      ctx.stroke();
    }

    // Draw goal
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(goalGridPos.x, goalGridPos.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw robot
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(robotGridPos.x, robotGridPos.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    return canvas.toDataURL();
  }, [costmapData, costmapWidth, costmapHeight, robotGridPos, goalGridPos, path]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: size,
        height: size,
        borderRadius: 12,
        overflow: 'hidden',
        border: '2px solid rgba(255,255,255,0.2)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(8px)',
        background: 'rgba(0,0,0,0.5)',
      }}
    >
      <img
        src={canvasDataUrl}
        alt="Minimap"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          imageRendering: 'pixelated',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 6,
          left: 8,
          fontSize: 10,
          color: 'rgba(255,255,255,0.6)',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        Map
      </div>
    </div>
  );
}
