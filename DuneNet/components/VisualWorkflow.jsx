"use client";

import { useCallback, useState, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import NodeEditModal from "./NodeEditModal";
import { 
  Upload, Play, RotateCcw, Settings, CheckCircle2, 
  XCircle, Clock, Zap, Image as ImageIcon, Brain,
  Layers, Filter, Target, BarChart3, Eye
} from "lucide-react";

// Custom Node Component
const CustomNode = ({ data, id }) => {
  const getStatusColor = () => {
    switch (data.status) {
      case 'success': return 'border-green-500 bg-green-500/10';
      case 'error': return 'border-red-500 bg-red-500/10';
      case 'processing': return 'border-yellow-500 bg-yellow-500/10 animate-pulse';
      case 'pending': return 'border-gray-500 bg-gray-500/10';
      default: return 'border-border bg-card';
    }
  };

  const getStatusIcon = () => {
    switch (data.status) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing': return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const Icon = data.icon || Brain;

  return (
    <div className={`px-4 py-3 rounded-lg border-2 ${getStatusColor()} min-w-[200px] transition-all duration-300 shadow-lg`}>
      {/* Source Handle (output) */}
      <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-emerald-500 border-2 border-background" 
           style={{ zIndex: 10 }} 
           data-handleid={`${id}-source`}
           data-handlepos="right" />
      
      {/* Target Handle (input) */}
      <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-blue-500 border-2 border-background" 
           style={{ zIndex: 10 }}
           data-handleid={`${id}-target`}
           data-handlepos="left" />
      
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          <span className="font-semibold text-sm">{data.label}</span>
        </div>
        {getStatusIcon()}
      </div>
      
      {data.description && (
        <p className="text-xs text-muted-foreground mb-2">{data.description}</p>
      )}
      
      {data.processing && (
        <div className="mb-2">
          <div className="w-full bg-gray-700 rounded-full h-1.5 mb-1">
            <div 
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${data.progress || 0}%` }}
            />
          </div>
          <p className="text-xs text-yellow-500">{data.processingText || 'Processing...'}</p>
        </div>
      )}
      
      {data.metrics && (
        <div className="space-y-1">
          {Object.entries(data.metrics).map(([key, value]) => (
            <div key={key} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{key}:</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      )}

      {data.editable && (
        <Button 
          size="sm" 
          variant="ghost" 
          className="w-full mt-2 h-7 text-xs"
          onClick={() => data.onEdit?.(id)}
        >
          <Settings className="h-3 w-3 mr-1" />
          Modify
        </Button>
      )}
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

export default function VisualWorkflow() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [editingNode, setEditingNode] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState('checking');
  const [apiError, setApiError] = useState(null);

  // Check API status on mount
  useEffect(() => {
    checkApiStatus();
  }, []);

  const checkApiStatus = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/`);
      if (response.ok) {
        const data = await response.json();
        setApiStatus(data.model_loaded ? 'ready' : 'no-model');
        setApiError(null);
      } else {
        setApiStatus('error');
        setApiError('API returned error');
      }
    } catch (error) {
      setApiStatus('offline');
      setApiError('Cannot connect to API server on port 8000');
    }
  };

  // Initialize workflow nodes
  useEffect(() => {
    const initialNodes = [
      // Input Layer
      {
        id: '1',
        type: 'custom',
        position: { x: 50, y: 150 },
        data: {
          label: 'Image Input',
          description: 'Raw terrain image',
          icon: ImageIcon,
          status: 'pending',
          editable: false,
        },
      },
      
      // Preprocessing Layer
      {
        id: '2',
        type: 'custom',
        position: { x: 300, y: 50 },
        data: {
          label: 'Resize',
          description: '224x224 pixels',
          icon: Filter,
          status: 'pending',
          editable: true,
          metrics: { Size: '224x224' },
          onEdit: handleNodeEdit,
        },
      },
      {
        id: '2b',
        type: 'custom',
        position: { x: 300, y: 180 },
        data: {
          label: 'Normalize',
          description: 'ImageNet stats',
          icon: Filter,
          status: 'pending',
          editable: true,
          metrics: { Mean: '[0.485,0.456,0.406]' },
          onEdit: handleNodeEdit,
        },
      },
      {
        id: '2c',
        type: 'custom',
        position: { x: 300, y: 310 },
        data: {
          label: 'Augment',
          description: 'Data augmentation',
          icon: Filter,
          status: 'pending',
          editable: true,
          metrics: { Strength: '0.5' },
          onEdit: handleNodeEdit,
        },
      },
      
      // Feature Extraction
      {
        id: '3',
        type: 'custom',
        position: { x: 600, y: 180 },
        data: {
          label: 'DenseNet-121',
          description: 'Feature extraction',
          icon: Layers,
          status: 'pending',
          editable: true,
          metrics: { Layers: '121', Features: '1024' },
          onEdit: handleNodeEdit,
        },
      },
      
      // Segmentation Head
      {
        id: '4',
        type: 'custom',
        position: { x: 900, y: 180 },
        data: {
          label: 'U-Net Decoder',
          description: 'Segmentation head',
          icon: Target,
          status: 'pending',
          editable: true,
          metrics: { Classes: '10', Output: 'Mask' },
          onEdit: handleNodeEdit,
        },
      },
      
      // Post-processing
      {
        id: '5a',
        type: 'custom',
        position: { x: 1200, y: 80 },
        data: {
          label: 'CRF',
          description: 'Boundary refinement',
          icon: Zap,
          status: 'pending',
          editable: true,
          metrics: { Iterations: '5' },
          onEdit: handleNodeEdit,
        },
      },
      {
        id: '5b',
        type: 'custom',
        position: { x: 1200, y: 210 },
        data: {
          label: 'Smoothing',
          description: 'Gaussian filter',
          icon: Zap,
          status: 'pending',
          editable: true,
          metrics: { Kernel: '3x3' },
          onEdit: handleNodeEdit,
        },
      },
      {
        id: '5c',
        type: 'custom',
        position: { x: 1200, y: 340 },
        data: {
          label: 'Threshold',
          description: 'Confidence filter',
          icon: Zap,
          status: 'pending',
          editable: true,
          metrics: { Value: '0.5' },
          onEdit: handleNodeEdit,
        },
      },
      
      // Output
      {
        id: '6',
        type: 'custom',
        position: { x: 1500, y: 180 },
        data: {
          label: 'Final Output',
          description: 'Segmentation mask',
          icon: Eye,
          status: 'pending',
          editable: false,
        },
      },
    ];

    const initialEdges = [
      // Input to preprocessing
      { id: 'e1-2', source: '1', target: '2', type: 'smoothstep', animated: false, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' } },
      { id: 'e1-2b', source: '1', target: '2b', type: 'smoothstep', animated: false, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' } },
      { id: 'e1-2c', source: '1', target: '2c', type: 'smoothstep', animated: false, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' } },
      
      // Preprocessing to feature extraction
      { id: 'e2-3', source: '2', target: '3', type: 'smoothstep', animated: false, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' } },
      { id: 'e2b-3', source: '2b', target: '3', type: 'smoothstep', animated: false, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' } },
      { id: 'e2c-3', source: '2c', target: '3', type: 'smoothstep', animated: false, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' } },
      
      // Feature extraction to segmentation
      { id: 'e3-4', source: '3', target: '4', type: 'smoothstep', animated: false, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' } },
      
      // Segmentation to post-processing
      { id: 'e4-5a', source: '4', target: '5a', type: 'smoothstep', animated: false, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' } },
      { id: 'e4-5b', source: '4', target: '5b', type: 'smoothstep', animated: false, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' } },
      { id: 'e4-5c', source: '4', target: '5c', type: 'smoothstep', animated: false, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' } },
      
      // Post-processing to output
      { id: 'e5a-6', source: '5a', target: '6', type: 'smoothstep', animated: false, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' } },
      { id: 'e5b-6', source: '5b', target: '6', type: 'smoothstep', animated: false, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' } },
      { id: 'e5c-6', source: '5c', target: '6', type: 'smoothstep', animated: false, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' } },
    ];

    setNodes(initialNodes);
    setEdges(initialEdges);
  }, []);

  const handleNodeEdit = (nodeId) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setEditingNode(node);
      setIsEditModalOpen(true);
    }
  };

  const handleSaveNodeParams = (nodeId, params) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { 
              ...node, 
              data: { 
                ...node.data, 
                params,
                metrics: { ...node.data.metrics, Modified: '✓' }
              } 
            }
          : node
      )
    );
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);

      // Update first node
      setNodes((nds) =>
        nds.map((node) =>
          node.id === '1'
            ? { ...node, data: { ...node.data, status: 'success' } }
            : node
        )
      );
    }
  };

  const simulateWorkflow = async () => {
    if (!selectedImage) return;

    setIsProcessing(true);
    
    try {
      // Step 1: Preprocessing (parallel)
      await Promise.all([
        processNode('2', 'Resize', ['Resizing to 224x224...', 'Complete'], 800),
        processNode('2b', 'Normalize', ['Applying ImageNet normalization...', 'Complete'], 800),
        processNode('2c', 'Augment', ['Applying augmentation...', 'Complete'], 800),
      ]);

      // Step 2: Feature Extraction
      await processNode('3', 'DenseNet-121', [
        'Loading backbone...',
        'Layer 1-40 processing...',
        'Layer 41-80 processing...',
        'Layer 81-121 processing...',
        'Feature maps ready (1024 channels)',
      ], 2500);

      // Step 3: Segmentation - Call actual API
      setNodes((nds) =>
        nds.map((node) =>
          node.id === '4'
            ? { 
                ...node, 
                data: { 
                  ...node.data, 
                  status: 'processing',
                  processing: true,
                  progress: 0,
                  processingText: 'Calling API server...'
                } 
              }
            : node
        )
      );

      setEdges((eds) =>
        eds.map((edge) =>
          edge.target === '4'
            ? { ...edge, animated: true, style: { stroke: '#10b981', strokeWidth: 3 } }
            : edge
        )
      );

      const formData = new FormData();
      formData.append('file', selectedImage);

      setNodes((nds) =>
        nds.map((node) =>
          node.id === '4'
            ? { 
                ...node, 
                data: { 
                  ...node.data, 
                  progress: 50,
                  processingText: 'Running U-Net decoder...'
                } 
              }
            : node
        )
      );

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/predict`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      const result = await response.json();

      setNodes((nds) =>
        nds.map((node) =>
          node.id === '4'
            ? { 
                ...node, 
                data: { 
                  ...node.data, 
                  progress: 100,
                  processingText: 'Segmentation complete!',
                  status: 'success',
                  processing: false,
                  metrics: { 
                    Class: result.class_name,
                    Conf: `${(result.confidence * 100).toFixed(1)}%`,
                    Device: result.device_used
                  }
                } 
              }
            : node
        )
      );

      setEdges((eds) =>
        eds.map((edge) =>
          edge.target === '4'
            ? { ...edge, animated: false, style: { stroke: '#10b981', strokeWidth: 2 } }
            : edge
        )
      );

      // Step 4: Post-processing (parallel)
      await Promise.all([
        processNode('5a', 'CRF', ['Applying CRF...', 'Refining boundaries...', 'Complete'], 1000),
        processNode('5b', 'Smoothing', ['Gaussian smoothing...', 'Complete'], 1000),
        processNode('5c', 'Threshold', ['Applying threshold...', 'Complete'], 1000),
      ]);

      // Step 5: Final output
      await processNode('6', 'Final Output', [
        'Merging results...',
        'Generating mask...',
        'Complete!',
      ], 800, {
        'mIoU': '85.2%',
        'Accuracy': '95.1%',
        'Device': result.device_used
      });

      setIsProcessing(false);

    } catch (error) {
      console.error('Pipeline error:', error);
      
      setNodes((nds) =>
        nds.map((node) =>
          node.data.status === 'processing'
            ? { 
                ...node, 
                data: { 
                  ...node.data, 
                  status: 'error',
                  processing: false,
                  metrics: { 
                    ...node.data.metrics, 
                    Error: error.message 
                  }
                } 
              }
            : node
        )
      );
      
      setIsProcessing(false);
    }
  };

  const processNode = async (nodeId, nodeName, steps, totalDuration, finalMetrics = null) => {
    // Set to processing
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { 
              ...node, 
              data: { 
                ...node.data, 
                status: 'processing',
                processing: true,
                progress: 0,
                processingText: steps[0]
              } 
            }
          : node
      )
    );

    // Animate edge
    setEdges((eds) =>
      eds.map((edge) =>
        edge.target === nodeId
          ? { ...edge, animated: true, style: { stroke: '#10b981', strokeWidth: 3 } }
          : edge
      )
    );

    // Process sub-steps
    for (let i = 0; i < steps.length; i++) {
      const progress = ((i + 1) / steps.length) * 100;
      
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { 
                ...node, 
                data: { 
                  ...node.data, 
                  progress,
                  processingText: steps[i]
                } 
              }
            : node
        )
      );
      
      await new Promise((resolve) => setTimeout(resolve, totalDuration / steps.length));
    }

    // Mark as success
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { 
              ...node, 
              data: { 
                ...node.data, 
                status: 'success',
                processing: false,
                progress: 100,
                metrics: finalMetrics || node.data.metrics
              } 
            }
          : node
      )
    );

    // Update edge
    setEdges((eds) =>
      eds.map((edge) =>
        edge.target === nodeId
          ? { ...edge, animated: false, style: { stroke: '#10b981', strokeWidth: 2 } }
          : edge
      )
    );
  };

  const resetWorkflow = () => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: { ...node.data, status: node.id === '1' && selectedImage ? 'success' : 'pending' },
      }))
    );
    setEdges((eds) =>
      eds.map((edge) => ({ ...edge, animated: false, style: {} }))
    );
  };

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className="space-y-4">
      {/* Edit Modal */}
      <NodeEditModal
        node={editingNode}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveNodeParams}
      />

      {/* Control Panel */}
      <Card className="border-border/40 backdrop-blur-sm bg-card/50">
        <CardHeader>
          <CardTitle className="ivy-font flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Visual Perception Pipeline
          </CardTitle>
          <CardDescription className="ivy-font">
            Upload an image and watch the UGV perception algorithm process it step-by-step
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* API Status Banner */}
          {apiStatus !== 'ready' && (
            <div className={`p-3 rounded-lg border ${
              apiStatus === 'offline' ? 'bg-red-500/10 border-red-500/20' :
              apiStatus === 'checking' ? 'bg-yellow-500/10 border-yellow-500/20' :
              'bg-orange-500/10 border-orange-500/20'
            }`}>
              <div className="flex items-center gap-2">
                {apiStatus === 'checking' ? (
                  <Clock className="h-4 w-4 text-yellow-500 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold">
                    {apiStatus === 'offline' ? 'API Server Offline' :
                     apiStatus === 'checking' ? 'Checking API...' :
                     apiStatus === 'no-model' ? 'Model Not Loaded' :
                     'API Error'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {apiError || 'Make sure FastAPI server is running on port 8000'}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={checkApiStatus}>
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              </div>
            </div>
          )}

          {apiStatus === 'ready' && (
            <div className="p-3 rounded-lg border bg-green-500/10 border-green-500/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                  API Server Connected
                </p>
                <Badge variant="outline" className="ml-auto">
                  {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}
                </Badge>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="file"
                id="workflow-upload"
                className="hidden"
                accept="image/*"
                onChange={handleFileSelect}
              />
              <label htmlFor="workflow-upload">
                <Button variant="outline" className="w-full" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Terrain Image
                  </span>
                </Button>
              </label>
            </div>
            
            <Button
              onClick={simulateWorkflow}
              disabled={!selectedImage || isProcessing || apiStatus !== 'ready'}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              <Play className="h-4 w-4 mr-2" />
              {isProcessing ? 'Processing...' : 'Run Pipeline'}
            </Button>

            <Button
              onClick={resetWorkflow}
              variant="outline"
              disabled={isProcessing}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>

          {preview && (
            <div className="relative rounded-lg overflow-hidden border border-border/40">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-32 object-cover"
              />
              <Badge className="absolute top-2 right-2 bg-emerald-500">
                Ready
              </Badge>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Success
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3 text-yellow-500" />
              Processing
            </Badge>
            <Badge variant="outline" className="gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              Failed
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Settings className="h-3 w-3" />
              Editable
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Canvas */}
      <Card className="border-border/40 backdrop-blur-sm bg-card/50">
        <CardContent className="p-0">
          <div style={{ height: '600px' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
              className="bg-background"
            >
              <Controls />
              <MiniMap 
                nodeColor={(node) => {
                  switch (node.data.status) {
                    case 'success': return '#10b981';
                    case 'error': return '#ef4444';
                    case 'processing': return '#eab308';
                    default: return '#6b7280';
                  }
                }}
              />
              <Background variant="dots" gap={12} size={1} />
            </ReactFlow>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
