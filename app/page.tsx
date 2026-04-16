"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Music,
  Search,
  Download,
  Package,
  Loader2,
  Zap,
  Headphones,
  Info,
} from "lucide-react";
import ThemeToggle from "./components/ThemeToggle";
import LanguageSwitcher, {
  type LangCode,
} from "./components/LanguageSwitcher";
import TrackCard, { type Track, type TrackStatus } from "./components/TrackCard";
import ProgressLog, { type LogEntry } from "./components/ProgressLog";

// ─── i18n: client-side messages loader ────────────────────────────────
import enMessages from "../messages/en.json";
import zhMessages from "../messages/zh.json";
import jaMessages from "../messages/ja.json";
import msMessages from "../messages/ms.json";

type Messages = typeof enMessages;
const messageMap: Record<string, Messages> = {
  en: enMessages,
  zh: zhMessages,
  ja: jaMessages,
  ms: msMessages,
};

function useMessages(locale: LangCode): Messages {
  return messageMap[locale] || enMessages;
}

// ─── Helper: simple {key} template replacement ────────────────────────
function tpl(template: string, vars: Record<string, string | number>): string {
  let result = template;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(`{${k}}`, String(v));
  }
  return result;
}

// ─── Constants ────────────────────────────────────────────────────────
const API_BASE =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "";

