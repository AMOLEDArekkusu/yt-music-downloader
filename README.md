<div align="center">

# 🎵 Collector Pro

### YouTube Music Downloader — Web Edition

**A modern, full-stack web app for downloading YouTube Music as high-quality MP3s with full metadata tagging.**

<br/>

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![yt-dlp](https://img.shields.io/badge/yt--dlp-latest-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://github.com/yt-dlp/yt-dlp)
[![License](https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge)](LICENSE)

<br/>

> 320 kbps · Stereo · 48 kHz · ID3v2 Metadata · Cookie Auto-Capture · 4 Languages

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Cookie Authentication](#-cookie-authentication)
- [API Reference](#-api-reference)
- [File Structure](#-file-structure)
- [Supported Languages](#-supported-languages)
- [Configuration](#-configuration)
- [Vercel Deployment](#-vercel-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

---

## 🌟 Overview

**Collector Pro** is the web-based evolution of the original Python GUI downloader. It pairs a polished Next.js frontend with a Python Flask backend to fetch, convert, and tag YouTube/YouTube Music tracks as broadcast-quality MP3 files — all from your browser.

| Capability | Detail |
|---|---|
| 🎧 Audio Quality | 320 kbps MP3 · Stereo · 48 kHz |
| 🏷️ Metadata | Full ID3v2.3 — title, artist, album, year, genre, track number |
| 🖼️ Artwork | Embedded album art from YouTube thumbnails |
| 🌐 Filenames | Full UTF-8 support (CJK, Cyrillic, Arabic, …) |
| 🔑 Auth | Cookie Auto-Capture — one-click YouTube sign-in |
| 🧹 Cleanup | Automatic temp-file removal after every download |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Next.js 16  ·  React 19               │
│                                                         │
│   Tailwind CSS 4  ·  next-themes (dark / light)         │
│   Client-side i18n — EN · ZH · JA · MS                 │
│   Glassmorphism UI  ·  Micro-animations  ·  Responsive  │
└────────────────────────┬────────────────────────────────┘
                         │  REST API  (JSON / HTTP)
┌────────────────────────▼────────────────────────────────┐
│                  Python Flask Backend                   │
│                                                         │
│  yt-dlp  ──►  Audio extraction (android + tv_embedded)  │
│  FFmpeg  ──►  MP3 encoding — 320 kbps · 48 kHz · stereo │
│  mutagen ──►  ID3v2.3 metadata + artwork embedding      │
│                                                         │
│  Cookie Auto-Capture                                    │
│    └─ Launches sandboxed Chrome, polls for sign-in,     │
│       exports Netscape cookies.txt via yt-dlp           │
│                                                         │
│  Session-based temp storage with automatic cleanup      │
│  Output filename: Song_Name-Artist_Name.mp3 (UTF-8)     │
└─────────────────────────────────────────────────────────┘
```

### Component Map

| Layer | Technology | Key File(s) |
|---|---|---|
| Main page | Next.js + React | [`app/page.tsx`](app/page.tsx) |
| Design system | CSS Custom Properties + Tailwind 4 | [`app/globals.css`](app/globals.css) |
| Theme toggle | next-themes + Lucide | [`app/components/ThemeToggle.tsx`](app/components/ThemeToggle.tsx) |
| Language switcher | Client-side i18n | [`app/components/LanguageSwitcher.tsx`](app/components/LanguageSwitcher.tsx) |
| Track card | React component | [`app/components/TrackCard.tsx`](app/components/TrackCard.tsx) |
| Progress log | Terminal-style component | [`app/components/ProgressLog.tsx`](app/components/ProgressLog.tsx) |
| Cookie banner | Auth status + Auto-Capture UI | [`app/components/CookieStatusBanner.tsx`](app/components/CookieStatusBanner.tsx) |
| Backend API | Flask + yt-dlp + mutagen | [`api/index.py`](api/index.py) |
| Translations | JSON message files | [`messages/`](messages/) |

---

## ✨ Features

### 🎨 Frontend
- **Glassmorphism UI** — modern cards, gradients, and smooth micro-animations
- **Dark / Light theme** — persistent system-aware toggle
- **4 languages** — English, 中文, 日本語, Bahasa Melayu — loaded client-side, no build step needed
- **Responsive** — works great on desktop and mobile
- **Real-time progress log** — terminal-style output showing every download step
- **Track preview** — thumbnail, title, artist, and duration before you commit to downloading
- **Cookie Status Banner** — live auth state indicator with one-click Auto-Capture trigger

### ⚙️ Backend
- **Broad URL support** — single videos, playlists, albums, YouTube Music, YouTube Shorts
- **High-quality output** — 320 kbps MP3, stereo, 48 kHz, ID3v2.3
- **Smart player clients** — uses `android` + `tv_embedded` (no PO Token required); `ios` intentionally excluded
- **UTF-8 filenames** — NFC-normalized, path-safe, supports all scripts
- **Session security** — UUID-scoped temp dirs with path-traversal protection
- **Cookie Auto-Capture** — launches a fresh sandboxed Chrome profile, detects sign-in, exports `cookies.txt` automatically

---

## 📦 Prerequisites

| Requirement | Minimum Version | Check |
|---|---|---|
| **Node.js** | 18.x | `node --version` |
| **npm** | 9.x | `npm --version` |
| **Python** | 3.9 | `python --version` |
| **pip** | 21.x | `pip --version` |
| **FFmpeg** | 5.x | `ffmpeg -version` |

<details>
<summary>📥 How to install FFmpeg</summary>

#### Windows
```bash
# Recommended — winget
winget install Gyan.FFmpeg

# Manual — download the release build and add bin/ to PATH
# https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
```

#### macOS
```bash
brew install ffmpeg
```

#### Linux (Ubuntu / Debian)
```bash
sudo apt update && sudo apt install ffmpeg
```

</details>

---

## 🚀 Quick Start

### 1. Clone

```bash
git clone <your-repo-url>
cd yt-music-downloader
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Install backend dependencies

```bash
pip install -r api/requirements.txt
```

### 4. Run both servers

Open **two** terminal windows side by side:

**Terminal 1 — Next.js frontend** (port 3000)
```bash
npm run dev
```

**Terminal 2 — Flask backend** (port 5000)
```bash
python api/index.py
```

### 5. Open the app

Navigate to **[http://localhost:3000](http://localhost:3000)**.

> The Next.js dev server rewrites `/api/*` → `http://localhost:5000` via [`next.config.ts`](next.config.ts), so both services work together seamlessly.

---

## 🍪 Cookie Authentication

YouTube requires valid authentication cookies to prevent bot-detection. The **Cookie Status Banner** at the top of the page shows whether cookies are present, how old they are, and whether they're still fresh.

### Option A — Auto-Capture *(recommended, local only)*

1. Click **"Auto-Capture"** in the banner
2. A sandboxed Chrome window opens pointing to YouTube Music
3. Sign in with your Google account
4. Chrome closes automatically once sign-in is detected
5. `api/cookies.txt` is saved and the banner turns green ✅

> **Requires:** Google Chrome or Chromium installed on the machine.  
> **Not available** on Vercel or other serverless hosts — use Option B there.

### Option B — Manual Export

1. Install **[Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)** in Chrome
2. Visit [youtube.com](https://youtube.com) while signed in
3. Click the extension icon → **Export** → save the file as `api/cookies.txt`

### Cookie Freshness

Cookies typically expire after **~14 days**. The banner displays the cookie age and warns you when they go stale. Refresh via Auto-Capture or a new manual export.

> **Chrome 127+ note:** App-Bound Encryption (DPAPI) prevents external tools from reading cookies from your main Chrome profile. Auto-Capture sidesteps this by launching a **fresh temporary profile** that is not protected by DPAPI.

---

## 📡 API Reference

### `GET /api/status`
Health check.

```json
{
  "status": "online",
  "message": "Collector Pro backend is running.",
  "version": "2.1.0"
}
```

---

### `POST /api/fetch`
Extract track metadata from a YouTube URL — no download yet.

**Request**
```json
{ "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }
```

**Response `200`**
```json
{
  "session_id": "uuid-string",
  "tracks": [
    {
      "id": "dQw4w9WgXcQ",
      "title": "Rick Astley - Never Gonna Give You Up",
      "artist": "Rick Astley",
      "duration": 212,
      "thumbnail": "https://...",
      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    }
  ],
  "count": 1
}
```

**Response `401` — auth required**
```json
{
  "error": "YouTube requires authentication cookies...",
  "error_type": "auth_required"
}
```

---

### `POST /api/download`
Download and convert a single track to MP3.

**Request**
```json
{
  "session_id": "uuid-from-fetch",
  "track_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "track_id": "dQw4w9WgXcQ"
}
```

**Response `200`**
```json
{
  "status": "success",
  "filename": "Never_Gonna_Give_You_Up-Rick_Astley.mp3",
  "title": "Never Gonna Give You Up",
  "artist": "Rick Astley"
}
```

---

### `GET /api/download/:session_id/:filename`
Stream a completed MP3 file to the browser for download.

---

### `POST /api/cleanup`
Delete all temp files for a session.

**Request**
```json
{ "session_id": "uuid-from-fetch" }
```

---

### `GET /api/cookies/status`
Return the state of `cookies.txt` and any active Auto-Capture.

**Response**
```json
{
  "exists": true,
  "age_days": 3.2,
  "fresh": true,
  "capture": {
    "running": false,
    "status": "success",
    "message": "Cookies saved successfully!"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `exists` | `bool` | Whether `api/cookies.txt` is present |
| `age_days` | `float \| null` | Age in days; `null` if missing |
| `fresh` | `bool` | `true` if age < 14 days |
| `capture.running` | `bool` | Auto-Capture in progress |
| `capture.status` | `string` | `idle` · `waiting_login` · `success` · `error` · `timeout` |

---

### `POST /api/cookies/capture`
Start an asynchronous Cookie Auto-Capture. Returns immediately — poll `GET /api/cookies/status` for progress.

| Scenario | HTTP | Body |
|---|---|---|
| Started | `200` | `{ "status": "started", "message": "Chrome is opening…" }` |
| Already running | `409` | `{ "status": "already_running" }` |
| Chrome not found | `422` | `{ "error": "…", "error_type": "chrome_not_found" }` |

---

## 📁 File Structure

```
yt-music-downloader/
│
├── api/
│   ├── index.py              # Flask backend — download, convert, tag, cookie capture
│   ├── requirements.txt      # Python dependencies (Flask, yt-dlp, mutagen)
│   └── cookies.txt           # Netscape-format auth cookies (auto-generated or manual)
│
├── app/
│   ├── components/
│   │   ├── CookieStatusBanner.tsx   # Auth status + Auto-Capture trigger
│   │   ├── ThemeProvider.tsx        # next-themes wrapper
│   │   ├── ThemeToggle.tsx          # Dark / light mode button
│   │   ├── LanguageSwitcher.tsx     # Language dropdown (EN / ZH / JA / MS)
│   │   ├── TrackCard.tsx            # Track display card with download action
│   │   └── ProgressLog.tsx          # Terminal-style activity log
│   ├── globals.css                  # Design system & Tailwind theme tokens
│   ├── layout.tsx                   # Root layout — fonts, providers, metadata
│   └── page.tsx                     # Main application page
│
├── messages/
│   ├── en.json                # English
│   ├── zh.json                # Chinese (中文)
│   ├── ja.json                # Japanese (日本語)
│   └── ms.json                # Malay (Bahasa Melayu)
│
├── next.config.ts             # Next.js config — API proxy rewrite
├── vercel.json                # Vercel deployment config
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🌐 Supported Languages

| Code | Language | File |
|---|---|---|
| `en` | English | [`messages/en.json`](messages/en.json) |
| `zh` | 中文 (Chinese) | [`messages/zh.json`](messages/zh.json) |
| `ja` | 日本語 (Japanese) | [`messages/ja.json`](messages/ja.json) |
| `ms` | Bahasa Melayu (Malay) | [`messages/ms.json`](messages/ms.json) |

Translations are resolved **client-side at runtime** — no build step or server restart needed.

**To add a new language:**

1. Create `messages/<code>.json` and copy the structure from `messages/en.json`
2. Translate all values
3. Add an entry to `LANGUAGES` in [`app/components/LanguageSwitcher.tsx`](app/components/LanguageSwitcher.tsx)
4. Register the import and locale key in the `messageMap` inside [`app/page.tsx`](app/page.tsx)

---

## ⚙️ Configuration

### Audio Output

| Setting | Value |
|---|---|
| Format | MP3 |
| Bitrate | 320 kbps |
| Sample Rate | 48,000 Hz |
| Channels | Stereo (2) |
| Metadata standard | ID3v2.3 |
| Filename pattern | `Song_Name-Artist_Name.mp3` |
| Filename encoding | UTF-8 (NFC) |

### yt-dlp Player Clients

The backend targets the `android` and `tv_embedded` YouTube player clients (with a `web` fallback). The `ios` client is **deliberately excluded** — it requires a GVS PO Token (yt-dlp 2026+) and silently skips all formats without one, causing the *"Requested format is not available"* error.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Flask backend port |
| `FLASK_DEBUG` | `true` | Enable Flask debug mode |

---

## ☁️ Vercel Deployment

> **⚠️ Limitation:** Vercel serverless functions time out after 10 s (free) / 60 s (Pro). Audio download + FFmpeg conversion typically exceeds this. For real downloads, use **localhost mode**. Vercel is best suited for hosting the UI and metadata fetching only.

> **⚠️ Auto-Capture unavailable:** Cookie Auto-Capture requires a local Chrome installation and cannot run on Vercel. Supply `api/cookies.txt` via another method (e.g., environment secret) when deploying remotely.

### Deploy Steps

1. Push the repo to GitHub
2. Import the repository on [Vercel](https://vercel.com/new)
3. Vercel auto-detects Next.js (frontend) and Python (API)
4. Deploy — UI works immediately; download functionality is limited by serverless timeouts

The included [`vercel.json`](vercel.json) pre-configures:
- `@vercel/next` for the frontend build
- `@vercel/python` for the Flask API
- `/api/*` route rewrites to the Python handler

---

## 🛠️ Troubleshooting

<details>
<summary>❌ FFmpeg not found</summary>

Verify FFmpeg is on your system PATH:
```bash
ffmpeg -version
```
If missing, follow the [FFmpeg installation steps](#-prerequisites) above.

</details>

<details>
<summary>❌ CORS errors in the browser</summary>

The Flask backend uses `flask-cors`. Make sure:
- The Flask server is running on port 5000 (`python api/index.py`)
- The Next.js dev server is running (`npm run dev`)
- The proxy rewrite in [`next.config.ts`](next.config.ts) maps `/api/*` → `http://localhost:5000`

</details>

<details>
<summary>❌ YouTube bot detection / "Sign-in required" / auth_required error</summary>

YouTube blocks unauthenticated yt-dlp requests. The Cookie Status Banner will tell you if cookies are missing or stale.

**Fix — Auto-Capture (local only):**
1. Click **"Auto-Capture"** in the banner
2. Sign in to YouTube in the Chrome window that opens
3. The window closes automatically and `api/cookies.txt` is saved

**Fix — Manual export:**
1. Install [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
2. While signed into YouTube, click the extension → Export → save as `api/cookies.txt`

Cookies expire after ~14 days. Refresh them when the banner turns yellow.

</details>

<details>
<summary>❌ "Requested format is not available"</summary>

This usually means yt-dlp picked the `ios` player client, which requires a PO Token.

1. Update yt-dlp: `pip install -U yt-dlp`
2. Confirm `api/cookies.txt` exists and is fresh (< 14 days old)
3. Re-run Auto-Capture to refresh cookies

</details>

<details>
<summary>❌ Auto-Capture — Chrome not found</summary>

Chrome or Chromium must be installed for Auto-Capture. The backend searches standard Windows installation paths. If Chrome is in a non-standard location, add its directory to your system PATH, or use the **manual export** method instead.

</details>

<details>
<summary>❌ Auto-Capture — empty cookies file</summary>

Chrome 127+ applies App-Bound Encryption (DPAPI) to your main profile's cookies. Auto-Capture uses a **fresh temporary profile** to bypass this. If the resulting `cookies.txt` is still empty, fall back to the **manual export** browser-extension method.

</details>

<details>
<summary>❌ Download times out on Vercel</summary>

Vercel serverless functions have a 10–60 s execution limit. Audio downloading + FFmpeg conversion takes longer. Use **localhost mode** for actual downloads; Vercel is suitable for UI hosting and metadata fetching only.

</details>

<details>
<summary>❌ Non-ASCII filenames not working</summary>

The backend normalizes filenames to NFC Unicode and strips only path-unsafe characters, preserving all UTF-8 letters. NTFS (Windows), ext4 (Linux), and APFS (macOS) all support UTF-8 filenames natively.

</details>

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
   ```bash
   git checkout -b feature/my-feature
   ```
3. Commit your changes
   ```bash
   git commit -m "feat: add my feature"
   ```
4. Push to your fork
   ```bash
   git push origin feature/my-feature
   ```
5. Open a Pull Request against `main`

---

<div align="center">

Built with ❤️ using **Next.js · Flask · yt-dlp · FFmpeg**

*320 kbps · Stereo · 48 kHz · Full ID3v2 Metadata · Cookie Auto-Capture*

</div>
