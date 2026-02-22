'use client';

/* ═══════════════════════════════════════════════════════════════
   Live Inference Panel
   Shows real-time model inference results during simulation:
   segmentation mask, traversability map, stats, and timing.
   ═══════════════════════════════════════════════════════════════ */

export interface InferenceResult {
  segmentation_mask: string;
  traversability_map: string;
  traversability_overlay: string;
  traversability_stats: { safe: string; caution: string; blocked: string };
  traversability_grid: number[][];
  class_distribution: Record<string, string>;
  inference_time_ms: number;
  dominant_class: string;
  confidence: number;
}

interface LiveInferencePanelProps {
  enabled: boolean;
  data: InferenceResult | null;
  capturedImage: string | null;
  inferenceCount: number;
  isProcessing: boolean;
  error: string | null;
}

/* ── Stat bar ── */
function StatBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span style={{ color: '#94a3b8', width: 52, fontSize: 10 }}>{label}</span>
      <div
        style={{
          flex: 1,
          height: 6,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(100, value)}%`,
            height: '100%',
            background: color,
            borderRadius: 3,
            transition: 'width 0.6s ease',
          }}
        />
      </div>
      <span style={{ color, fontSize: 10, width: 40, textAlign: 'right' }}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

/* ── Image card ── */
function ImgCard({
  label,
  src,
  alt,
}: {
  label: string;
  src: string;
  alt: string;
}) {
  return (
    <div>
      <div
        style={{
          color: '#64748b',
          fontSize: 9,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <img
        src={src}
        alt={alt}
        style={{
          width: '100%',
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      />
    </div>
  );
}

/* ── Main panel ── */
export default function LiveInferencePanel({
  enabled,
  data,
  capturedImage,
  inferenceCount,
  isProcessing,
  error,
}: LiveInferencePanelProps) {
  if (!enabled) return null;

  const pct = (s: string) => parseFloat(s) || 0;
  const safe = data ? pct(data.traversability_stats.safe) : 0;
  const caution = data ? pct(data.traversability_stats.caution) : 0;
  const blocked = data ? pct(data.traversability_stats.blocked) : 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: 80,
        right: 280,
        zIndex: 15,
        width: 280,
        maxHeight: 'calc(100vh - 200px)',
        overflowY: 'auto',
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 14,
        padding: '14px 16px',
        color: '#e2e8f0',
        fontSize: 11,
        fontFamily: 'monospace',
        pointerEvents: 'auto',
      }}
      className="live-inf-scroll"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{
              background: isProcessing
                ? '#f59e0b'
                : error
                  ? '#ef4444'
                  : '#22c55e',
              boxShadow: `0 0 8px ${isProcessing ? '#f59e0b' : error ? '#ef4444' : '#22c55e'}`,
              animation: isProcessing ? 'liveInfPulse 1s infinite' : 'none',
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 600 }}>Live Inference</span>
        </div>
        <span style={{ color: '#64748b', fontSize: 10 }}>#{inferenceCount}</span>
      </div>

      {/* ── Error ── */}
      {error && (
        <div
          style={{
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8,
            padding: '6px 10px',
            color: '#fca5a5',
            fontSize: 10,
            marginBottom: 10,
            wordBreak: 'break-word',
          }}
        >
          {error}
        </div>
      )}

      {/* ── Waiting state ── */}
      {!data && !error && (
        <div style={{ color: '#64748b', textAlign: 'center', padding: '20px 0' }}>
          {isProcessing ? (
            <>
              <div
                style={{
                  width: 20,
                  height: 20,
                  border: '2px solid rgba(168,85,247,0.25)',
                  borderTop: '2px solid #a855f7',
                  borderRadius: '50%',
                  animation: 'liveInfSpin 0.8s linear infinite',
                  margin: '0 auto 8px',
                }}
              />
              Processing first capture…
            </>
          ) : (
            'Waiting for capture…'
          )}
        </div>
      )}

      {/* ── Results ── */}
      {data && (
        <>
          {/* 2×2 image grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
              marginBottom: 10,
            }}
          >
            {capturedImage && (
              <ImgCard label="Captured" src={capturedImage} alt="FPV capture" />
            )}
            <ImgCard
              label="Segmentation"
              src={data.segmentation_mask}
              alt="Segmentation mask"
            />
            <ImgCard
              label="Traversability"
              src={data.traversability_map}
              alt="Traversability map"
            />
            <ImgCard
              label="Overlay"
              src={data.traversability_overlay}
              alt="Traversability overlay"
            />
          </div>

          {/* ── Traversability stats ── */}
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                color: '#64748b',
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              Traversability Analysis
            </div>
            <StatBar label="Safe" value={safe} color="#22c55e" />
            <StatBar label="Caution" value={caution} color="#f59e0b" />
            <StatBar label="Blocked" value={blocked} color="#ef4444" />
          </div>

          {/* ── Dominant class ── */}
          <div style={{ marginBottom: 8 }}>
            <div className="flex justify-between">
              <span style={{ color: '#64748b' }}>Dominant</span>
              <span>{data.dominant_class}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: '#64748b' }}>Confidence</span>
              <span>{(data.confidence * 100).toFixed(1)}%</span>
            </div>
          </div>

          {/* ── Costmap grid preview ── */}
          {data.traversability_grid?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  color: '#64748b',
                  fontSize: 9,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  marginBottom: 4,
                }}
              >
                Costmap Patch
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${data.traversability_grid[0].length}, 1fr)`,
                  gap: 1,
                  borderRadius: 4,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {data.traversability_grid.flat().map((v, i) => (
                  <div
                    key={i}
                    style={{
                      aspectRatio: '1',
                      background:
                        v >= 10
                          ? '#dc2626'
                          : v >= 5
                            ? '#f59e0b'
                            : '#22c55e',
                      opacity: 0.7,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Footer info ── */}
          <div
            style={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: 8,
              display: 'flex',
              justifyContent: 'space-between',
              color: '#64748b',
              fontSize: 10,
            }}
          >
            <span>{data.inference_time_ms}ms</span>
            <span>SegFormer MIT-B4</span>
          </div>
        </>
      )}

      {/* scoped styles */}
      <style>{`
        .live-inf-scroll::-webkit-scrollbar { width: 3px; }
        .live-inf-scroll::-webkit-scrollbar-track { background: transparent; }
        .live-inf-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 2px;
        }
        @keyframes liveInfPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes liveInfSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
