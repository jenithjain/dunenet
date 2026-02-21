"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Zap, TrendingUp } from "lucide-react";

export default function NodeEditModal({ node, isOpen, onClose, onSave }) {
  const [params, setParams] = useState({});
  const [predictedImpact, setPredictedImpact] = useState(null);

  // Update params when node changes
  useEffect(() => {
    if (node?.data?.params) {
      setParams(node.data.params);
    } else {
      setParams({});
    }
  }, [node]);

  const handleParamChange = (key, value) => {
    const newParams = { ...params, [key]: value };
    setParams(newParams);
    
    // Simulate impact prediction
    simulateImpact(newParams);
  };

  const simulateImpact = (newParams) => {
    // Simulate what-if analysis
    const baseAccuracy = 85.2;
    const baseMIoU = 82.0;
    const baseSpeed = 45;

    // Simple simulation based on parameter changes
    let accuracyDelta = 0;
    let mIoUDelta = 0;
    let speedDelta = 0;

    if (newParams.imageSize) {
      const sizeRatio = newParams.imageSize / 224;
      accuracyDelta += (sizeRatio - 1) * 2;
      speedDelta -= (sizeRatio - 1) * 20;
    }

    if (newParams.backbone) {
      if (newParams.backbone === 'resnet50') {
        accuracyDelta -= 3;
        speedDelta += 15;
      } else if (newParams.backbone === 'efficientnet') {
        accuracyDelta += 2;
        speedDelta += 10;
      }
    }

    setPredictedImpact({
      accuracy: baseAccuracy + accuracyDelta,
      mIoU: baseMIoU + mIoUDelta + accuracyDelta * 0.8,
      speed: baseSpeed + speedDelta,
      accuracyDelta,
      mIoUDelta: mIoUDelta + accuracyDelta * 0.8,
      speedDelta,
    });
  };

  const getParameterEditor = () => {
    if (!node || !node.data) return null;

    switch (node.id) {
      case '2': // Preprocessing
        return (
          <div className="space-y-4">
            <div>
              <Label>Image Size</Label>
              <Select 
                value={params.imageSize?.toString() || '224'}
                onValueChange={(v) => handleParamChange('imageSize', parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="128">128x128</SelectItem>
                  <SelectItem value="224">224x224</SelectItem>
                  <SelectItem value="256">256x256</SelectItem>
                  <SelectItem value="512">512x512</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Normalization</Label>
              <Select 
                value={params.normalization || 'imagenet'}
                onValueChange={(v) => handleParamChange('normalization', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="imagenet">ImageNet</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Augmentation Strength: {params.augmentation || 0.5}</Label>
              <Slider
                value={[params.augmentation || 0.5]}
                onValueChange={(v) => handleParamChange('augmentation', v[0])}
                min={0}
                max={1}
                step={0.1}
                className="mt-2"
              />
            </div>
          </div>
        );

      case '3': // Feature Extraction
        return (
          <div className="space-y-4">
            <div>
              <Label>Backbone Architecture</Label>
              <Select 
                value={params.backbone || 'densenet121'}
                onValueChange={(v) => handleParamChange('backbone', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="densenet121">DenseNet-121</SelectItem>
                  <SelectItem value="resnet50">ResNet-50</SelectItem>
                  <SelectItem value="efficientnet">EfficientNet-B0</SelectItem>
                  <SelectItem value="mobilenet">MobileNet-V2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Feature Layers</Label>
              <Input
                type="number"
                value={params.layers || 121}
                onChange={(e) => handleParamChange('layers', parseInt(e.target.value))}
              />
            </div>

            <div>
              <Label>Dropout Rate: {params.dropout || 0.2}</Label>
              <Slider
                value={[params.dropout || 0.2]}
                onValueChange={(v) => handleParamChange('dropout', v[0])}
                min={0}
                max={0.5}
                step={0.05}
                className="mt-2"
              />
            </div>
          </div>
        );

      case '4': // Segmentation
        return (
          <div className="space-y-4">
            <div>
              <Label>Decoder Type</Label>
              <Select 
                value={params.decoder || 'unet'}
                onValueChange={(v) => handleParamChange('decoder', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unet">U-Net</SelectItem>
                  <SelectItem value="fpn">FPN</SelectItem>
                  <SelectItem value="deeplabv3">DeepLabV3+</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Number of Classes</Label>
              <Input
                type="number"
                value={params.classes || 10}
                onChange={(e) => handleParamChange('classes', parseInt(e.target.value))}
              />
            </div>

            <div>
              <Label>Skip Connections</Label>
              <Select 
                value={params.skipConnections?.toString() || 'true'}
                onValueChange={(v) => handleParamChange('skipConnections', v === 'true')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Enabled</SelectItem>
                  <SelectItem value="false">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case '5': // Post-processing
        return (
          <div className="space-y-4">
            <div>
              <Label>CRF (Conditional Random Field)</Label>
              <Select 
                value={params.crf?.toString() || 'true'}
                onValueChange={(v) => handleParamChange('crf', v === 'true')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Enabled</SelectItem>
                  <SelectItem value="false">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Smoothing Kernel: {params.smoothing || 3}x{params.smoothing || 3}</Label>
              <Slider
                value={[params.smoothing || 3]}
                onValueChange={(v) => handleParamChange('smoothing', v[0])}
                min={1}
                max={9}
                step={2}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Confidence Threshold: {params.threshold || 0.5}</Label>
              <Slider
                value={[params.threshold || 0.5]}
                onValueChange={(v) => handleParamChange('threshold', v[0])}
                min={0}
                max={1}
                step={0.05}
                className="mt-2"
              />
            </div>
          </div>
        );

      default:
        return <p className="text-muted-foreground">No editable parameters for this node.</p>;
    }
  };

  if (!node) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Edit Node: {node?.data?.label || 'Unknown'}
          </DialogTitle>
          <DialogDescription>
            Modify parameters and see predicted impact on model performance
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="parameters" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="parameters">Parameters</TabsTrigger>
            <TabsTrigger value="impact">What-If Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="parameters" className="space-y-4 mt-4">
            {getParameterEditor()}
          </TabsContent>

          <TabsContent value="impact" className="space-y-4 mt-4">
            {predictedImpact ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4" />
                  Predicted impact of parameter changes
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-1">Accuracy</p>
                    <p className="text-2xl font-bold">{predictedImpact.accuracy.toFixed(1)}%</p>
                    <Badge 
                      variant={predictedImpact.accuracyDelta >= 0 ? "default" : "destructive"}
                      className="mt-2"
                    >
                      {predictedImpact.accuracyDelta >= 0 ? '+' : ''}
                      {predictedImpact.accuracyDelta.toFixed(1)}%
                    </Badge>
                  </div>

                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-1">Mean IoU</p>
                    <p className="text-2xl font-bold">{predictedImpact.mIoU.toFixed(1)}%</p>
                    <Badge 
                      variant={predictedImpact.mIoUDelta >= 0 ? "default" : "destructive"}
                      className="mt-2"
                    >
                      {predictedImpact.mIoUDelta >= 0 ? '+' : ''}
                      {predictedImpact.mIoUDelta.toFixed(1)}%
                    </Badge>
                  </div>

                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-1">Speed (FPS)</p>
                    <p className="text-2xl font-bold">{predictedImpact.speed.toFixed(0)}</p>
                    <Badge 
                      variant={predictedImpact.speedDelta >= 0 ? "default" : "destructive"}
                      className="mt-2"
                    >
                      {predictedImpact.speedDelta >= 0 ? '+' : ''}
                      {predictedImpact.speedDelta.toFixed(0)} FPS
                    </Badge>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-start gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm mb-1">Recommendation</p>
                      <p className="text-sm text-muted-foreground">
                        {predictedImpact.accuracyDelta > 0 
                          ? "These changes should improve model accuracy. Consider testing on validation set."
                          : "These changes may reduce accuracy but improve speed. Good for real-time applications."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Modify parameters to see predicted impact</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={() => {
              onSave(node.id, params);
              onClose();
            }}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            Apply Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
