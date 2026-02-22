'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with Three.js
const SimulationScene = dynamic(
  () => import('@/components/simulation/Scene'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-500 animate-spin" />
            <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-amber-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          </div>
          <p className="text-white/60 text-sm font-mono tracking-widest uppercase">
            Loading Simulation
          </p>
          <p className="text-white/30 text-xs font-mono mt-2">
            Initializing desert environment...
          </p>
        </div>
      </div>
    ),
  }
);

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Simulation Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-black">
          <div className="text-center text-white/60 font-mono">
            <p className="text-red-400 mb-2">Failed to load simulation</p>
            <p className="text-xs">{this.state.error?.message}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function SimulationPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center bg-black">
          <div className="text-white/60 text-sm font-mono">Loading 3D Engine...</div>
        </div>
      }>
        <SimulationScene className="w-full h-full" />
      </Suspense>
    </ErrorBoundary>
  );
}
