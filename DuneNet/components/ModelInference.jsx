"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2, CheckCircle, XCircle, Image as ImageIcon } from "lucide-react";

export default function ModelInference() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

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

  const handlePredict = async () => {
    if (!selectedFile) {
      setError("Please select an image first");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('http://localhost:8000/predict', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message || "Failed to get prediction. Make sure the API server is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <Card className="border-border/40 backdrop-blur-sm bg-card/50">
      <CardHeader>
        <CardTitle className="ivy-font flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Model Inference
        </CardTitle>
        <CardDescription className="ivy-font">
          Upload an image to run inference with the trained model
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        <div className="border-2 border-dashed border-border/40 rounded-lg p-8 text-center hover:border-emerald-500/50 transition-colors">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept="image/*"
            onChange={handleFileSelect}
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground ivy-font mb-2">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-muted-foreground ivy-font">
              PNG, JPG, JPEG up to 10MB
            </p>
          </label>
        </div>

        {/* Preview */}
        {preview && (
          <div className="space-y-4">
            <div className="relative rounded-lg overflow-hidden border border-border/40">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-64 object-cover"
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={handlePredict}
                disabled={loading}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white ivy-font"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Run Inference"
                )}
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                className="ivy-font"
              >
                Reset
              </Button>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-5 w-5" />
              <span className="font-semibold ivy-font">Prediction Complete</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground ivy-font mb-1">Prediction</p>
                <p className="text-2xl font-bold ivy-font">{result.prediction}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground ivy-font mb-1">Confidence</p>
                <p className="text-2xl font-bold ivy-font">
                  {(result.confidence * 100).toFixed(2)}%
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="ivy-font">
                Device: {result.device_used}
              </Badge>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <XCircle className="h-5 w-5" />
              <span className="font-semibold ivy-font">Error</span>
            </div>
            <p className="text-sm text-red-600 dark:text-red-400 mt-2 ivy-font">
              {error}
            </p>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground ivy-font space-y-1">
          <p>• Make sure the FastAPI server is running on port 8000</p>
          <p>• Start server: <code className="bg-muted px-1 py-0.5 rounded">python api_server/main.py</code></p>
        </div>
      </CardContent>
    </Card>
  );
}