// ─── Main Page ────────────────────────────────────────────────────────
export default function Home() {
  const [locale, setLocale] = useState<LangCode>("en");
  const t = useMessages(locale);

  const [url, setUrl] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [trackStatuses, setTrackStatuses] = useState<Record<string, TrackStatus>>(
    {}
  );
  const [isFetching, setIsFetching] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logCounterRef = useRef(0);

  // ─── Logging helper ─────────────────────────────────────────────────
  const addLog = useCallback(
    (message: string, type: LogEntry["type"] = "info") => {
      const ts = new Date().toLocaleTimeString("en-GB", { hour12: false });
      logCounterRef.current += 1;
      const newId = logCounterRef.current;
      setLogs((prevLogs) => [
        ...prevLogs,
        { id: newId, message, type, timestamp: ts },
      ]);
    },
    []
  );

  const clearLogs = useCallback(() => {
    setLogs([]);
    logCounterRef.current = 0;
  }, []);

  // ─── Persist locale ─────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("yt-dl-locale") as LangCode | null;
    if (saved && messageMap[saved]) setLocale(saved);
  }, []);

  const handleLocaleChange = useCallback((newLocale: LangCode) => {
    setLocale(newLocale);
    localStorage.setItem("yt-dl-locale", newLocale);
  }, []);

  // ─── Validate URL ──────────────────────────────────────────────────
  function isValidYouTubeUrl(url: string): boolean {
    const patterns = [
      /youtube\.com\/watch/,
      /youtube\.com\/playlist/,
      /youtu\.be\//,
      /music\.youtube\.com/,
      /youtube\.com\/shorts/,
    ];
    return patterns.some((p) => p.test(url));
  }

  // ─── Fetch tracks ──────────────────────────────────────────────────
  const fetchTracks = useCallback(async () => {
    if (!url.trim()) {
      addLog(t.errors.invalidUrl, "error");
      return;
    }
    if (!isValidYouTubeUrl(url.trim())) {
      addLog(t.errors.invalidUrl, "error");
      return;
    }

    setIsFetching(true);
    setTracks([]);
    setTrackStatuses({});
    addLog(t.log.fetching, "system");

    try {
      const response = await fetch(`${API_BASE}/api/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Unknown error" }));
        addLog(tpl(t.log.fetchError, { error: errData.error || `HTTP ${response.status}` }), "error");
        setIsFetching(false);
        return;
      }

      const data = await response.json();
      if (!data.tracks || data.tracks.length === 0) {
        addLog(t.errors.noTracks, "warning");
        setIsFetching(false);
        return;
      }

      setTracks(data.tracks);
      setSessionId(data.session_id);
      const initialStatuses: Record<string, TrackStatus> = {};
      data.tracks.forEach((track: Track) => {
        initialStatuses[track.id] = "idle";
      });
      setTrackStatuses(initialStatuses);
      addLog(tpl(t.log.fetchSuccess, { count: data.tracks.length }), "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      addLog(tpl(t.log.fetchError, { error: msg }), "error");
    } finally {
      setIsFetching(false);
    }
  }, [url, t, addLog]);

  // ─── Download single track ─────────────────────────────────────────
  const downloadTrack = useCallback(
    async (track: Track) => {
      if (!sessionId) return;

      setTrackStatuses((prev) => ({ ...prev, [track.id]: "downloading" }));
      addLog(tpl(t.log.downloadStart, { title: track.title }), "info");

      try {
        const response = await fetch(`${API_BASE}/api/download`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            track_url: track.url,
            track_id: track.id,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({ error: "Download failed" }));
          addLog(tpl(t.log.downloadError, { error: errData.error || `HTTP ${response.status}` }), "error");
          setTrackStatuses((prev) => ({ ...prev, [track.id]: "error" }));
          return;
        }

        const data = await response.json();
        const filename = data.filename;

        // Trigger file download from the server
        const fileUrl = `${API_BASE}/api/download/${sessionId}/${encodeURIComponent(filename)}`;
        const a = document.createElement("a");
        a.href = fileUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTrackStatuses((prev) => ({ ...prev, [track.id]: "downloaded" }));
        addLog(tpl(t.log.downloadComplete, { filename }), "success");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        addLog(tpl(t.log.downloadError, { error: msg }), "error");
        setTrackStatuses((prev) => ({ ...prev, [track.id]: "error" }));
      }
    },
    [sessionId, t, addLog]
  );

  // ─── Download all tracks ───────────────────────────────────────────
  const downloadAll = useCallback(async () => {
    setIsDownloadingAll(true);
    for (const track of tracks) {
      if (trackStatuses[track.id] === "downloaded") continue;
      await downloadTrack(track);
    }
    setIsDownloadingAll(false);

    const downloadedCount = Object.values(trackStatuses).filter(
      (s) => s === "downloaded"
    ).length;
    addLog(tpl(t.log.allComplete, { count: tracks.length }), "success");

    // Cleanup session
    if (sessionId) {
      try {
        await fetch(`${API_BASE}/api/cleanup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        addLog(t.log.cleanupDone, "system");
      } catch {
        // Non-critical, ignore cleanup errors
      }
    }
  }, [tracks, trackStatuses, downloadTrack, sessionId, t, addLog]);

  // ─── Keyboard shortcut: Enter to fetch ─────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isFetching) {
        fetchTracks();
      }
    },
    [fetchTracks, isFetching]
  );

  const downloadedCount = Object.values(trackStatuses).filter(
    (s) => s === "downloaded"
  ).length;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* ═══ Header ═══ */}
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <Music size={20} />
          </div>
          <div>
            <span className="logo-text">{t.app.title}</span>
            <span className="logo-badge">{t.app.version}</span>
          </div>
        </div>

        <div className="header-actions">
          <LanguageSwitcher
            currentLocale={locale}
            onLocaleChange={handleLocaleChange}
          />
          <ThemeToggle />
        </div>
      </header>

      {/* ═══ Main Content ═══ */}
      <main
        className="container"
        style={{
          flex: 1,
          paddingTop: "32px",
          paddingBottom: "32px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        {/* ── Hero Section ── */}
        <div
          className="animate-fade-in"
          style={{ textAlign: "center", marginBottom: "8px" }}
        >
          <h1
            style={{
              fontSize: "clamp(24px, 4vw, 36px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
              marginBottom: "8px",
            }}
          >
            <span className="gradient-text">{t.app.subtitle}</span>
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "15px",
              maxWidth: "480px",
              margin: "0 auto",
            }}
          >
            {t.input.pasteHint}
          </p>
        </div>

        {/* ── URL Input & Fetch ── */}
        <div
          className="card animate-slide-up"
          style={{ padding: "20px", opacity: 0, animationFillMode: "forwards" }}
        >
          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "stretch",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: 1, minWidth: "200px", position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-tertiary)",
                  pointerEvents: "none",
                }}
              >
                <Search size={18} />
              </div>
              <input
                id="url-input"
                type="text"
                className="input-field input-large"
                style={{ paddingLeft: "42px" }}
                placeholder={t.input.placeholder}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isFetching}
              />
            </div>
            <button
              id="fetch-button"
              className="btn btn-primary"
              onClick={fetchTracks}
              disabled={isFetching || !url.trim()}
              style={{ padding: "14px 28px", fontSize: "15px" }}
            >
              {isFetching ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {t.input.fetchingButton}
                </>
              ) : (
                <>
                  <Search size={18} />
                  {t.input.fetchButton}
                </>
              )}
            </button>
          </div>

          {/* Quality badges */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "14px",
              flexWrap: "wrap",
            }}
          >
            <div className="badge badge-accent">
              <Headphones size={12} />
              {t.config.qualityHigh}
            </div>
            <div className="badge badge-accent">
              <Zap size={12} />
              {t.config.stereo48k}
            </div>
            <div className="badge badge-accent">
              <Info size={12} />
              {t.config.format}
            </div>
          </div>
        </div>

        {/* ── Two Column Layout: Tracks + Log ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: tracks.length > 0 ? "1fr 1fr" : "1fr",
            gap: "24px",
            flex: 1,
            minHeight: 0,
          }}
          className="main-grid"
        >
          {/* Track List */}
          {tracks.length > 0 && (
            <div
              className="card animate-slide-up"
              style={{
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                opacity: 0,
                animationFillMode: "forwards",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <h2
                    className="section-title"
                    style={{ marginBottom: "2px" }}
                  >
                    {t.tracks.title}
                  </h2>
                  <span
                    style={{ fontSize: "13px", color: "var(--text-secondary)" }}
                  >
                    {tpl(t.tracks.count, { count: tracks.length })}
                    {downloadedCount > 0 && (
                      <> · <span style={{ color: "var(--success)" }}>{downloadedCount} ✓</span></>
                    )}
                  </span>
                </div>

                <button
                  id="download-all-button"
                  className="btn btn-primary"
                  onClick={downloadAll}
                  disabled={
                    isDownloadingAll || tracks.length === 0
                  }
                  style={{ padding: "10px 20px" }}
                >
                  {isDownloadingAll ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {t.tracks.downloading}
                    </>
                  ) : (
                    <>
                      <Package size={16} />
                      {t.tracks.downloadAll}
                    </>
                  )}
                </button>
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  maxHeight: "500px",
                  scrollbarWidth: "thin",
                  scrollbarColor: "var(--border) transparent",
                }}
              >
                {tracks.map((track, index) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    status={trackStatuses[track.id] || "idle"}
                    index={index}
                    onDownload={downloadTrack}
                    t={{
                      download: t.tracks.download,
                      downloading: t.tracks.downloading,
                      downloaded: t.tracks.downloaded,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Progress Log */}
          <div
            className="animate-slide-up stagger-2"
            style={{ opacity: 0, animationFillMode: "forwards" }}
          >
            <ProgressLog
              logs={logs}
              onClear={clearLogs}
              t={{
                title: t.log.title,
                clear: t.log.clear,
                empty: t.log.empty,
              }}
            />
          </div>
        </div>
      </main>

      {/* ═══ Footer ═══ */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "16px 0",
          textAlign: "center",
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            flexWrap: "wrap",
            fontSize: "12px",
            color: "var(--text-tertiary)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Zap size={12} />
            {t.footer.powered}
          </span>
          <span style={{ color: "var(--border)" }}>·</span>
          <span>{t.footer.quality}</span>
        </div>
      </footer>

      {/* ═══ Responsive Grid Override ═══ */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .main-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
