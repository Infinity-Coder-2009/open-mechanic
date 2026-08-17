"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PromptInput } from "./PromptInput";
import { ConstraintsPanel } from "./ConstraintsPanel";
import { LiveLogTerminal } from "./LiveLogTerminal";
import { DesignHistory } from "./DesignHistory";
import { ThreeViewer } from "./ThreeViewer";
import { AgentStatusPanel } from "./AgentStatusPanel";
import { AgentTimeline } from "./AgentTimeline";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface Design {
  id: string;
  prompt: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  spec?: any;
  jobs?: any[];
  agentRuns?: any[];
}

export function Dashboard() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<"design" | "history">("design");
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch designs on mount
  useEffect(() => {
    fetchDesigns();
  }, []);

  const fetchDesigns = async () => {
    try {
      const res = await fetch("/api/designs");
      if (res.ok) {
        const data = await res.json();
        setDesigns(data.designs || []);
      }
    } catch (error) {
      console.error("Failed to fetch designs:", error);
    }
  };

  const handleGenerate = useCallback(async (prompt: string, constraints: any) => {
    setIsGenerating(true);
    setCurrentJobId(null);
    
    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, constraints }),
      });
      
      if (!res.ok) {
        throw new Error("Failed to start generation");
      }
      
      const data = await res.json();
      setCurrentJobId(data.jobId);
      connectSSE(data.jobId);
      
      // Refresh designs to show new entry
      fetchDesigns();
    } catch (error) {
      console.error("Generation failed:", error);
      setIsGenerating(false);
      setCurrentJobId(null);
    }
  }, []);

  const connectSSE = useCallback((jobId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    const eventSource = new EventSource(`/api/stream/${jobId}`);
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      console.log("SSE connected");
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSSEEvent(data);
      } catch (e) {
        // Ignore parse errors (heartbeats)
      }
    };
    
    eventSource.onerror = () => {
      console.log("SSE error, attempting reconnect...");
      eventSource.close();
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      reconnectTimeoutRef.current = setTimeout(() => {
        if (currentJobId) {
          connectSSE(currentJobId);
        }
      }, 2000);
    };
  }, [currentJobId]);

  const handleSSEEvent = (data: any) => {
    switch (data.type) {
      case "connected":
        break;
      case "log":
      case "agent_start":
      case "agent_complete":
      case "agent_error":
      case "job_update":
        // Update agent statuses
        if (data.agent) {
          setAgentStatuses(prev => ({
            ...prev,
            [data.agent]: {
              ...prev[data.agent],
              status: data.type === "agent_start" ? "thinking" : 
                     data.type === "agent_complete" ? "complete" :
                     data.type === "agent_error" ? "error" : "thinking",
              lastMessage: data.message,
              lastUpdate: data.timestamp,
              progress: data.data?.progress,
            },
          }));
        }
        break;
      case "design_update":
        if (data.data?.spec) {
          setDesigns(prev => prev.map(d => 
            d.id === selectedDesignId ? { ...d, spec: data.data.spec } : d
          ));
        }
        break;
      case "complete":
        setIsGenerating(false);
        setCurrentJobId(null);
        fetchDesigns();
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        break;
      case "error":
        setIsGenerating(false);
        setCurrentJobId(null);
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        break;
    }
  };

  const handleDesignSelect = (designId: string) => {
    setSelectedDesignId(designId);
    setActiveTab("design");
  };

  const selectedDesign = designs.find(d => d.id === selectedDesignId);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Animated grid background */}
      <div className="fixed inset-0 -z-10 opacity-50" style={{ backgroundImage: 'var(--grid-pattern)', backgroundSize: '50px 50px', animation: 'grid-move 20s linear infinite' }} />
      
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center glow-primary">
              <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <span className="font-display text-xl font-bold text-foreground">OpenMechanic</span>
            <Badge variant="secondary" className="text-xs ml-2">Phase 1</Badge>
          </div>
          
          <div className="flex items-center gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="hidden md:flex">
              <TabsList className="bg-secondary p-1 rounded-lg">
                <TabsTrigger value="design" className="px-4 py-2">Design</TabsTrigger>
                <TabsTrigger value="history" className="px-4 py-2">History</TabsTrigger>
              </TabsList>
            </Tabs>
            
            {currentJobId && (
              <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/30 rounded-lg text-primary text-sm">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                Generating...
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-140px)]">
          {/* Left Panel: Agent Status + History */}
          <div className="lg:col-span-1 space-y-4">
            <AgentStatusPanel 
              agentStatuses={agentStatuses} 
              isGenerating={isGenerating}
            />
            
            {activeTab === "history" && (
              <div className="flex-1 min-h-0">
                <DesignHistory 
                  designs={designs} 
                  selectedId={selectedDesignId}
                  onSelect={handleDesignSelect}
                />
              </div>
            )}
          </div>

          {/* Center Panel: Prompt + 3D Viewer */}
          <div className="lg:col-span-2 space-y-4 flex flex-col">
            <Card className="panel flex-1 min-h-0 flex flex-col">
              <div className="panel-header">
                <CardTitle className="panel-title">Design Prompt</CardTitle>
                {currentJobId && (
                  <Badge className="status-parsing">Processing</Badge>
                )}
              </div>
              <CardContent className="flex-1 min-h-0">
                <PromptInput 
                  onGenerate={handleGenerate}
                  disabled={isGenerating}
                />
              </CardContent>
            </Card>

            <Card className="panel min-h-[300px] flex-1">
              <div className="panel-header">
                <CardTitle className="panel-title">3D Preview</CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-2 h-2 bg-primary rounded-full" />
                  Wireframe Mode
                </div>
              </div>
              <CardContent className="flex-1 min-h-0">
                <ThreeViewer 
                  designSpec={selectedDesign?.spec}
                  isGenerating={isGenerating}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Panel: Constraints + Live Log */}
          <div className="lg:col-span-1 space-y-4 flex flex-col">
            <ConstraintsPanel 
              disabled={isGenerating}
            />
            
            <Card className="panel flex-1 min-h-0 flex flex-col">
              <div className="panel-header">
                <CardTitle className="panel-title">Live Log</CardTitle>
                {currentJobId && (
                  <Badge className="bg-primary/20 text-primary border-primary/30 animate-pulse">LIVE</Badge>
                )}
              </div>
              <CardContent className="flex-1 min-h-0">
                <LiveLogTerminal jobId={currentJobId} />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom Panel: Agent Timeline */}
        {Object.keys(agentStatuses).length > 0 && (
          <div className="mt-4">
            <Card className="panel">
              <CardHeader className="panel-header">
                <CardTitle className="panel-title">Agent Collaboration Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <AgentTimeline agentStatuses={agentStatuses} />
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}