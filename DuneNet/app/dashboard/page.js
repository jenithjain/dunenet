"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ComposedChart, Scatter
} from "recharts";
import {
  ArrowUpRight, ArrowDownRight, BookOpen, TrendingUp,
  Users, Activity, GitBranch, FileText, Sparkles, Brain,
  PenTool, Target, Network, Shield
} from "lucide-react";

// Training Loss & mIoU Progress
const progressData = [
  { epoch: "Ep 1", trainLoss: 2.31, valLoss: 2.45, mIoU: 12 },
  { epoch: "Ep 5", trainLoss: 1.82, valLoss: 1.95, mIoU: 28 },
  { epoch: "Ep 10", trainLoss: 1.34, valLoss: 1.52, mIoU: 41 },
  { epoch: "Ep 15", trainLoss: 0.98, valLoss: 1.18, mIoU: 54 },
  { epoch: "Ep 20", trainLoss: 0.72, valLoss: 0.94, mIoU: 63 },
  { epoch: "Ep 25", trainLoss: 0.58, valLoss: 0.81, mIoU: 69 },
  { epoch: "Ep 30", trainLoss: 0.45, valLoss: 0.72, mIoU: 74 },
  { epoch: "Ep 35", trainLoss: 0.38, valLoss: 0.66, mIoU: 77 },
  { epoch: "Ep 40", trainLoss: 0.32, valLoss: 0.61, mIoU: 80 },
  { epoch: "Ep 45", trainLoss: 0.28, valLoss: 0.58, mIoU: 82 },
  { epoch: "Ep 50", trainLoss: 0.25, valLoss: 0.56, mIoU: 84 },
  { epoch: "Ep 55", trainLoss: 0.23, valLoss: 0.55, mIoU: 85 },
];

// Per-class IoU Distribution
const classIoUData = [
  { name: "Sky", iou: 94 },
  { name: "Landscape", iou: 87 },
  { name: "Rocks", iou: 78 },
  { name: "Trees", iou: 82 },
  { name: "Lush Bushes", iou: 71 },
  { name: "Dry Grass", iou: 65 },
  { name: "Dry Bushes", iou: 62 },
  { name: "Ground Clutter", iou: 58 },
  { name: "Flowers", iou: 52 },
  { name: "Logs", iou: 48 },
];

// Experiment Tracker
const experimentData = [
  { id: 1, type: "Backbone", element: "DenseNet-121 Encoder + U-Net Decoder", status: "Active", detail: "mIoU 85.2%" },
  { id: 2, type: "Augmentation", element: "Random Flip + Color Jitter + Gaussian Blur", status: "Active", detail: "+3.1% mIoU" },
  { id: 3, type: "Loss Function", element: "Focal Loss + Dice Loss Combination", status: "Active", detail: "α=0.25 γ=2" },
  { id: 4, type: "Backbone", element: "ResNet-50 Encoder Baseline", status: "Completed", detail: "mIoU 78.4%" },
  { id: 5, type: "Training", element: "CosineAnnealing LR Schedule", status: "Active", detail: "lr 1e-3→1e-5" },
  { id: 6, type: "Domain Adapt", element: "Style Transfer Augmentation", status: "Active", detail: "+2.5% gen." },
  { id: 7, type: "Architecture", element: "Multi-Scale Feature Fusion (FPN)", status: "Active", detail: "3 scales" },
  { id: 8, type: "Evaluation", element: "Test Set Inference (Unseen Desert)", status: "Pending", detail: "Awaiting" },
];

// Per-epoch Events/Metrics
const epochMetricsData = [
  { epoch: "Ep 5", pixelAcc: 68, mIoU: 28 },
  { epoch: "Ep 10", pixelAcc: 76, mIoU: 41 },
  { epoch: "Ep 15", pixelAcc: 82, mIoU: 54 },
  { epoch: "Ep 20", pixelAcc: 86, mIoU: 63 },
  { epoch: "Ep 25", pixelAcc: 89, mIoU: 69 },
  { epoch: "Ep 30", pixelAcc: 91, mIoU: 74 },
  { epoch: "Ep 35", pixelAcc: 92, mIoU: 77 },
  { epoch: "Ep 40", pixelAcc: 93, mIoU: 80 },
  { epoch: "Ep 45", pixelAcc: 94, mIoU: 82 },
  { epoch: "Ep 50", pixelAcc: 95, mIoU: 84 },
];

