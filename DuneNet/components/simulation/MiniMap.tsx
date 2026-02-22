'use client';

import { useMemo, useState } from 'react';
import * as THREE from 'three';

interface MiniMapProps {
  costmapData: number[][] | null;
  costmapWidth: number;
  costmapHeight: number;
  robotGridPos: { x: number; y: number };
  goalGridPos: { x: number; y: number };
  path: { x: number; y: number }[];
  size?: number;
  pickMode?: boolean;
  onPickGoal?: (gridX: number, gridY: number) => void;
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
  pickMode = false,
  onPickGoal,
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

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pickMode || !onPickGoal) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const gx = Math.round((px / size) * costmapWidth);
    const gy = Math.round((py / size) * costmapHeight);
    onPickGoal(
      Math.max(2, Math.min(costmapWidth - 2, gx)),
      Math.max(2, Math.min(costmapHeight - 2, gy)),
    );
  };

  const [isExpanded, setIsExpanded] = useState(false);

  // ── Compact view (bottom-right corner) ──
  if (!isExpanded) {
    return (
      <div
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          handleClick(e);
        }}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          width: size,
          height: size,
          borderRadius: 12,
          overflow: 'hidden',
          border: pickMode ? '2px solid rgba(239,68,68,0.8)' : '2px solid rgba(255,255,255,0.2)',
          boxShadow: pickMode
            ? '0 0 0 3px rgba(239,68,68,0.3), 0 4px 24px rgba(0,0,0,0.4)'
            : '0 4px 24px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          background: 'rgba(0,0,0,0.5)',
          cursor: pickMode ? 'crosshair' : 'default',
          transition: 'border 200ms, box-shadow 200ms',
          zIndex: 25,
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
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 8,
            fontSize: 10,
            color: pickMode ? 'rgba(239,120,100,0.95)' : 'rgba(255,255,255,0.6)',
            fontFamily: 'monospace',
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontWeight: pickMode ? 700 : 400,
          }}
        >
          {pickMode ? '✛ Click to set goal' : 'Map'}
        </div>
        <button
          onClick={() => setIsExpanded(true)}
          style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.25)',
            color: '#e2e8f0',
            borderRadius: 6,
            padding: '3px 6px',
            fontSize: 10,
            fontFamily: 'monospace',
            cursor: 'pointer',
            transition: 'all 150ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.25)';
            e.currentTarget.style.border = '1px solid rgba(255,255,255,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
            e.currentTarget.style.border = '1px solid rgba(255,255,255,0.25)';
          }}
          title="Expand minimap"
        >
          ⛶ Expand
        </button>
      </div>
    );
  }

  // ── Expanded fullscreen mode ──
  const expandedSize = Math.min(620, window.innerHeight - 80);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={() => setIsExpanded(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: expandedSize,
          height: expandedSize,
          borderRadius: 16,
          overflow: 'hidden',
          border: pickMode ? '2px solid rgba(239,68,68,0.8)' : '2px solid rgba(255,255,255,0.3)',
          boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          cursor: pickMode ? 'crosshair' : 'default',
        }}
      >
        {/* Grid overlay */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            opacity: 0.25,
            zIndex: 2,
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => {
            const pos = ((i + 1) * 100) / 9;
            return (
              <g key={i}>
                <line
                  x1={`${pos}%`}
                  y1="0"
                  x2={`${pos}%`}
                  y2="100%"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="1"
                />
                <line
                  x1="0"
                  y1={`${pos}%`}
                  x2="100%"
                  y2={`${pos}%`}
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="1"
                />
              </g>
            );
          })}
        </svg>

        {/* Map image */}
        <img
          src={canvasDataUrl}
          alt="Minimap Expanded"
          onClick={(e) => {
            if (!pickMode) return;
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            const px = e.clientX - rect.left;
            const py = e.clientY - rect.top;
            const gx = Math.round((px / expandedSize) * costmapWidth);
            const gy = Math.round((py / expandedSize) * costmapHeight);
            onPickGoal?.(
              Math.max(2, Math.min(costmapWidth - 2, gx)),
              Math.max(2, Math.min(costmapHeight - 2, gy)),
            );
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            imageRendering: 'pixelated',
          }}
        />

        {/* Header */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.7), transparent)',
            padding: '14px 16px',
            color: '#e2e8f0',
            fontSize: 12,
            fontFamily: 'monospace',
            textTransform: 'uppercase',
            letterSpacing: 1,
            zIndex: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontWeight: 600 }}>{pickMode ? '✛ Click to set goal' : '⊞ Strategic Map'}</span>
          <button
            onClick={() => setIsExpanded(false)}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#e2e8f0',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 10,
              fontFamily: 'monospace',
              cursor: 'pointer',
              transition: 'all 150ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.25)';
              e.currentTarget.style.border = '1px solid rgba(255,255,255,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
              e.currentTarget.style.border = '1px solid rgba(255,255,255,0.25)';
            }}
            title="Collapse"
          >
            ✕ Close
          </button>
        </div>

        {/* Legend */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.8))',
            padding: '12px 16px',
            fontSize: 9,
            fontFamily: 'monospace',
            color: '#94a3b8',
            zIndex: 3,
            letterSpacing: 0.5,
          }}
        >
          <div style={{ marginBottom: 6 }}>🤖 Blue = Robot  |  🎯 Red = Goal  |  🟢 Green = Path</div>
          <div>🟩 Green = Safe  |  🟨 Gray = Rough  |  🟥 Dark = Obstacle</div>
        </div>
      </div>
    </div>
  );
}
