"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ShieldCheck, ShieldAlert, ShieldX, RefreshCw, Loader2, Cookie } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CaptureState {
  running: boolean;
  status: "idle" | "waiting_login" | "success" | "error" | "timeout";
  message: string;
}

interface CookiesStatus {
  exists: boolean;
  age_days: number | null;
  fresh: boolean;
  capture: CaptureState;
}

export interface CookieBannerT {
  statusActive: string;
  statusExpiringSoon: string;
  statusMissing: string;
  captureButton: string;
  capturing: string;
  captureSuccess: string;
  captureError: string;
  captureTimeout: string;
  chromeNotFound: string;
  manualHint: string;
}

interface Props {
  apiBase: string;
  t: CookieBannerT;
  onLog: (message: string, type?: "info" | "success" | "error" | "warning" | "system") => void;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function tpl(template: string, vars: Record<string, string | number>): string {
  let result = template;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(`{${k}}`, String(v));
  }
  return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CookieStatusBanner({ apiBase, t, onLog }: Props) {
  const [status, setStatus] = useState<CookiesStatus | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevCaptureStatus = useRef<string>("idle");

  // ── Fetch cookie status ──────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/cookies/status`);
      if (!res.ok) return;
      const data: CookiesStatus = await res.json();
      setStatus(data);

      // Detect capture state transitions and fire log messages.
      const cs = data.capture.status;
      if (cs !== prevCaptureStatus.current) {
        if (cs === "success") {
          onLog(t.captureSuccess, "success");
          setIsCapturing(false);
        } else if (cs === "timeout") {
          onLog(t.captureTimeout, "warning");
          setIsCapturing(false);
        } else if (cs === "error") {
          onLog(tpl(t.captureError, { error: data.capture.message }), "error");
          setIsCapturing(false);
        }
        prevCaptureStatus.current = cs;
      }

      // Stop polling once capture finishes.
      if (!data.capture.running && pollRef.current && !data.capture.running) {
        // Keep a slow poll (every 30s) to refresh the age display.
      }
    } catch {
      // Backend not reachable — silently skip.
    }
  }, [apiBase, t, onLog]);

  // ── Mount: initial fetch + periodic refresh ──────────────────────────────────
  useEffect(() => {
    fetchStatus();
    // Poll every 30 s normally; the capture flow starts its own fast poll.
    const id = setInterval(fetchStatus, 30_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  // ── Fast-poll during active capture ─────────────────────────────────────────
  useEffect(() => {
    if (isCapturing) {
      pollRef.current = setInterval(fetchStatus, 3_000);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isCapturing, fetchStatus]);

  // ── Trigger capture ──────────────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    prevCaptureStatus.current = "waiting_login";
    onLog(t.capturing, "system");

    try {
      const res = await fetch(`${apiBase}/api/cookies/capture`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        if (data.error_type === "chrome_not_found") {
          onLog(t.chromeNotFound, "error");
        } else {
          onLog(tpl(t.captureError, { error: data.error || `HTTP ${res.status}` }), "error");
        }
        setIsCapturing(false);
        return;
      }
      // Capture started — fast-poll takes over from here.
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      onLog(tpl(t.captureError, { error: msg }), "error");
      setIsCapturing(false);
    }
  }, [isCapturing, apiBase, t, onLog]);

  // ── Derive visual state ──────────────────────────────────────────────────────
  type BannerVariant = "active" | "expiring" | "missing";

  function getVariant(): BannerVariant {
    if (!status || !status.exists) return "missing";
    if (!status.fresh) return "expiring";
    return "active";
  }

  const variant = getVariant();

  const variantStyles: Record<BannerVariant, {
    bg: string; border: string; iconColor: string; textColor: string;
  }> = {
    active: {
      bg: "rgba(34, 197, 94, 0.08)",
      border: "rgba(34, 197, 94, 0.30)",
      iconColor: "#22c55e",
      textColor: "#16a34a",
    },
    expiring: {
      bg: "rgba(234, 179, 8, 0.08)",
      border: "rgba(234, 179, 8, 0.35)",
      iconColor: "#eab308",
      textColor: "#a16207",
    },
    missing: {
      bg: "rgba(239, 68, 68, 0.08)",
      border: "rgba(239, 68, 68, 0.30)",
      iconColor: "#ef4444",
      textColor: "#dc2626",
    },
  };

  const vs = variantStyles[variant];

  const Icon = variant === "active"
    ? ShieldCheck
    : variant === "expiring"
    ? ShieldAlert
    : ShieldX;

  function getStatusLabel(): string {
    if (variant === "active" && status?.age_days !== null && status?.age_days !== undefined) {
      return tpl(t.statusActive, { days: status.age_days });
    }
    if (variant === "expiring") return t.statusExpiringSoon;
    return t.statusMissing;
  }

  // Don't render until first status check completes (avoids flash).
  if (status === null) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 16px",
        borderRadius: "12px",
        border: `1px solid ${vs.border}`,
        background: vs.bg,
        transition: "all 0.3s ease",
        flexWrap: "wrap",
      }}
    >
      {/* Icon */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexShrink: 0,
        }}
      >
        {isCapturing ? (
          <Loader2
            size={18}
            style={{ color: "var(--accent)", animation: "spin 1s linear infinite" }}
          />
        ) : (
          <Icon size={18} style={{ color: vs.iconColor }} />
        )}
        <Cookie size={14} style={{ color: "var(--text-tertiary)" }} />
      </div>

      {/* Status text */}
      <span
        style={{
          fontSize: "13px",
          fontWeight: 500,
          color: isCapturing ? "var(--text-secondary)" : vs.textColor,
          flex: 1,
          minWidth: "160px",
        }}
      >
        {isCapturing
          ? (status.capture.message || t.capturing)
          : getStatusLabel()}
      </span>

      {/* Manual hint */}
      {variant === "missing" && !isCapturing && (
        <span
          style={{
            fontSize: "11px",
            color: "var(--text-tertiary)",
            flex: "0 0 100%",
            paddingLeft: "26px",
            marginTop: "-4px",
          }}
        >
          {t.manualHint}
        </span>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        {/* Refresh (shown when expiring or missing and not capturing) */}
        {(variant === "expiring" || variant === "missing") && !isCapturing && (
          <button
            id="cookie-capture-button"
            className="btn btn-primary"
            onClick={handleCapture}
            style={{ padding: "8px 16px", fontSize: "13px", gap: "6px" }}
          >
            <RefreshCw size={13} />
            {t.captureButton}
          </button>
        )}

        {/* Re-capture even when active (for manual refresh) */}
        {variant === "active" && !isCapturing && (
          <button
            id="cookie-refresh-button"
            className="btn"
            onClick={handleCapture}
            title="Re-capture cookies"
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              gap: "5px",
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        )}
      </div>
    </div>
  );
}
