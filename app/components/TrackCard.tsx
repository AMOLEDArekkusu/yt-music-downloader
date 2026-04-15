"use client";

import { Download, Check, Loader2 } from "lucide-react";

export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number; // seconds
  thumbnail: string;
  url: string;
}

export type TrackStatus = "idle" | "downloading" | "downloaded" | "error";

interface TrackCardProps {
  track: Track;
  status: TrackStatus;
  index: number;
  onDownload: (track: Track) => void;
  t: {
    download: string;
    downloading: string;
    downloaded: string;
  };
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TrackCard({
  track,
  status,
  index,
  onDownload,
  t,
}: TrackCardProps) {
  return (
    <div
      className={`track-card animate-fade-in stagger-${Math.min(index + 1, 5)}`}
      style={{ opacity: 0, animationFillMode: "forwards" }}
    >
      {/* Thumbnail */}
      {track.thumbnail ? (
        <img
          src={track.thumbnail}
          alt={track.title}
          className="track-thumb"
          loading="lazy"
        />
      ) : (
        <div
          className="track-thumb"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-tertiary)",
            fontSize: "20px",
          }}
        >
          ♪
        </div>
      )}

      {/* Info */}
      <div className="track-info">
        <div className="track-title" title={track.title}>
          {track.title}
        </div>
        <div className="track-artist">{track.artist || "Unknown Artist"}</div>
      </div>

      {/* Duration */}
      <div className="track-duration">
        {track.duration > 0 ? formatDuration(track.duration) : "--:--"}
      </div>

      {/* Download Button */}
      <button
        className={`btn ${
          status === "downloaded"
            ? "btn-ghost"
            : status === "downloading"
            ? "btn-secondary"
            : "btn-primary"
        }`}
        onClick={() => onDownload(track)}
        disabled={status === "downloading" || status === "downloaded"}
        style={{
          minWidth: "110px",
          padding: "8px 14px",
          fontSize: "12px",
          ...(status === "downloaded"
            ? { color: "var(--success)", background: "var(--success-soft)" }
            : {}),
        }}
      >
        {status === "downloading" ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            {t.downloading}
          </>
        ) : status === "downloaded" ? (
          <>
            <Check size={14} />
            {t.downloaded}
          </>
        ) : (
          <>
            <Download size={14} />
            {t.download}
          </>
        )}
      </button>
    </div>
  );
}
