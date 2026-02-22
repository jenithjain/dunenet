"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, Loader2, CheckCircle2, XCircle, Image as ImageIcon, 
  Sparkles, Layers, Eye, Zap, Download, BarChart3
} from "lucide-react";

const CLASS_COLORS = {
  'Trees': 'rgb(34, 139, 34)',
  'Lush Bushes': 'rgb(0, 255, 127)',
  'Dry Grass': 'rgb(189, 183, 107)',
  'Dry Bushes': 'rgb(139, 119, 101)',
  'Ground Clutter': 'rgb(160, 82, 45)',
  'Flowers': 'rgb(255, 105, 180)',
  'Logs': 'rgb(139, 69, 19)',
  'Rocks': 'rgb(128, 128, 128)',
  'Landscape': 'rgb(210, 180, 140)',
  'Sky': 'rgb(135, 206, 235)',
};

// Modern gradient color scheme for pie chart
const CHART_COLORS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Purple
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', // Pink-Red
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', // Blue
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', // Green-Cyan
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', // Pink-Yellow
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', // Cyan-Purple
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', // Mint-Pink
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', // Coral-Pink
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', // Peach
  'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)', // Red-Blue
];

// Solid colors for fallback
const SOLID_COLORS = [
  '#667eea', '#f5576c', '#4facfe', '#43e97b', '#fa709a',
  '#30cfd0', '#a8edea', '#ff9a9e', '#ffecd2', '#ff6e7f'
];

