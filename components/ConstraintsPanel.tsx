"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface ConstraintsPanelProps {
  disabled?: boolean;
  onChange?: (constraints: any) => void;
}

export function ConstraintsPanel({ disabled, onChange }: ConstraintsPanelProps) {
  const [constraints, setConstraints] = useState({
    maxHeight: 500,
    maxWeight: 5000,
    maxBudget: 1000,
    environment: "indoor" as "indoor" | "outdoor" | "industrial" | "space",
    powerSource: "mains" as "mains" | "battery" | "solar" | "pneumatic",
    customConstraints: {} as Record<string, any>,
  });

  const [isExpanded, setIsExpanded] = useState(true);

  const updateConstraint = (key: string, value: any) => {
    const newConstraints = { ...constraints, [key]: value };
    setConstraints(newConstraints);
    onChange?.(newConstraints);
  };

  return (
    <Card className="panel">
      <CardHeader className="panel-header">
        <div className="flex items-center justify-between">
          <CardTitle className="panel-title flex items-center gap-2">
            <svg className="w-5 h-5 text-[hsl(var(--agent-cost))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Constraints
          </CardTitle>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="btn-ghost p-1"
            disabled={disabled}
          >
            <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6 animate-in">
          {/* Physical Constraints */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-[hsl(var(--agent-mechanical))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Physical Limits
            </h4>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Max Height</span>
                  <span className="font-mono text-foreground">{constraints.maxHeight} mm</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="2000"
                  step="10"
                  value={constraints.maxHeight}
                  onChange={(e) => updateConstraint("maxHeight", Number(e.target.value))}
                  className="slider-primary"
                  disabled={disabled}
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Max Weight</span>
                  <span className="font-mono text-foreground">{constraints.maxWeight} g</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="20000"
                  step="100"
                  value={constraints.maxWeight}
                  onChange={(e) => updateConstraint("maxWeight", Number(e.target.value))}
                  className="slider-primary"
                  disabled={disabled}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Budget */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-[hsl(var(--agent-cost))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Budget
            </h4>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Max Budget</span>
                <span className="font-mono text-foreground">${constraints.maxBudget}</span>
              </div>
              <input
                type="range"
                min="50"
                max="50000"
                step="50"
                value={constraints.maxBudget}
                onChange={(e) => updateConstraint("maxBudget", Number(e.target.value))}
                className="slider-primary"
                disabled={disabled}
              />
            </div>
          </div>

          <Separator />

          {/* Environment & Power */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-[hsl(var(--agent-thermal))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20H4a2 2 0 01-2-2V6a2 2 0 012-2h11a2 2 0 012 2v7m-8 4h.01M17 16h.01" />
                </svg>
                Environment
              </h4>
              <select
                value={constraints.environment}
                onChange={(e) => updateConstraint("environment", e.target.value)}
                className="input-primary"
                disabled={disabled}
              >
                <option value="indoor">🏠 Indoor</option>
                <option value="outdoor">🌲 Outdoor</option>
                <option value="industrial">🏭 Industrial</option>
                <option value="space">🚀 Space</option>
              </select>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-[hsl(var(--agent-electrical))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Power Source
              </h4>
              <select
                value={constraints.powerSource}
                onChange={(e) => updateConstraint("powerSource", e.target.value)}
                className="input-primary"
                disabled={disabled}
              >
                <option value="mains">🔌 Mains (AC)</option>
                <option value="battery">🔋 Battery (DC)</option>
                <option value="solar">☀️ Solar</option>
                <option value="pneumatic">💨 Pneumatic</option>
              </select>
            </div>
          </div>

          <Separator />

          {/* Quick Presets */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Quick Presets</h4>
            <div className="flex flex-wrap gap-2">
              {[
                              { label: "Consumer", height: 300, weight: 2000, budget: 200, env: "indoor", power: "mains" },
                              { label: "Industrial", height: 1000, weight: 15000, budget: 5000, env: "industrial", power: "mains" },
                              { label: "Drone", height: 200, weight: 800, budget: 800, env: "outdoor", power: "battery" },
                              { label: "Space", height: 500, weight: 3000, budget: 50000, env: "space", power: "solar" },
                            ].map((preset) => (
                              <Button
                                key={preset.label}
                                type="button"
                                variant="outline"
                                className="text-xs py-1.5 px-3 h-auto"
                                onClick={() => {
                                  const newConstraints = {
                                    maxHeight: preset.height,
                                    maxWeight: preset.weight,
                                    maxBudget: preset.budget,
                                    environment: preset.env as any,
                                    powerSource: preset.power as any,
                                    customConstraints: {},
                                  };
                                  setConstraints(newConstraints);
                                  onChange?.(newConstraints);
                                }}
                                disabled={disabled}
                              >
                                {preset.label}
                              </Button>
                            ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}