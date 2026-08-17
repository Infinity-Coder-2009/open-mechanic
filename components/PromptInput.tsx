"use client";

import { useState, useRef, useEffect } from "react";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { cn } from "@/lib/utils";

interface PromptInputProps {
  onGenerate: (prompt: string, constraints: any) => void;
  disabled?: boolean;
}

export function PromptInput({ onGenerate, disabled }: PromptInputProps) {
  const [prompt, setPrompt] = useState("");
  const [constraints, setConstraints] = useState({
    maxHeight: 500,
    maxWeight: 5000,
    maxBudget: 1000,
    environment: "indoor" as const,
    powerSource: "mains" as const,
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`;
    }
  }, [prompt]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || disabled) return;
    onGenerate(prompt, constraints);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        <Textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Describe your machine... e.g. "Build me a wall fan, black, 400mm diameter, 5 blades, quiet operation for bedroom use"'
          disabled={disabled}
          className="textarea-primary font-sans text-base min-h-[140px] resize-none"
          rows={6}
        />
      </div>

      {/* Quick constraints summary */}
      <div className="mt-4 p-4 bg-secondary/50 rounded-lg border border-border/30">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--agent-mechanical))]" />
            Height: <span className="font-mono text-foreground">{constraints.maxHeight}mm</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--agent-electrical))]" />
            Weight: <span className="font-mono text-foreground">{constraints.maxWeight}g</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--agent-cost))]" />
            Budget: <span className="font-mono text-foreground">${constraints.maxBudget}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--agent-thermal))]" />
            Env: <span className="font-mono text-foreground capitalize">{constraints.environment}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--agent-manufacturing))]" />
            Power: <span className="font-mono text-foreground capitalize">{constraints.powerSource}</span>
          </span>
        </div>
      </div>

      {/* Expandable advanced constraints */}
      <Button
        type="button"
        variant="ghost"
        className="mt-3 justify-start text-sm px-0"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? "Hide Advanced Constraints" : "Show Advanced Constraints"}
      </Button>

      {isExpanded && (
        <div className="mt-3 space-y-4 animate-in">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Max Height (mm)</label>
              <input
                type="range"
                min="50"
                max="2000"
                step="10"
                value={constraints.maxHeight}
                onChange={(e) => setConstraints(prev => ({ ...prev, maxHeight: Number(e.target.value) }))}
                className="slider-primary"
                disabled={disabled}
              />
              <div className="text-right text-sm text-muted-foreground mt-1">{constraints.maxHeight}mm</div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Max Weight (g)</label>
              <input
                type="range"
                min="100"
                max="20000"
                step="100"
                value={constraints.maxWeight}
                onChange={(e) => setConstraints(prev => ({ ...prev, maxWeight: Number(e.target.value) }))}
                className="slider-primary"
                disabled={disabled}
              />
              <div className="text-right text-sm text-muted-foreground mt-1">{constraints.maxWeight}g</div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Max Budget ($)</label>
              <input
                type="range"
                min="50"
                max="50000"
                step="50"
                value={constraints.maxBudget}
                onChange={(e) => setConstraints(prev => ({ ...prev, maxBudget: Number(e.target.value) }))}
                className="slider-primary"
                disabled={disabled}
              />
              <div className="text-right text-sm text-muted-foreground mt-1">${constraints.maxBudget}</div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Environment</label>
              <select
                value={constraints.environment}
                onChange={(e) => setConstraints(prev => ({ ...prev, environment: e.target.value as any }))}
                className="input-primary"
                disabled={disabled}
              >
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
                <option value="industrial">Industrial</option>
                <option value="space">Space</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Power Source</label>
              <select
                value={constraints.powerSource}
                onChange={(e) => setConstraints(prev => ({ ...prev, powerSource: e.target.value as any }))}
                className="input-primary"
                disabled={disabled}
              >
                <option value="mains">Mains (AC)</option>
                <option value="battery">Battery (DC)</option>
                <option value="solar">Solar</option>
                <option value="pneumatic">Pneumatic</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Generate Button */}
      <Button
        type="submit"
        className="btn-primary w-full mt-6 py-4 text-lg font-semibold glow-primary"
        disabled={disabled || !prompt.trim()}
        style={{ minHeight: '56px' }}
      >
        {disabled ? (
          <>
            <svg className="mr-2 h-5 w-5 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Generating...
          </>
        ) : (
          <>
            <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Generate Design
          </>
        )}
      </Button>

      {/* Example prompts */}
      <div className="mt-4 pt-4 border-t border-border/30">
        <p className="text-xs text-muted-foreground mb-2">Try these examples:</p>
        <div className="flex flex-wrap gap-2">
          {[
            'Wall fan, 400mm, 5 blades, quiet, bedroom',
            'FPV drone, 5 inch, carbon fiber, 6S battery',
            'Robot arm, 6 DOF, 2kg payload, precision',
            'Linear actuator, 300mm stroke, 500N force',
          ].map((example) => (
            <Button
              key={example}
              type="button"
              variant="outline"
              className="text-xs py-1.5 px-3 h-auto"
              onClick={() => setPrompt(example)}
              disabled={disabled}
            >
              {example}
            </Button>
          ))}
        </div>
      </div>
    </form>
  );
}