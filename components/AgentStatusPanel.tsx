"use client";

import { Card, CardContent } from "./ui/card";
import { cn } from "@/lib/utils";
import { getAgentIcon, getAgentColor, AgentType } from "@/lib/types";

interface AgentStatusPanelProps {
  agentStatuses: Record<string, any>;
  isGenerating: boolean;
}

const AGENT_ORDER: AgentType[] = ["ORCHESTRATOR", "MECHANICAL", "ELECTRICAL", "THERMAL", "MANUFACTURING", "COST"];

const AGENT_INFO: Record<string, { name: string; icon: string; description: string }> = {
  ORCHESTRATOR: { name: "Orchestrator", icon: "cpu", description: "Lead Systems Engineer" },
  MECHANICAL: { name: "Mechanical", icon: "cog", description: "Structural & Materials" },
  ELECTRICAL: { name: "Electrical", icon: "zap", description: "Power & Control" },
  THERMAL: { name: "Thermal", icon: "flame", description: "Heat & Cooling" },
  MANUFACTURING: { name: "Manufacturing", icon: "factory", description: "DFM & Assembly" },
  COST: { name: "Cost", icon: "calculator", description: "BOM & Pricing" },
};

const ICONS: Record<string, React.ReactNode> = {
  cpu: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
  cog: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  zap: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  flame: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13c0 2-.5 5-2.986 7C10 19 7.91 18.223 6.343 16.657A7.983 7.983 0 004 13c0-2 .5-5 2.986-7C9 5 11.09 5.777 12.657 7.343z" /></svg>,
  factory: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  calculator: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
};

export function AgentStatusPanel({ agentStatuses, isGenerating }: AgentStatusPanelProps) {
  return (
    <Card className="panel">
      <div className="panel-header">
        <h3 className="panel-title flex items-center gap-2">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Agent Status
        </h3>
        {isGenerating && (
          <span className="flex items-center gap-1.5 text-xs text-primary">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            Active
          </span>
        )}
      </div>
      <CardContent className="space-y-3">
        {AGENT_ORDER.map((agentType) => {
          const info = AGENT_INFO[agentType];
          const status = agentStatuses[agentType];
          const agentColor = getAgentColor(agentType);
          
          let statusState: "pending" | "thinking" | "complete" | "error" = "pending";
          let progress = 0;
          
          if (status) {
            if (status.status === "thinking") statusState = "thinking";
            else if (status.status === "complete") statusState = "complete";
            else if (status.status === "error") statusState = "error";
            progress = status.progress || 0;
          } else if (isGenerating && agentType === "ORCHESTRATOR") {
            statusState = "thinking";
          }
          
          return (
            <div
              key={agentType}
              className={cn(
                "group relative p-4 rounded-lg transition-all duration-300",
                "bg-secondary/30 border border-border/30",
                statusState === "thinking" && "border-l-4 animate-pulse",
                statusState === "complete" && "border-l-4",
                statusState === "error" && "border-l-4",
              )}
              style={{
                borderLeftColor: agentColor,
                backgroundColor: statusState === "thinking" ? `${agentColor}10` : 
                               statusState === "complete" ? `${agentColor}05` : 
                               statusState === "error" ? `rgba(255, 68, 68, 0.1)` : "transparent",
              }}
            >
              <div className="flex items-start gap-3">
                {/* Agent Icon */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300",
                    statusState === "thinking" && "animate-pulse",
                  )}
                  style={{
                    backgroundColor: `${agentColor}20`,
                    color: agentColor,
                    boxShadow: statusState === "thinking" ? `0 0 20px ${agentColor}40` : "none",
                  }}
                >
                  {ICONS[info.icon]}
                </div>
                
                {/* Agent Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="font-medium text-foreground truncate">{info.name}</h4>
                      <p className="text-xs text-muted-foreground truncate">{info.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "agent-status-dot",
                          statusState === "pending" && "pending",
                          statusState === "thinking" && "thinking",
                          statusState === "complete" && "complete",
                          statusState === "error" && "error",
                        )}
                        style={{ 
                          backgroundColor: statusState === "pending" ? "transparent" : agentColor,
                          border: statusState === "pending" ? `1px solid ${agentColor}50` : "none",
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  {(statusState === "thinking" || progress > 0) && (
                    <div className="mt-2 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                          width: `${Math.max(progress, statusState === "thinking" ? 30 : 0)}%`,
                          backgroundColor: agentColor,
                          boxShadow: `0 0 10px ${agentColor}`,
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Status message */}
                  {status?.lastMessage && (
                    <p className="mt-2 text-xs text-muted-foreground font-mono truncate">
                      {status.lastMessage}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Confidence indicator */}
              {status?.output?.confidence !== undefined && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Confidence:</span>
                  <div className="flex-1 h-1 bg-secondary/50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(status.output.confidence * 100).toFixed(0)}%`,
                        backgroundColor: agentColor,
                      }}
                    />
                  </div>
                  <span className="font-mono text-foreground" style={{ color: agentColor }}>
                    {(status.output.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
        
        {Object.keys(agentStatuses).length === 0 && !isGenerating && (
          <div className="text-center py-8 text-muted-foreground">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-sm">No active agents</p>
            <p className="text-xs mt-1">Start a design to see agent activity</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}