# 🎵 Collector Pro — YouTube Music Downloader (Web)

> **A modern, full-stack web application for downloading YouTube Music to high-quality MP3 with full metadata tagging.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.9+-blue?logo=python)](https://python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0-green?logo=flask)](https://flask.palletsprojects.com/)
[![yt-dlp](https://img.shields.io/badge/yt--dlp-latest-red)](https://github.com/yt-dlp/yt-dlp)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start — Local Development](#quick-start--local-development)
- [Cookie Authentication](#cookie-authentication)
- [Vercel Deployment](#vercel-deployment)
- [API Reference](#api-reference)
- [File Structure](#file-structure)
- [Supported Languages](#supported-languages)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Overview

Collector Pro Web is the web-based successor to the original Python GUI downloader. It provides a premium, responsive interface for fetching and downloading YouTube Music tracks to MP3, complete with:

- **320kbps stereo audio** at 48kHz sampling rate
- **Full ID3v2 metadata** — title, artist, album, year, genre, track number
- **Embedded album artwork** from YouTube thumbnails
- **UTF-8 filename support** — works with all languages and special characters
- **Automatic session cleanup** — no temp files left behind
- **Cookie Auto-Capture** — one-click YouTube sign-in to bypass bot detection

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Next.js Frontend                      │
│                                                          │
│   React 19  ·  Tailwind CSS 4  ·  next-themes (dark)    │
│   Client-side i18n (EN · ZH · JA · MS)                  │
│   Responsive  ·  Glassmorphism  ·  Animations           │
└────────────────────────┬─────────────────────────────────┘
                         │  REST API (JSON)
┌────────────────────────▼─────────────────────────────────┐
│                 Python Flask Backend                     │
│                                                          │
│   yt-dlp ──── Audio extraction & conversion              │
│   FFmpeg ──── MP3 encoding (320kbps · 48kHz · stereo)    │
│   mutagen ─── ID3v2 metadata tagging                     │
│                                                          │
│   Cookie Auto-Capture: launches Chrome, polls login,    │
│   exports Netscape cookies.txt via yt-dlp               │
│                                                          │
│   Session-based temp storage with auto-cleanup           │
│   Output: Song_Name-Artist_Name.mp3 (UTF-8)             │
└──────────────────────────────────────────────────────────┘
```

### Component Mapping

| Component | Technology | File(s) |
|-----------|-----------|---------|
| Frontend UI | Next.js 16 + React 19 | [`app/page.tsx`](app/page.tsx) |
| Design System | CSS Custom Properties + Tailwind | [`app/globals.css`](app/globals.css) |
| Theme Toggle | next-themes + Lucide Icons | [`app/components/ThemeToggle.tsx`](app/components/ThemeToggle.tsx) |
| Language Switcher | Client-side i18n | [`app/components/LanguageSwitcher.tsx`](app/components/LanguageSwitcher.tsx) |
| Track Display | React Component | [`app/components/TrackCard.tsx`](app/components/TrackCard.tsx) |
| Process Log | Terminal-style Component | [`app/components/ProgressLog.tsx`](app/components/ProgressLog.tsx) |
| Cookie Banner | Auth status + Auto-Capture UI | [`app/components/CookieStatusBanner.tsx`](app/components/CookieStatusBanner.tsx) |
| Backend API | Flask + yt-dlp + mutagen | [`api/index.py`](api/index.py) |
| Translations | JSON message files | [`messages/`](messages/) |

---

## Features

### 🎨 Frontend
- **Modern UI** with glassmorphism cards and micro-animations
- **Dark / Light theme** toggle with smooth transitions
- **Multilingual support** — English, Chinese, Japanese, Malay (client-side, no build step)
- **Responsive design** — works on desktop and mobile
- **Real-time progress log** with terminal-style interface
- **Track preview** — see title, artist, duration, and thumbnail before downloading
- **Cookie Status Banner** — shows authentication status and triggers Auto-Capture

### 🔧 Backend
- **YouTube URL support** — single videos, playlists, albums, YouTube Music, YouTube Shorts
- **High-quality audio** — 320kbps MP3, stereo, 48kHz sampling
- **Full metadata tagging** — ID3v2 with title, artist, album, year, genre, artwork
- **UTF-8 filenames** — supports all languages (CJK, Cyrillic, Arabic, etc.)
- **Output format** — `Song_Name-Artist_Name.mp3`
- **Session management** — temp files cleaned up after download completes
- **Security** — UUID-based sessions with path traversal protection
- **Cookie Auto-Capture** — launches a sandboxed Chrome instance, detects YouTube sign-in, and exports `cookies.txt` automatically

---

## Prerequisites

Ensure the following are installed on your system:

| Requirement | Version | Check Command |
|-------------|---------|--------------|
| **Node.js** | ≥ 18.x | `node --version` |
| **npm** | ≥ 9.x | `npm --version` |
| **Python** | ≥ 3.9 | `python --version` |
| **pip** | ≥ 21.x | `pip --version` |
| **FFmpeg** | ≥ 5.x | `ffmpeg -version` |

<details>
<summary>📦 Installing FFmpeg</summary>

### Windows
```bash
# Using winget (recommended)
winget install Gyan.FFmpeg

# Or download from:
# https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
# Extract and add the bin/ folder to your system PATH
```

### macOS
```bash
brew install ffmpeg
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update && sudo apt install ffmpeg
```

</details>

---

## Quick Start — Local Development

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd yt-music-downloader
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Install Backend Dependencies

```bash
pip install -r api/requirements.txt
```

### 4. Start Both Servers

You need **two terminal windows** running simultaneously:

**Terminal 1 — Next.js Frontend** (port 3000):
```bash
npm run dev
```

**Terminal 2 — Python Backend** (port 5000):
```bash
python api/index.py
```

### 5. Open the App

Navigate to **[http://localhost:3000](http://localhost:3000)** in your browser.

> **Note:** The Next.js dev server proxies `/api/*` requests to `http://localhost:5000`, so both servers work together seamlessly.

---

## Cookie Authentication

YouTube requires authentication cookies to prevent bot detection. The app will show a **Cookie Status Banner** at the top of the page indicating whether valid cookies are present.

### Option A — Auto-Capture (Recommended)

1. Click the **"Auto-Capture"** button in the Cookie Status Banner
2. A sandboxed Chrome window will open pointing at YouTube Music
3. Sign in with your Google account
4. The window closes automatically once sign-in is detected
5. `api/cookies.txt` is exported and the banner turns green ✅

> **Requirements:** Google Chrome or Chromium must be installed. The Auto-Capture flow works only in **local development** mode — it cannot run on Vercel or other serverless hosts.

### Option B — Manual Export

1. Install the **[Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)** Chrome extension
2. Visit [youtube.com](https://youtube.com) while signed in
3. Click the extension icon → **Export** → save as `api/cookies.txt`

### Cookie Freshness

Cookies expire after ~14 days. The banner will warn you when cookies are stale (older than 14 days). Re-run Auto-Capture or re-export manually to refresh them.

> **Note on Chrome 127+:** Chrome's App-Bound Encryption (DPAPI) prevents external processes from reading cookies from your *main* Chrome profile. The Auto-Capture flow sidesteps this by launching a **fresh temporary profile** that is not protected by ABE.

---

## Vercel Deployment

### Limitations

> ⚠️ **Important:** Vercel serverless functions have execution time limits (10s free tier, 60s Pro). Full audio download + conversion will timeout on Vercel. For production use, consider self-hosting or using a server with no timeout limits.
>
> The **Cookie Auto-Capture** feature requires a local Chrome installation and **cannot run on Vercel**. Provide `cookies.txt` via environment secrets or another method if deploying to Vercel.

### Steps

1. Push the code to a GitHub repository
2. Import the repository on [Vercel](https://vercel.com/new)
3. Vercel will auto-detect the Next.js frontend and Python API
4. Deploy — the frontend will work, but download functionality is limited by serverless timeouts

### Configuration

The [`vercel.json`](vercel.json) is pre-configured to:
- Build the Next.js frontend with `@vercel/next`
- Build the Python API with `@vercel/python`
- Route `/api/*` requests to the Python handler

---

## API Reference

### `GET /api/status`
Health check endpoint.

**Response:**
```json
{
  "status": "online",
  "message": "Collector Pro backend is running.",
  "version": "2.1.0"
}
```

---

### `POST /api/fetch`
Extract track metadata from a YouTube URL without downloading.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response:**
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

**Error — auth required (401):**
```json
{
  "error": "YouTube requires authentication cookies...",
  "error_type": "auth_required"
}
```

---

### `POST /api/download`
Download and convert a single track to MP3.

**Request:**
```json
{
  "session_id": "uuid-from-fetch",
  "track_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "track_id": "dQw4w9WgXcQ"
}
```

**Response:**
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
Serve a completed MP3 file for browser download.

---

### `POST /api/cleanup`
Remove all temp files for a session.

**Request:**
```json
{
  "session_id": "uuid-from-fetch"
}
```

---

### `GET /api/cookies/status`
Return the current state of `cookies.txt` and any ongoing Auto-Capture.

**Response:**
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
|-------|------|-------------|
| `exists` | bool | Whether `api/cookies.txt` is present |
| `age_days` | float \| null | Age of the file in days (`null` if missing) |
| `fresh` | bool | `true` if age < 14 days |
| `capture.running` | bool | Whether an Auto-Capture is in progress |
| `capture.status` | string | `idle` \| `waiting_login` \| `success` \| `error` \| `timeout` |

---

### `POST /api/cookies/capture`
Start an asynchronous Cookie Auto-Capture flow. Launches Chrome and returns immediately. Poll `GET /api/cookies/status` to track progress.

**Response (started):**
```json
{
  "status": "started",
  "message": "Chrome is opening — please sign in to YouTube, then the window will close automatically."
}
```

**Response (already running — 409):**
```json
{
  "status": "already_running",
  "message": "A capture session is already in progress."
}
```

**Response (Chrome not found — 422):**
```json
{
  "error": "Google Chrome or Chromium was not found on this system...",
  "error_type": "chrome_not_found"
}
```

---

## File Structure

```
yt-music-downloader/
├── api/
│   ├── index.py              # Flask backend — download, convert, tag, cookie capture
│   ├── requirements.txt      # Python dependencies
│   └── cookies.txt           # Netscape-format YouTube auth cookies (auto-generated or manual)
├── app/
│   ├── components/
│   │   ├── CookieStatusBanner.tsx  # Cookie auth status + Auto-Capture trigger
│   │   ├── ThemeProvider.tsx       # next-themes wrapper
│   │   ├── ThemeToggle.tsx         # Dark/light toggle button
│   │   ├── LanguageSwitcher.tsx    # Language dropdown (EN/ZH/JA/MS)
│   │   ├── TrackCard.tsx           # Track display card with download button
│   │   └── ProgressLog.tsx         # Terminal-style activity log
│   ├── globals.css            # Design system & theme tokens
│   ├── layout.tsx             # Root layout with fonts & providers
│   └── page.tsx               # Main application page
├── messages/
│   ├── en.json                # English translations
│   ├── zh.json                # Chinese translations
│   ├── ja.json                # Japanese translations
│   └── ms.json                # Malay translations
├── .gitignore
├── next.config.ts             # Next.js config with API proxy rewrite
├── package.json
├── vercel.json                # Vercel deployment config
├── tsconfig.json
└── README.md                  # This file
```

---

## Supported Languages

| Code | Language | File |
|------|----------|------|
| `en` | English | [`messages/en.json`](messages/en.json) |
| `zh` | 中文 (Chinese) | [`messages/zh.json`](messages/zh.json) |
| `ja` | 日本語 (Japanese) | [`messages/ja.json`](messages/ja.json) |
| `ms` | Bahasa Melayu (Malay) | [`messages/ms.json`](messages/ms.json) |

Translations are loaded **client-side** at runtime — no build step required. To add a new language:

1. Create a new JSON file in `messages/` (e.g., `messages/ko.json`)
2. Copy the structure from `messages/en.json` and translate all values
3. Add the language entry to `LANGUAGES` in [`app/components/LanguageSwitcher.tsx`](app/components/LanguageSwitcher.tsx)
4. Import the JSON and register it in the `messageMap` in [`app/page.tsx`](app/page.tsx)

---

## Configuration

### Audio Output Defaults

| Setting | Value |
|---------|-------|
| Format | MP3 |
| Bitrate | 320 kbps |
| Sample Rate | 48,000 Hz |
| Channels | Stereo (2) |
| Metadata | ID3v2.3 |
| Filename | `Song_Name-Artist_Name.mp3` |
| Encoding | UTF-8 |

### yt-dlp Player Clients

The backend uses `android` and `tv_embedded` YouTube player clients (falling back to `web`) for both metadata fetching and audio downloading. The `ios` client is intentionally excluded because it requires a GVS PO Token (yt-dlp 2026+) and silently skips all formats without one, causing the *"Requested format is not available"* error.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Flask backend port |
| `FLASK_DEBUG` | `true` | Enable Flask debug mode |

---

## Troubleshooting

<details>
<summary>❌ FFmpeg not found</summary>

Ensure FFmpeg is installed and on your system PATH:
```bash
ffmpeg -version
```
If not found, follow the [FFmpeg installation instructions](#prerequisites) above.
</details>

<details>
<summary>❌ CORS errors in browser</summary>

The backend uses `flask-cors` to handle CORS. Ensure you're running the Flask server (`python api/index.py`) on port 5000 and the Next.js dev server proxies `/api/*` correctly via `next.config.ts`.
</details>

<details>
<summary>❌ Download times out on Vercel</summary>

Vercel serverless functions have a 10–60 second timeout. Audio downloading + conversion typically takes longer. Use **localhost mode** for actual downloads. Vercel deployment is best suited for the UI + metadata fetching only.
</details>

<details>
<summary>❌ YouTube bot detection / "Sign-in required" / auth_required error</summary>

YouTube blocks unauthenticated requests. The Cookie Status Banner in the app will indicate if cookies are missing or stale.

**Fix — Auto-Capture (local only):**
1. Click **"Auto-Capture"** in the banner
2. Sign into YouTube in the Chrome window that opens
3. The window closes automatically and `api/cookies.txt` is saved

**Fix — Manual export:**
1. Install the [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) extension
2. While signed into YouTube, click the extension → Export → save as `api/cookies.txt`

Cookies typically expire in ~14 days. The banner shows the age and freshness of the current cookie file.
</details>

<details>
<summary>❌ "Requested format is not available" error</summary>

This usually means yt-dlp selected the `ios` player client which requires a PO token. The backend is configured to use `android` + `tv_embedded` clients which don't need PO tokens. If you see this error:

1. Update yt-dlp: `pip install -U yt-dlp`
2. Check that your `cookies.txt` is present and fresh (less than 14 days old)
3. Try the Auto-Capture flow to refresh cookies
</details>

<details>
<summary>❌ Auto-Capture: Chrome not found</summary>

Chrome or Chromium must be installed for Auto-Capture to work. The backend searches common Windows paths. If Chrome is installed in a non-standard location, add it to your system PATH or export `cookies.txt` manually instead.
</details>

<details>
<summary>❌ Auto-Capture: cookie export produced an empty file</summary>

Chrome 127+ uses App-Bound Encryption (DPAPI) on your *main* profile's cookies. The Auto-Capture flow uses a **fresh temporary profile** to avoid this — but yt-dlp's `cookiesfrombrowser` extractor may still fail on some Windows configurations. In that case, fall back to the **manual export** method using the browser extension.
</details>

<details>
<summary>❌ Non-ASCII filenames not working</summary>

The backend normalizes all filenames to NFC Unicode form and sanitizes path-unsafe characters while preserving UTF-8 letters. If you encounter issues, ensure your filesystem supports UTF-8 (NTFS, ext4, APFS all do).
</details>

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

<p align="center">
  <strong>Built with ❤️ using Next.js, Flask, yt-dlp & FFmpeg</strong><br>
  <sub>320kbps · Stereo · 48kHz · Full Metadata · Cookie Auto-Capture</sub>
</p>
