"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: string;
  timestamp: string;
  agent?: string;
  message: string;
  level: "info" | "warn" | "error" | "debug";
  type: string;
  data?: any;
}

interface LiveLogTerminalProps {
  jobId: string | null;
}

export function LiveLogTerminal({ jobId }: LiveLogTerminalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (!jobId) {
      setLogs([]);
      setIsConnected(false);
      return;
    }

    const connect = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource(`/api/stream/${jobId}`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        addLog({
          type: "connected",
          timestamp: new Date().toISOString(),
          message: `Connected to job ${jobId}`,
          level: "info",
        });
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog(data);
        } catch {
          // Ignore heartbeats
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource.close();
        
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = setTimeout(() => {
          addLog({
            type: "reconnect",
            timestamp: new Date().toISOString(),
            message: "Reconnecting...",
            level: "warn",
          });
          connect();
        }, 2000);
      };
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [jobId]);

  const addLog = (data: any) => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: data.timestamp || new Date().toISOString(),
      agent: data.agent,
      message: data.message,
      level: data.level || "info",
      type: data.type,
      data: data.data,
    };

    setLogs(prev => [...prev.slice(-499), entry]);
    
    // Auto-scroll after state update
    setTimeout(scrollToBottom, 0);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", { 
      hour12: false, 
      hour: "2-digit", 
      minute: "2-digit", 
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  };

  const getAgentColor = (agent?: string) => {
    const colors: Record<string, string> = {
      ORCHESTRATOR: "hsl(var(--agent-orchestrator))",
      MECHANICAL: "hsl(var(--agent-mechanical))",
      ELECTRICAL: "hsl(var(--agent-electrical))",
      THERMAL: "hsl(var(--agent-thermal))",
      MANUFACTURING: "hsl(var(--agent-manufacturing))",
      COST: "hsl(var(--agent-cost))",
      CAD: "hsl(var(--primary))",
      SIM: "hsl(var(--accent))",
    };
    return colors[agent || ""] || "hsl(var(--foreground))";
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error": return "text-red-400";
      case "warn": return "text-amber-400";
      case "debug": return "text-gray-500";
      default: return "text-green-400";
    }
  };

  if (!jobId) {
    return (
      <div className="terminal h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center space-y-2">
            <svg className="w-12 h-12 mx-auto opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <p className="text-sm">No active job</p>
            <p className="text-xs">Start a design generation to see live logs</p>
          </div>
        </div>
        <div className="border-t border-border/30 p-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Ready</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-gray-500 rounded-full" />
            Disconnected
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal h-full flex flex-col">
      {/* Connection status */}
      <div className="border-b border-border/30 px-3 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
          <span className={isConnected ? "text-green-400" : "text-gray-500"}>
            {isConnected ? "LIVE" : "RECONNECTING..."}
          </span>
          <span className="text-muted-foreground">Job: {jobId.slice(0, 8)}</span>
        </div>
        <span className="text-muted-foreground">{logs.length} entries</span>
      </div>

      {/* Log entries */}
      <ScrollArea className="flex-1 custom-scrollbar" ref={scrollAreaRef}>
        <div className="p-3 space-y-1">
          {logs.length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">
              Waiting for events...
            </div>
          )}
          {logs.map((log) => (
            <div
              key={log.id}
              className={cn(
                "terminal-line flex items-start gap-2",
                log.agent ? `agent-${log.agent.toLowerCase()}` : ""
              )}
              style={{ borderLeftColor: log.agent ? getAgentColor(log.agent) : "transparent" }}
            >
              <span className="text-muted-foreground font-mono text-xs whitespace-nowrap shrink-0">
                {formatTime(log.timestamp)}
              </span>
              {log.agent && (
                <span 
                  className="px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded"
                  style={{ 
                    backgroundColor: `${getAgentColor(log.agent)}20`,
                    color: getAgentColor(log.agent),
                    border: `1px solid ${getAgentColor(log.agent)}40`
                  }}
                >
                  {log.agent}
                </span>
              )}
              <span className={cn("flex-1 truncate", getLevelColor(log.level))}>
                {log.message}
              </span>
              {log.type === "job_update" && log.data?.progress !== undefined && (
                <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                  {log.data.progress}%
                </span>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input hint */}
      <div className="border-t border-border/30 p-3 text-xs text-muted-foreground text-center">
        SSE streaming • Auto-reconnect • {logs.length} events logged
      </div>
    </div>
  );
}