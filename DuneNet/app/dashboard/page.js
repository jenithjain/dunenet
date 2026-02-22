"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import SegformerArchitectureFlow from "@/components/SegformerArchitectureFlow";
import SegmentationVisualizer from "@/components/SegmentationVisualizer";
import trainingMetrics from "@/data/training_metrics.json";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ComposedChart, Scatter
} from "recharts";
import {
  BookOpen, TrendingUp,
  Users, Activity, GitBranch, FileText, Sparkles, Brain,
  PenTool, Target, Network, Shield
} from "lucide-react";

const toPercent = (value) => Number((value * 100).toFixed(2));

// Training Loss & mIoU Progress (from JSON)
const progressData = trainingMetrics.epoch_metrics.map((entry) => ({
  epoch: `Ep ${entry.epoch}`,
  trainLoss: entry.train_loss,
  valLoss: entry.val_loss,
  mIoU: toPercent(entry.val_miou),
}));

// Per-class IoU Distribution (from JSON)
const classIoUData = trainingMetrics.class_names.map((name) => ({
  name,
  iou: toPercent(trainingMetrics.final_per_class_iou[name] ?? 0),
}));

const CHART_COLORS = {
  light: {
    primary: "#10b981",    // emerald-500
    secondary: "#3b82f6",  // blue-500
    tertiary: "#f59e0b",   // amber-500
    quaternary: "#8b5cf6", // violet-500
    profit: "#10b981",
    revenue: "#3b82f6",
    expenses: "#ef4444",
    portfolio: "#8b5cf6",
    target: "#94a3b8",
  },
  dark: {
    primary: "#34d399",    // emerald-400
    secondary: "#60a5fa",  // blue-400
    tertiary: "#fbbf24",   // amber-400
    quaternary: "#a78bfa", // violet-400
    profit: "#34d399",
    revenue: "#60a5fa",
    expenses: "#f87171",
    portfolio: "#a78bfa",
    target: "#64748b",
  }
};

