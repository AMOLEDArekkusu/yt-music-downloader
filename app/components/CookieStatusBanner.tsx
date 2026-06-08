"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ShieldCheck, ShieldAlert, ShieldX, RefreshCw, Loader2, Cookie, Upload, CheckCircle2 } from "lucide-react";

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
  is_vercel: boolean;
  source: "tmp" | "repo" | "none";
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
  uploadButton: string;
  uploadSuccess: string;
  uploadError: string;
  uploadHint: string;
  dropHint: string;
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
  const [showUpload, setShowUpload] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevCaptureStatus = useRef<string>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    } catch {
      // Backend not reachable — silently skip.
    }
  }, [apiBase, t, onLog]);

  // ── Mount: initial fetch + periodic refresh ──────────────────────────────────
  useEffect(() => {
    fetchStatus();
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

  // ── Trigger Chrome auto-capture (local only) ─────────────────────────────────
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
        } else if (data.error_type === "vercel_unsupported") {
          // Should not happen (button is hidden on Vercel), but handle gracefully.
          onLog(data.error || t.chromeNotFound, "error");
          setShowUpload(true);
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

  // ── Upload cookies.txt file ───────────────────────────────────────────────────
  const handleFileUpload = useCallback(async (file: File) => {
    if (isUploading) return;

    // Basic client-side validation
    if (!file.name.endsWith(".txt") && file.type !== "text/plain") {
      const msg = t.uploadError.replace("{error}", "Please upload a .txt file");
      onLog(msg, "error");
      setUploadMessage(msg);
      return;
    }

    setIsUploading(true);
    setUploadMessage(null);

    try {
      const formData = new FormData();
      formData.append("cookies_file", file);

      const res = await fetch(`${apiBase}/api/cookies/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = tpl(t.uploadError, { error: data.error || `HTTP ${res.status}` });
        onLog(errMsg, "error");
        setUploadMessage(errMsg);
        return;
      }

      const successMsg = tpl(t.uploadSuccess, { lines: data.lines ?? 0 });
      onLog(successMsg, "success");
      setUploadMessage(successMsg);
      setShowUpload(false);
      // Refresh status to reflect the new cookie file
      setTimeout(fetchStatus, 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      const errMsg = tpl(t.uploadError, { error: msg });
      onLog(errMsg, "error");
      setUploadMessage(errMsg);
    } finally {
      setIsUploading(false);
    }
  }, [isUploading, apiBase, t, onLog, fetchStatus]);

  // ── Drag-and-drop handlers ───────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    // Reset so the same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [handleFileUpload]);

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

  const isVercel = status.is_vercel;
  const isUploadError = uploadMessage && uploadMessage.includes(t.uploadError.split("{error}")[0]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* ── Status bar ── */}
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

        {/* Manual hint / hint text */}
        {variant === "missing" && !isCapturing && !showUpload && (
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
        <div style={{ display: "flex", gap: "8px", flexShrink: 0, flexWrap: "wrap" }}>

          {/* Upload button — always available */}
          {!isCapturing && (
            <button
              id="cookie-upload-button"
              className="btn btn-primary"
              onClick={() => setShowUpload((v) => !v)}
              style={{ padding: "8px 16px", fontSize: "13px", gap: "6px" }}
            >
              <Upload size={13} />
              {t.uploadButton}
            </button>
          )}

          {/* Auto-Capture — local only (hidden on Vercel) */}
          {!isVercel && (variant === "expiring" || variant === "missing") && !isCapturing && (
            <button
              id="cookie-capture-button"
              className="btn"
              onClick={handleCapture}
              style={{
                padding: "8px 14px",
                fontSize: "13px",
                gap: "6px",
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              <RefreshCw size={13} />
              {t.captureButton}
            </button>
          )}

          {/* Re-capture even when active (local only) */}
          {!isVercel && variant === "active" && !isCapturing && (
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

      {/* ── Upload drop-zone ── */}
      {showUpload && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            padding: "20px",
            borderRadius: "12px",
            border: `2px dashed ${isDragging ? "var(--accent)" : "var(--border)"}`,
            background: isDragging
              ? "rgba(var(--accent-rgb, 99,102,241), 0.06)"
              : "var(--card-bg, rgba(255,255,255,0.03))",
            transition: "all 0.2s ease",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
            textAlign: "center",
            cursor: "pointer",
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            id="cookies-file-input"
            type="file"
            accept=".txt,text/plain"
            style={{ display: "none" }}
            onChange={handleFileInputChange}
          />

          {isUploading ? (
            <Loader2 size={28} style={{ color: "var(--accent)", animation: "spin 1s linear infinite" }} />
          ) : uploadMessage && !isUploadError ? (
            <CheckCircle2 size={28} style={{ color: "#22c55e" }} />
          ) : (
            <Upload size={28} style={{ color: "var(--text-tertiary)", opacity: 0.7 }} />
          )}

          <div>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
              {isUploading ? "Uploading…" : t.dropHint}
            </p>
            <p style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
              {t.uploadHint}
            </p>
          </div>

          {uploadMessage && (
            <span
              style={{
                fontSize: "12px",
                padding: "6px 12px",
                borderRadius: "8px",
                background: isUploadError
                  ? "rgba(239,68,68,0.1)"
                  : "rgba(34,197,94,0.1)",
                color: isUploadError ? "#ef4444" : "#22c55e",
                fontWeight: 500,
              }}
            >
              {uploadMessage}
            </span>
          )}

          <button
            className="btn"
            style={{
              padding: "8px 18px",
              fontSize: "13px",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              gap: "6px",
              pointerEvents: "none", // click is handled by the wrapper div
            }}
          >
            <Upload size={13} />
            Choose cookies.txt
          </button>
        </div>
      )}
    </div>
  );
}