// Model Quality Radar
const modelHealthData = [
  { metric: "Pixel Accuracy", value: 95, fullMark: 100 },
  { metric: "Mean IoU", value: 85, fullMark: 100 },
  { metric: "Boundary Precision", value: 78, fullMark: 100 },
  { metric: "Generalization", value: 72, fullMark: 100 },
  { metric: "Inference Speed", value: 88, fullMark: 100 },
  { metric: "Robustness", value: 80, fullMark: 100 },
];

// Training Runs Comparison
const trainingRunsData = [
  { run: "Run 1", trainMIoU: 78, valMIoU: 72, epochs: 30 },
  { run: "Run 2", trainMIoU: 82, valMIoU: 76, epochs: 40 },
  { run: "Run 3", trainMIoU: 85, valMIoU: 80, epochs: 50 },
  { run: "Run 4", trainMIoU: 87, valMIoU: 82, epochs: 55 },
];

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

  const StatCard = ({ title, value, change, icon: Icon, trend }) => (
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
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          {trend === "up" ? (
            <ArrowUpRight className="h-3 w-3 text-emerald-500" />
          ) : (
            <ArrowDownRight className="h-3 w-3 text-red-500" />
          )}
          <span className={trend === "up" ? "text-emerald-500" : "text-red-500"}>
            {change}
          </span>
          <span>from last month</span>
        </div>
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
              Epoch 55 - Training
            </Badge>
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white ivy-font">
              <PenTool className="h-4 w-4 mr-2" />
              Run Inference
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Mean IoU"
            value="85.2%"
            change="+4.8%"
            icon={Target}
            trend="up"
          />
          <StatCard
            title="Semantic Classes"
            value="10"
            change="All tracked"
            icon={Users}
            trend="up"
          />
          <StatCard
            title="Pixel Accuracy"
            value="95.1%"
            change="+1.2%"
            icon={GitBranch}
            trend="up"
          />
          <StatCard
            title="Generalization Gap"
            value="5.3%"
            change="-1.8%"
            icon={Shield}
            trend="up"
          />
        </div>

        {/* Main Charts */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-muted/50 backdrop-blur-sm">
            <TabsTrigger value="overview" className="ivy-font">Training Progress</TabsTrigger>
            <TabsTrigger value="analytics" className="ivy-font">Per-Class IoU</TabsTrigger>
            <TabsTrigger value="performance" className="ivy-font">Model Quality</TabsTrigger>
            <TabsTrigger value="cashflow" className="ivy-font">Epoch Metrics</TabsTrigger>
            <TabsTrigger value="investments" className="ivy-font">Run Comparison</TabsTrigger>
            <TabsTrigger value="transactions" className="ivy-font">Experiments</TabsTrigger>
          </TabsList>

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

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <Card className="border-border/40 backdrop-blur-sm bg-card/50 hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="ivy-font">Model Quality Radar</CardTitle>
                <CardDescription className="ivy-font">
                  Comprehensive view of segmentation model performance across key dimensions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={modelHealthData}>
                    <PolarGrid stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                    <PolarAngleAxis 
                      dataKey="metric" 
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                      style={{ fontSize: '12px' }}
                    />
                    <PolarRadiusAxis 
                      angle={90} 
                      domain={[0, 100]}
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                      style={{ fontSize: '10px' }}
                    />
                    <Radar 
                      name="Quality" 
                      dataKey="value" 
                      stroke={chartColors.primary} 
                      fill={chartColors.primary} 
                      fillOpacity={0.6}
                      strokeWidth={2}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                        border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                        borderRadius: '8px'
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                  {modelHealthData.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all hover:scale-105 cursor-pointer">
                      <p className="text-sm text-muted-foreground ivy-font mb-1">{item.metric}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold ivy-font">{item.value}%</p>
                        <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Epoch Metrics Tab */}
          <TabsContent value="cashflow" className="space-y-4">
            <Card className="border-border/40 backdrop-blur-sm bg-card/50 hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="ivy-font">Pixel Accuracy vs mIoU by Epoch</CardTitle>
                <CardDescription className="ivy-font">
                  Track both metrics across training epochs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={epochMetricsData}>
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
                    <Bar dataKey="pixelAcc" fill={chartColors.revenue} radius={[8, 8, 0, 0]} name="Pixel Accuracy (%)" />
                    <Line 
                      type="monotone" 
                      dataKey="mIoU" 
                      stroke={chartColors.profit} 
                      strokeWidth={3}
                      name="mIoU (%)"
                      dot={{ fill: chartColors.profit, r: 6 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="mt-6 grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-all hover:scale-105 cursor-pointer">
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 ivy-font mb-1">Best mIoU</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 ivy-font">85.2%</p>
                  </div>
                  <div className="p-4 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-all hover:scale-105 cursor-pointer">
                    <p className="text-sm text-blue-600 dark:text-blue-400 ivy-font mb-1">Pixel Accuracy</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 ivy-font">95.1%</p>
                  </div>
                  <div className="p-4 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 transition-all hover:scale-105 cursor-pointer">
                    <p className="text-sm text-purple-600 dark:text-purple-400 ivy-font mb-1">Train Epochs</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 ivy-font">55</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Run Comparison Tab */}
          <TabsContent value="investments" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium ivy-font">
                    Best Val mIoU
                  </CardTitle>
                  
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold ivy-font">82.0%</div>
                  <p className="text-xs text-muted-foreground ivy-font">
                    Run 4, Epoch 55
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium ivy-font">
                    Target mIoU
                  </CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold ivy-font">80.0%</div>
                  <p className="text-xs text-emerald-500 ivy-font">
                    Target achieved!
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium ivy-font">
                    Improvement
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold ivy-font">+10.0%</div>
                  <p className="text-xs text-muted-foreground ivy-font">
                    Val mIoU across 4 runs
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/40 backdrop-blur-sm bg-card/50">
              <CardHeader>
                <CardTitle className="ivy-font">Training Runs Comparison</CardTitle>
                <CardDescription className="ivy-font">
                  Train vs Validation mIoU across experiment runs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={trainingRunsData}>
                    <defs>
                      <linearGradient id="colorRunTrain" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColors.portfolio} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={chartColors.portfolio} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                    <XAxis 
                      dataKey="run" 
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
                    <Area 
                      type="monotone" 
                      dataKey="trainMIoU" 
                      stroke={chartColors.portfolio} 
                      fillOpacity={1} 
                      fill="url(#colorRunTrain)"
                      strokeWidth={3}
                      name="Train mIoU (%)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="valMIoU" 
                      stroke={chartColors.target} 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Val mIoU (%)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Experiments Tab */}
          <TabsContent value="transactions" className="space-y-4">
            <Card className="border-border/40 backdrop-blur-sm bg-card/50">
              <CardHeader>
                <CardTitle className="ivy-font">Experiment Tracker</CardTitle>
                <CardDescription className="ivy-font">
                  Active experiments, augmentations, and architecture changes across training runs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {experimentData.map((experiment) => (
                    <div
                      key={experiment.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border/40 bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${
                          experiment.status === "Active" 
                            ? "bg-emerald-500/10 text-emerald-500" 
                            : experiment.status === "Completed"
                            ? "bg-blue-500/10 text-blue-500"
                            : "bg-amber-500/10 text-amber-500"
                        }`}>
                          {experiment.status === "Active" ? (
                            <Activity className="h-4 w-4" />
                          ) : experiment.status === "Completed" ? (
                            <Shield className="h-4 w-4" />
                          ) : (
                            <Target className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground ivy-font">
                            {experiment.element}
                          </p>
                          <p className="text-sm text-muted-foreground ivy-font">
                            {experiment.type} • {experiment.detail}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-emerald-500 ivy-font">
                          {experiment.status}
                        </div>
                        <Badge variant="outline" className="mt-1">
                          {experiment.type}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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