export default function Dashboard() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [chartColors, setChartColors] = useState(CHART_COLORS.light);

  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
      setChartColors(isDark ? CHART_COLORS.dark : CHART_COLORS.light);
    };
    
    updateTheme();
    
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  const PIE_COLORS = [
    chartColors.primary,
    chartColors.secondary,
    chartColors.tertiary,
    chartColors.quaternary,
  ];

  const StatCard = ({ title, value, note, icon: Icon, trend, change }) => (
    <Card className="overflow-hidden border-border/40 backdrop-blur-sm bg-card/50 hover:bg-card/70 transition-all duration-300 hover:scale-105 hover:shadow-lg group cursor-pointer">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground ivy-font group-hover:text-foreground transition-colors">
          {title}
        </CardTitle>
        <div className="p-2 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500 transition-colors">
          <Icon className="h-4 w-4 text-emerald-500 group-hover:text-white transition-colors" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground ivy-font">{value}</div>
        {change ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <span className={trend === "up" ? "text-emerald-500" : "text-red-500"}>
              {change}
            </span>
            <span>from last month</span>
          </div>
        ) : note ? (
          <div className="text-xs text-muted-foreground mt-1">{note}</div>
        ) : null}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen w-full">
      <div className="container mx-auto p-6 space-y-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground ivy-font mb-2">
              Segmentation Dashboard
            </h1>
            <p className="text-muted-foreground ivy-font">
              Monitor training progress, per-class IoU, and model generalization metrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="px-3 py-1 ivy-font">
              Epoch {trainingMetrics.total_epochs} - Training
            </Badge>
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white ivy-font">
              <PenTool className="h-4 w-4 mr-2" />
              Run Inference
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Best mIoU"
            value={`${toPercent(trainingMetrics.best_miou)}%`}
            note={`Best epoch: ${trainingMetrics.best_epoch}`}
            icon={Target}
            trend="up"
          />
          <StatCard
            title="Final mIoU"
            value={`${toPercent(trainingMetrics.final_miou)}%`}
            note="Final epoch"
            icon={TrendingUp}
            trend="up"
          />
          <StatCard
            title="Best mDice"
            value={`${toPercent(trainingMetrics.best_mdice)}%`}
            note={`Best epoch: ${trainingMetrics.best_epoch}`}
            icon={Shield}
            trend="up"
          />
          <StatCard
            title="Final mDice"
            value={`${toPercent(trainingMetrics.final_mdice)}%`}
            note="Final epoch"
            icon={Network}
            trend="up"
          />
          <StatCard
            title="Best Pixel Acc"
            value={`${toPercent(trainingMetrics.best_pixel_acc)}%`}
            note="Max accuracy"
            icon={GitBranch}
            trend="up"
          />
          <StatCard
            title="Final Pixel Acc"
            value={`${toPercent(trainingMetrics.final_pixel_acc)}%`}
            note="Final epoch"
            icon={Users}
            trend="up"
          />
          <StatCard
            title="Final Train Loss"
            value={trainingMetrics.final_train_loss.toFixed(4)}
            note="Final epoch"
            icon={BookOpen}
            trend="down"
          />
          <StatCard
            title="Final Val Loss"
            value={trainingMetrics.final_val_loss.toFixed(4)}
            note="Final epoch"
            icon={FileText}
            trend="down"
          />
          <StatCard
            title="Total Epochs"
            value={trainingMetrics.total_epochs}
            note="Training schedule"
            icon={Activity}
            trend="up"
          />
          <StatCard
            title="Classes Tracked"
            value={trainingMetrics.class_names.length}
            note="Semantic classes"
            icon={Brain}
            trend="up"
          />
        </div>

        {/* Main Charts */}
        <Tabs defaultValue="segmentation" className="space-y-4">
          <TabsList className="bg-muted/50 backdrop-blur-sm">
            <TabsTrigger value="segmentation" className="ivy-font">AI Segmentation</TabsTrigger>
            <TabsTrigger value="visual" className="ivy-font">Visual Pipeline</TabsTrigger>
            <TabsTrigger value="overview" className="ivy-font">Training Progress</TabsTrigger>
            <TabsTrigger value="analytics" className="ivy-font">Per-Class IoU</TabsTrigger>
          </TabsList>

          {/* AI Segmentation Tab */}
          <TabsContent value="segmentation" className="space-y-4">
            <SegmentationVisualizer />
          </TabsContent>

          {/* Visual Pipeline Tab */}
          <TabsContent value="visual" className="space-y-4">
            <Card className="border-border/40 backdrop-blur-sm bg-card/50">
              <CardHeader>
                <CardTitle className="ivy-font">SegFormer-B4 — Dark</CardTitle>
                <CardDescription className="ivy-font">
                    SVG architecture diagram (dark mode)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SegformerArchitectureFlow theme="dark" />
              </CardContent>
            </Card>

            <Card className="border-border/40 backdrop-blur-sm bg-card/50">
              <CardHeader>
                <CardTitle className="ivy-font">SegFormer-B4 — Light</CardTitle>
                <CardDescription className="ivy-font">
                    SVG architecture diagram (light mode)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SegformerArchitectureFlow theme="light" />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-7">
              <Card className="col-span-4 border-border/40 backdrop-blur-sm bg-card/50">
                <CardHeader>
                  <CardTitle className="ivy-font">Training & Validation Loss</CardTitle>
                  <CardDescription className="ivy-font">
                    Loss convergence across training epochs
                  </CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={progressData}>
                      <defs>
                        <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColors.revenue} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={chartColors.revenue} stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColors.profit} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={chartColors.profit} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                      <XAxis 
                        dataKey="epoch" 
                        stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                        style={{ fontSize: '12px' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                          border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                          borderRadius: '8px',
                          color: isDarkMode ? '#f1f5f9' : '#0f172a'
                        }}
                      />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="trainLoss" 
                        stroke={chartColors.revenue} 
                        fillOpacity={1} 
                        fill="url(#colorActual)"
                        strokeWidth={2}
                        name="Train Loss"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="valLoss" 
                        stroke={chartColors.profit} 
                        fillOpacity={1} 
                        fill="url(#colorVal)"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        name="Val Loss"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="col-span-3 border-border/40 backdrop-blur-sm bg-card/50">
                <CardHeader>
                  <CardTitle className="ivy-font">Per-Class IoU</CardTitle>
                  <CardDescription className="ivy-font">
                    IoU distribution across semantic classes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={classIoUData.slice(0, 4)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="iou"
                      >
                        {classIoUData.slice(0, 4).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                          border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {classIoUData.slice(0, 4).map((cls, idx) => (
                      <div key={cls.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: PIE_COLORS[idx] }}
                          />
                          <span className="text-sm text-muted-foreground ivy-font">{cls.name}</span>
                        </div>
                        <span className="text-sm font-medium ivy-font">{cls.iou}% IoU</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                <CardHeader>
                  <CardTitle className="ivy-font">mIoU Over Epochs</CardTitle>
                  <CardDescription className="ivy-font">
                    Mean IoU progression during training
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={progressData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                      <XAxis 
                        dataKey="epoch" 
                        stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                        style={{ fontSize: '12px' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                          border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="mIoU" 
                        stroke={chartColors.profit} 
                        strokeWidth={3}
                        dot={{ fill: chartColors.profit, r: 5 }}
                        activeDot={{ r: 7 }}
                        name="Mean IoU (%)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                <CardHeader>
                  <CardTitle className="ivy-font">Per-Class IoU Breakdown</CardTitle>
                  <CardDescription className="ivy-font">
                    IoU scores for all 10 semantic classes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={classIoUData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                      <XAxis 
                        dataKey="name" 
                        stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                        style={{ fontSize: '10px' }}
                        angle={-30}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                        style={{ fontSize: '12px' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                          border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Bar dataKey="iou" fill={chartColors.revenue} radius={[4, 4, 0, 0]} name="IoU (%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

        </Tabs>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/40 backdrop-blur-sm bg-card/50 hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg ivy-font">Run Evaluation</CardTitle>
                  <CardDescription className="ivy-font">Compute IoU metrics</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-border/40 backdrop-blur-sm bg-card/50 hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-purple-500/10 text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg ivy-font">Visualize Predictions</CardTitle>
                  <CardDescription className="ivy-font">Overlay segmentation masks</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-border/40 backdrop-blur-sm bg-card/50 hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                  <PenTool className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg ivy-font">Start Training</CardTitle>
                  <CardDescription className="ivy-font">Launch new training run</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
