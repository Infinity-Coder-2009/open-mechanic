"use client";

import { cn } from "@/lib/utils";
import { getAgentColor, AgentType } from "@/lib/types";

interface AgentTimelineProps {
  agentStatuses: Record<string, any>;
}

const AGENT_ORDER: AgentType[] = ["ORCHESTRATOR", "MECHANICAL", "ELECTRICAL", "THERMAL", "MANUFACTURING", "COST"];

const AGENT_LABELS: Record<string, string> = {
  ORCHESTRATOR: "Orchestrator",
  MECHANICAL: "Mechanical",
  ELECTRICAL: "Electrical",
  THERMAL: "Thermal",
  MANUFACTURING: "Manufacturing",
  COST: "Cost",
};

export function AgentTimeline({ agentStatuses }: AgentTimelineProps) {
  const activeAgents = AGENT_ORDER.filter(a => agentStatuses[a]);
  
  if (activeAgents.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No agent activity yet</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-10 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent" />
      
      <div className="space-y-6 pl-14">
        {AGENT_ORDER.map((agentType, index) => {
          const status = agentStatuses[agentType];
          const isActive = !!status;
          const agentColor = getAgentColor(agentType);
          
          let statusState: "pending" | "thinking" | "complete" | "error" = "pending";
          let progress = 0;
          
          if (status) {
            if (status.status === "thinking") statusState = "thinking";
            else if (status.status === "complete") statusState = "complete";
            else if (status.status === "error") statusState = "error";
            progress = status.progress || 0;
          }
          
          const isLast = index === AGENT_ORDER.length - 1;
          
          return (
            <div key={agentType} className="relative group">
              {/* Timeline dot */}
              <div
                className={cn(
                  "absolute -left-10 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 transition-all duration-300",
                  "bg-background"
                )}
                style={{
                  borderColor: isActive ? agentColor : "transparent",
                  backgroundColor: statusState === "complete" ? agentColor : 
                                 statusState === "thinking" ? `${agentColor}40` : 
                                 statusState === "error" ? "#ff4444" : "transparent",
                  boxShadow: isActive ? `0 0 15px ${agentColor}60` : "none",
                }}
              >
                {statusState === "complete" && (
                  <svg className="w-3 h-3 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {statusState === "thinking" && (
                  <div className="w-2 h-2 rounded-full bg-background animate-pulse" />
                )}
                {statusState === "error" && (
                  <svg className="w-3 h-3 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              
              {/* Agent card */}
              <div className={cn(
                "p-4 rounded-lg transition-all duration-300",
                "bg-secondary/30 border border-border/30",
                isActive && "border-l-4",
              )}
              style={{
                borderLeftColor: isActive ? agentColor : "transparent",
                backgroundColor: statusState === "thinking" ? `${agentColor}10` : 
                               statusState === "complete" ? `${agentColor}05` : 
                               statusState === "error" ? `rgba(255, 68, 68, 0.1)` : "transparent",
              }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Agent color indicator */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300",
                        statusState === "thinking" && "animate-pulse",
                      )}
                      style={{
                        backgroundColor: `${agentColor}20`,
                        color: agentColor,
                        boxShadow: statusState === "thinking" ? `0 0 20px ${agentColor}40` : "none",
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              {agentType === "ORCHESTRATOR" && (
                                                <>
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                                </>
                                              )}
                                              {agentType === "MECHANICAL" && (
                                                <>
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </>
                                              )}
                                              {agentType === "ELECTRICAL" && (
                                                <>
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                </>
                                              )}
                                              {agentType === "THERMAL" && (
                                                <>
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13c0 2-.5 5-2.986 7C10 19 7.91 18.223 6.343 16.657A7.983 7.983 0 004 13c0-2 .5-5 2.986-7C9 5 11.09 5.777 12.657 7.343z" />
                                                </>
                                              )}
                                              {agentType === "MANUFACTURING" && (
                                                <>
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                </>
                                              )}
                                              {agentType === "COST" && (
                                                <>
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2-2v14a2 2 0 002 2z" />
                                                </>
                                              )}
                                            </svg>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-foreground truncate">{AGENT_LABELS[agentType]}</h4>
                        <span
                          className={cn(
                            "px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded",
                            statusState === "thinking" && "bg-yellow-500/20 text-yellow-400",
                            statusState === "complete" && "bg-green-500/20 text-green-400",
                            statusState === "error" && "bg-red-500/20 text-red-400",
                            statusState === "pending" && "bg-gray-500/20 text-gray-500",
                          )}
                        >
                          {statusState}
                        </span>
                      </div>
                      
                      {status?.lastMessage && (
                        <p className="mt-1 text-xs text-muted-foreground font-mono truncate">
                          {status.lastMessage}
                        </p>
                      )}
                      
                      {(statusState === "thinking" || progress > 0) && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500 ease-out"
                              style={{
                                width: `${Math.max(progress, statusState === "thinking" ? 20 : 0)}%`,
                                backgroundColor: agentColor,
                                boxShadow: `0 0 8px ${agentColor}`,
                              }}
                            />
                          </div>
                          <span className="text-xs font-mono text-muted-foreground w-10 text-right">
                            {Math.max(progress, statusState === "thinking" ? 20 : 0)}%
                          </span>
                        </div>
                      )}
                      
                      {/* Output preview */}
                      {status?.output?.reasoning && (
                        <div className="mt-2 p-2 bg-background/50 rounded text-xs text-muted-foreground border border-border/30">
                          <span className="font-mono text-[hsl(var(--agent-orchestrator))]">→ </span>
                          {status.output.reasoning.slice(0, 200)}
                          {status.output.reasoning.length > 200 ? "..." : ""}
                        </div>
                      )}
                      
                      {/* Warnings */}
                      {status?.output?.warnings && status.output.warnings.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {status.output.warnings.slice(0, 2).map((w: string, i: number) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 truncate max-w-[200px]"
                              title={w}
                            >
                              ⚠ {w.slice(0, 50)}
                            </span>
                          ))}
                          {status.output.warnings.length > 2 && (
                            <span className="px-2 py-0.5 text-[10px] bg-gray-500/20 text-gray-400 rounded">
                              +{status.output.warnings.length - 2} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Confidence & timing */}
                  <div className="flex flex-col items-end gap-2 text-right min-w-[120px]">
                    {status?.output?.confidence !== undefined && (
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Confidence</div>
                        <div className="font-mono text-lg" style={{ color: agentColor }}>
                          {(status.output.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                    )}
                    {status?.output?.duration && (
                      <div className="text-xs text-muted-foreground font-mono">
                        {status.output.duration}ms
                      </div>
                    )}
                    {status?.lastUpdate && (
                      <div className="text-xs text-muted-foreground font-mono">
                        {new Date(status.lastUpdate).toLocaleTimeString("en-US", { hour12: false })}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Connection to next agent */}
                {!isLast && isActive && (
                  <div className="absolute left-5 top-full bottom-[4px] w-px bg-gradient-to-b from-primary/30 to-transparent" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}