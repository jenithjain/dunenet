'use client';

import React from 'react';

export default function SegformerArchitectureFlow({ theme = 'dark' }) {
  const isLight = theme === 'light';

  return (
    <div
      className={`w-full rounded-xl border ${isLight ? 'bg-white' : 'bg-black/40'} border-border/40 overflow-hidden`}
      style={{ padding: 12 }}
    >
      <div
        className="w-full"
        style={{
          aspectRatio: '1400 / 920',
          background: isLight ? '#f8fafc' : '#0b0b16',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <img
          src="/segformer_architecture_flow.svg"
          alt="SegFormer-B4 inference pipeline"
          className="w-full h-full object-contain"
          style={{
            filter: isLight ? 'invert(1) hue-rotate(180deg)' : 'none',
          }}
        />
      </div>
    </div>
  );
}
