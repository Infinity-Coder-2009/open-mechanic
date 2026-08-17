"use client";

import { Card, CardContent } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { cn, formatDuration } from "@/lib/utils";

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

interface DesignHistoryProps {
  designs: Design[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const statusStyles: Record<string, string> = {
  QUEUED: "status-queued",
  PARSING: "status-parsing",
  AGENTS_RUNNING: "status-agents-running",
  CAD_GENERATING: "status-cad-generating",
  SIMULATING: "status-simulating",
  APPROVAL_NEEDED: "status-approval-needed",
  COMPLETE: "status-complete",
  FAILED: "status-failed",
};

export function DesignHistory({ designs, selectedId, onSelect }: DesignHistoryProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const truncatePrompt = (prompt: string, maxLen: number = 60) => {
    if (prompt.length <= maxLen) return prompt;
    return prompt.slice(0, maxLen - 3) + "...";
  };

  if (designs.length === 0) {
    return (
      <Card className="panel flex-1">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 text-muted-foreground">
            <svg className="w-16 h-16 mx-auto opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <p className="font-medium">No designs yet</p>
              <p className="text-sm">Generate your first design to see it here</p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="panel flex-1 min-h-0">
      <div className="panel-header">
        <span className="panel-title">Design History</span>
        <Badge variant="outline" className="text-xs">{designs.length}</Badge>
      </div>
      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full custom-scrollbar">
          <div className="p-3 space-y-2">
            {designs.map((design) => (
              <button
                key={design.id}
                onClick={() => onSelect(design.id)}
                className={cn(
                  "w-full text-left p-4 rounded-lg transition-all duration-200",
                  "hover:bg-accent/50 border border-transparent",
                  selectedId === design.id 
                    ? "bg-primary/10 border-primary/30 glow-primary" 
                    : "hover:border-border/50"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm text-foreground truncate mb-1">
                      {truncatePrompt(design.prompt, 80)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{formatDate(design.createdAt)}</span>
                      <span className="w-1 h-1 bg-border/50 rounded-full" />
                      <Badge className={cn(statusStyles[design.status] || "status-queued")}>
                        {design.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                  {selectedId === design.id && (
                    <svg className="w-5 h-5 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                
                {/* Agent status indicators */}
                {design.agentRuns && design.agentRuns.length > 0 && (
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    {design.agentRuns.map((run: any) => (
                      <span
                        key={run.agentType}
                        className={cn(
                          "w-2 h-2 rounded-full",
                          run.status === "COMPLETED" && "bg-green-400",
                          run.status === "PROCESSING" && "bg-yellow-400 animate-pulse",
                          run.status === "FAILED" && "bg-red-400",
                          run.status === "PENDING" && "bg-gray-500",
                        )}
                        title={`${run.agentType}: ${run.status}`}
                      />
                    ))}
                  </div>
                )}
                
                {/* Spec preview */}
                {design.spec && selectedId === design.id && (
                  <div className="mt-3 pt-3 border-t border-border/30 space-y-1 text-xs text-muted-foreground">
                    {design.spec.type && (
                      <div className="flex items-center gap-2">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        <span className="font-mono">{design.spec.type}</span>
                      </div>
                    )}
                    {design.spec.subAssemblies && (
                      <div className="flex items-center gap-2">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                        <span>{design.spec.subAssemblies.length} sub-assemblies</span>
                      </div>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}