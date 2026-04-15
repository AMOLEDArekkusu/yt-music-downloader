"use client";

import { useRef, useEffect } from "react";
import { Trash2 } from "lucide-react";

export interface LogEntry {
  id: number;
  message: string;
  type: "info" | "success" | "error" | "warning" | "system";
  timestamp: string;
}

interface ProgressLogProps {
  logs: LogEntry[];
  onClear: () => void;
  t: {
    title: string;
    clear: string;
    empty: string;
  };
}

function getLogColor(type: LogEntry["type"]): string {
  switch (type) {
    case "success":
      return "var(--success)";
    case "error":
      return "var(--error)";
    case "warning":
      return "var(--warning)";
    case "system":
      return "var(--accent)";
    default:
      return "var(--text-secondary)";
  }
}

function getLogPrefix(type: LogEntry["type"]): string {
  switch (type) {
    case "success":
      return "✅";
    case "error":
      return "❌";
    case "warning":
      return "⚠️";
    case "system":
      return "🔧";
    default:
      return "›";
  }
}

export default function ProgressLog({ logs, onClear, t }: ProgressLogProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="terminal">
      <div className="terminal-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="terminal-dots">
            <div className="terminal-dot terminal-dot-red" />
            <div className="terminal-dot terminal-dot-yellow" />
            <div className="terminal-dot terminal-dot-green" />
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--text-tertiary)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {t.title}
          </span>
        </div>

        <button
          className="btn-ghost"
          onClick={onClear}
          style={{ fontSize: "12px", gap: "4px", padding: "4px 10px" }}
        >
          <Trash2 size={12} />
          {t.clear}
        </button>
      </div>

      <div className="terminal-body" ref={bodyRef}>
        {logs.length === 0 ? (
          <div
            style={{
              color: "var(--text-tertiary)",
              fontStyle: "italic",
              padding: "20px 0",
              textAlign: "center",
            }}
          >
            {t.empty}
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="log-line"
              style={{ color: getLogColor(log.type) }}
            >
              <span style={{ color: "var(--text-tertiary)", marginRight: "8px" }}>
                [{log.timestamp}]
              </span>
              <span style={{ marginRight: "6px" }}>{getLogPrefix(log.type)}</span>
              {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