export default function SegmentationVisualizer() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [processingStage, setProcessingStage] = useState('');
  const [progress, setProgress] = useState(0);
  const [hoveredSlice, setHoveredSlice] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setError(null);
      setResult(null);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setError("Please select a valid image file");
    }
  };

  const simulateProcessing = async () => {
    const stages = [
      { text: 'Analyzing terrain...', progress: 20, duration: 800 },
      { text: 'Extracting features...', progress: 40, duration: 1000 },
      { text: 'Running segmentation model...', progress: 60, duration: 1500 },
      { text: 'Generating mask...', progress: 80, duration: 800 },
      { text: 'Finalizing results...', progress: 95, duration: 500 },
    ];

    for (const stage of stages) {
      setProcessingStage(stage.text);
      setProgress(stage.progress);
      await new Promise(resolve => setTimeout(resolve, stage.duration));
    }
  };

  const handleGenerate = async () => {
    if (!selectedFile) {
      setError("Please select an image first");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      // Start visual processing simulation
      const processingPromise = simulateProcessing();
      
      // Make actual API call
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/predict`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      await processingPromise; // Wait for visual simulation to complete
      
      const data = await response.json();
      console.log('API Response:', {
        has_segmentation_mask: !!data.segmentation_mask,
        has_overlay: !!data.overlay_image,
        has_trav_map: !!data.traversability_map,
        has_trav_overlay: !!data.traversability_overlay,
        has_trav_stats: !!data.traversability_stats
      });
      
      setProgress(100);
      setProcessingStage('Complete!');
      
      // Simulate a slight delay before showing results
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setResult(data);
    } catch (err) {
      setError(err.message || "Failed to generate segmentation. Make sure the API server is running.");
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
      setProgress(0);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setProgress(0);
    setProcessingStage('');
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="border-border/40 backdrop-blur-sm bg-card/50">
        <CardHeader>
          <CardTitle className="ivy-font flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-500" />
            Desert Terrain Segmentation
          </CardTitle>
          <CardDescription className="ivy-font">
            Upload a desert terrain image and watch AI segment it into 10 semantic classes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!preview ? (
            <div className="border-2 border-dashed border-border/40 rounded-lg p-12 text-center hover:border-emerald-500/50 transition-all duration-300 bg-muted/20">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept="image/*"
                onChange={handleFileSelect}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 rounded-full bg-emerald-500/10">
                    <Upload className="h-12 w-12 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold ivy-font mb-2">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-sm text-muted-foreground ivy-font">
                      PNG, JPG, JPEG • Desert terrain images work best
                    </p>
                  </div>
                </div>
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden border-2 border-border/40 bg-black">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-auto max-h-96 object-contain"
                />
                <Badge className="absolute top-3 right-3 bg-emerald-500">
                  Ready
                </Badge>
              </div>
              
              <div className="flex gap-3">
                <Button
                  onClick={handleGenerate}
                  disabled={isProcessing}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white ivy-font h-12 text-base"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      Generate Segmentation
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="ivy-font h-12"
                  disabled={isProcessing}
                >
                  Reset
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processing Animation */}
      {isProcessing && (
        <Card className="border-emerald-500/50 backdrop-blur-sm bg-linear-to-br from-emerald-500/10 to-blue-500/10 animate-pulse">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
                <div className="flex-1">
                  <p className="font-semibold ivy-font text-lg">{processingStage}</p>
                  <p className="text-sm text-muted-foreground ivy-font">
                    AI is analyzing your terrain image...
                  </p>
                </div>
                <span className="text-2xl font-bold text-emerald-500">{progress}%</span>
              </div>
              
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-linear-to-r from-emerald-500 to-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              <div className="grid grid-cols-4 gap-2 pt-2">
                {['Analyzing', 'Extracting', 'Segmenting', 'Rendering'].map((step, idx) => (
                  <div 
                    key={step}
                    className={`text-center p-2 rounded-lg transition-all duration-300 ${
                      progress > (idx + 1) * 25 
                        ? 'bg-emerald-500/20 text-emerald-500' 
                        : 'bg-muted/20 text-muted-foreground'
                    }`}
                  >
                    <p className="text-xs font-medium ivy-font">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Display */}
      {result && !isProcessing && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Success Banner */}
          <Card className="border-emerald-500/50 backdrop-blur-sm bg-linear-to-r from-emerald-500/10 to-green-500/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-emerald-500">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xl font-bold ivy-font">Segmentation Complete!</p>
                  <p className="text-sm text-muted-foreground ivy-font">
                    Your terrain has been analyzed and segmented into semantic classes
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Results - Large Images */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Segmentation Mask - LARGE */}
            <Card className="border-emerald-500/50 backdrop-blur-sm bg-card/50">
              <CardHeader>
                <CardTitle className="ivy-font flex items-center gap-2">
                  <Layers className="h-6 w-6 text-emerald-500" />
                  Segmentation Mask
                </CardTitle>
                <CardDescription className="ivy-font">
                  10 semantic classes with color coding
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative rounded-lg overflow-hidden border-2 border-emerald-500/40">
                  {result.segmentation_mask ? (
                    <img
                      src={result.segmentation_mask}
                      alt="Segmentation Mask"
                      className="w-full h-auto"
                    />
                  ) : (
                    <div className="relative w-full aspect-video bg-linear-to-br from-emerald-900/20 to-blue-900/20 flex items-center justify-center">
                      <Layers className="h-16 w-16 text-emerald-500 opacity-50" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Traversability Map - LARGE */}
            <Card className="border-orange-500/50 backdrop-blur-sm bg-card/50">
              <CardHeader>
                <CardTitle className="ivy-font flex items-center gap-2">
                  <Zap className="h-6 w-6 text-orange-500" />
                  Traversability Map
                </CardTitle>
                <CardDescription className="ivy-font">
                  Drivable (Green) / Caution (Orange) / Blocked (Red)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative rounded-lg overflow-hidden border-2 border-orange-500/40">
                  {result.traversability_map ? (
                    <img
                      src={result.traversability_map}
                      alt="Traversability Map"
                      className="w-full h-auto"
                    />
                  ) : (
                    <div className="relative w-full aspect-video bg-linear-to-br from-orange-900/20 to-red-900/20 flex items-center justify-center">
                      <Zap className="h-16 w-16 text-orange-500 opacity-50" />
                    </div>
                  )}
                </div>
                {result.traversability_stats && (
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <p className="text-xs text-muted-foreground ivy-font mb-1">Safe</p>
                      <p className="text-lg font-bold text-green-500 ivy-font">
                        {result.traversability_stats.safe}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                      <p className="text-xs text-muted-foreground ivy-font mb-1">Caution</p>
                      <p className="text-lg font-bold text-orange-500 ivy-font">
                        {result.traversability_stats.caution}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <p className="text-xs text-muted-foreground ivy-font mb-1">Blocked</p>
                      <p className="text-lg font-bold text-red-500 ivy-font">
                        {result.traversability_stats.blocked}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Secondary Results - Smaller Images */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Original Image - SMALL */}
            <Card className="border-border/40 backdrop-blur-sm bg-card/50">
              <CardHeader className="pb-3">
                <CardTitle className="ivy-font flex items-center gap-2 text-sm">
                  <ImageIcon className="h-4 w-4" />
                  Original
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative rounded-lg overflow-hidden border border-border/40">
                  <img
                    src={preview}
                    alt="Original"
                    className="w-full h-auto"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Segmentation Overlay - SMALL */}
            {result.overlay_image && (
              <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                <CardHeader className="pb-3">
                  <CardTitle className="ivy-font flex items-center gap-2 text-sm">
                    <Eye className="h-4 w-4 text-blue-500" />
                    Overlay
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative rounded-lg overflow-hidden border border-blue-500/40">
                    <img
                      src={result.overlay_image}
                      alt="Overlay"
                      className="w-full h-auto"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Traversability Overlay - SMALL */}
            {result.traversability_overlay && (
              <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                <CardHeader className="pb-3">
                  <CardTitle className="ivy-font flex items-center gap-2 text-sm">
                    <Zap className="h-4 w-4 text-orange-500" />
                    Trav. Overlay
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative rounded-lg overflow-hidden border border-orange-500/40">
                    <img
                      src={result.traversability_overlay}
                      alt="Traversability Overlay"
                      className="w-full h-auto"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Class Distribution */}
          <Card className="border-border/40 backdrop-blur-sm bg-card/50">
            <CardHeader>
              <CardTitle className="ivy-font flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Detected Classes
              </CardTitle>
              <CardDescription className="ivy-font">
                Semantic segmentation results showing terrain composition
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Dominant Class */}
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground ivy-font">
                      Dominant Class
                    </span>
                    <Badge className="bg-emerald-500">
                      {(result.confidence * 100).toFixed(1)}% confidence
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold ivy-font text-emerald-500">
                    {result.class_name}
                  </p>
                </div>

                {/* Terrain Composition - Pie Chart + Labels */}
                {result.class_distribution && Object.keys(result.class_distribution).length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground ivy-font mb-4">
                      Terrain Composition
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Pie Chart - Left Side */}
                      <div className="flex items-center justify-center relative">
                        <div className="relative w-64 h-64">
                          <svg viewBox="0 0 200 200" className="transform -rotate-90">
                            {/* Shadow/Glow effect */}
                            <defs>
                              <filter id="glow">
                                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                                <feMerge>
                                  <feMergeNode in="coloredBlur"/>
                                  <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                              </filter>
                            </defs>
                            {(() => {
                              let currentAngle = 0;
                              return Object.entries(result.class_distribution).map(([className, percentage], idx) => {
                                const percent = parseFloat(percentage) / 100;
                                const angle = percent * 360;
                                const startAngle = currentAngle;
                                const endAngle = currentAngle + angle;
                                
                                // Calculate path for pie slice
                                const startRad = (startAngle * Math.PI) / 180;
                                const endRad = (endAngle * Math.PI) / 180;
                                const x1 = 100 + 90 * Math.cos(startRad);
                                const y1 = 100 + 90 * Math.sin(startRad);
                                const x2 = 100 + 90 * Math.cos(endRad);
                                const y2 = 100 + 90 * Math.sin(endRad);
                                const largeArc = angle > 180 ? 1 : 0;
                                
                                const path = `M 100 100 L ${x1} ${y1} A 90 90 0 ${largeArc} 1 ${x2} ${y2} Z`;
                                
                                currentAngle = endAngle;
                                
                                const isHovered = hoveredSlice === className;
                                
                                return (
                                  <g key={className}>
                                    <path
                                      d={path}
                                      fill={SOLID_COLORS[idx % SOLID_COLORS.length]}
                                      stroke="rgba(0,0,0,0.1)"
                                      strokeWidth="1"
                                      className="transition-all duration-300 cursor-pointer"
                                      style={{
                                        opacity: isHovered ? 1 : 0.9,
                                        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                                        transformOrigin: '100px 100px',
                                        filter: isHovered ? 'url(#glow)' : 'none'
                                      }}
                                      onMouseEnter={() => setHoveredSlice(className)}
                                      onMouseLeave={() => setHoveredSlice(null)}
                                    />
                                  </g>
                                );
                              });
                            })()}
                          </svg>
                          
                          {/* Center circle for donut effect */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-24 h-24 rounded-full bg-background border-4 border-border/40 flex items-center justify-center">
                              <div className="text-center">
                                <p className="text-xs text-muted-foreground ivy-font">Total</p>
                                <p className="text-lg font-bold ivy-font">
                                  {Object.keys(result.class_distribution).length}
                                </p>
                                <p className="text-xs text-muted-foreground ivy-font">classes</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Tooltip */}
                        {hoveredSlice && (
                          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full mb-2 px-4 py-2 bg-black/90 text-white rounded-lg shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <div className="text-center">
                              <p className="text-sm font-semibold">{hoveredSlice}</p>
                              <p className="text-lg font-bold">{result.class_distribution[hoveredSlice]}</p>
                            </div>
                            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                              <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90"></div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Labels - Right Side */}
                      <div className="flex flex-col justify-center space-y-2">
                        {Object.entries(result.class_distribution).map(([className, percentage], idx) => {
                          const isHovered = hoveredSlice === className;
                          return (
                            <div 
                              key={className} 
                              className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 cursor-pointer ${
                                isHovered 
                                  ? 'bg-muted/50 scale-105 shadow-lg' 
                                  : 'hover:bg-muted/30'
                              }`}
                              onMouseEnter={() => setHoveredSlice(className)}
                              onMouseLeave={() => setHoveredSlice(null)}
                            >
                              <div 
                                className="w-4 h-4 rounded-full shrink-0 transition-transform duration-300 shadow-md" 
                                style={{ 
                                  backgroundColor: SOLID_COLORS[idx % SOLID_COLORS.length],
                                  transform: isHovered ? 'scale(1.3)' : 'scale(1)'
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ivy-font truncate transition-colors ${
                                  isHovered ? 'text-foreground' : 'text-muted-foreground'
                                }`}>
                                  {className}
                                </p>
                              </div>
                              <div className="shrink-0">
                                <span className={`text-sm font-bold ivy-font transition-all ${
                                  isHovered ? 'text-lg text-foreground' : ''
                                }`}>
                                  {percentage}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card className="border-border/40 backdrop-blur-sm bg-card/50">
            <CardHeader>
              <CardTitle className="ivy-font flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Processing Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground ivy-font mb-1">Model</p>
                  <p className="text-sm font-semibold ivy-font">Segformer</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground ivy-font mb-1">Classes</p>
                  <p className="text-sm font-semibold ivy-font">10</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground ivy-font mb-1">Device</p>
                  <p className="text-sm font-semibold ivy-font">{result.device_used}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground ivy-font mb-1">Status</p>
                  <p className="text-sm font-semibold ivy-font text-emerald-500">Success</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-red-500/50 backdrop-blur-sm bg-red-500/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <XCircle className="h-6 w-6 text-red-500" />
              <div>
                <p className="font-semibold ivy-font text-red-500">Error</p>
                <p className="text-sm text-red-400 ivy-font">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
