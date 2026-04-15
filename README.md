# 🎵 Collector Pro — YouTube Music Downloader (Web)

> **A modern, full-stack web application for downloading YouTube Music to high-quality MP3 with full metadata tagging.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.9+-blue?logo=python)](https://python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0-green?logo=flask)](https://flask.palletsprojects.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start — Local Development](#quick-start--local-development)
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

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Next.js Frontend                      │
│                                                          │
│   React 19  ·  Tailwind CSS 4  ·  next-themes (dark)    │
│   Multilingual UI (EN · ZH · JA · MS)                   │
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
| Backend API | Flask + yt-dlp + mutagen | [`api/index.py`](api/index.py) |
| Translations | JSON message files | [`messages/`](messages/) |

---

## Features

### 🎨 Frontend
- **Modern UI** with glassmorphism cards and micro-animations
- **Dark / Light theme** toggle with smooth transitions
- **Multilingual support** — English, Chinese, Japanese, Malay
- **Responsive design** — works on desktop and mobile
- **Real-time progress log** with terminal-style interface
- **Track preview** — see title, artist, duration, and thumbnail before downloading

### 🔧 Backend
- **YouTube URL support** — single videos, playlists, albums, YouTube Music
- **High-quality audio** — 320kbps MP3, stereo, 48kHz sampling
- **Full metadata tagging** — ID3v2 with title, artist, album, year, genre, artwork
- **UTF-8 filenames** — supports all languages (CJK, Cyrillic, Arabic, etc.)
- **Output format** — `Song_Name-Artist_Name.mp3`
- **Session management** — temp files cleaned up after download completes
- **Security** — UUID-based sessions with path traversal protection

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

> **Note:** The Next.js dev server is configured to proxy `/api/*` requests to `http://localhost:5000`, so both servers work together seamlessly.

---

## Vercel Deployment

### Limitations

> ⚠️ **Important:** Vercel serverless functions have execution time limits (10s free tier, 60s Pro). Full audio download + conversion will timeout on Vercel. For production use, consider self-hosting or using a server with no timeout limits.

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

## File Structure

```
yt-music-downloader/
├── api/
│   ├── index.py              # Flask backend — download, convert, tag
│   └── requirements.txt      # Python dependencies
├── app/
│   ├── components/
│   │   ├── ThemeProvider.tsx   # next-themes wrapper
│   │   ├── ThemeToggle.tsx    # Dark/light toggle
│   │   ├── LanguageSwitcher.tsx # Language dropdown
│   │   ├── TrackCard.tsx      # Track display card
│   │   └── ProgressLog.tsx    # Terminal-style log viewer
│   ├── globals.css            # Design system & theme tokens
│   ├── layout.tsx             # Root layout with fonts & providers
│   └── page.tsx               # Main application page
├── i18n/
│   └── request.ts             # next-intl configuration
├── messages/
│   ├── en.json                # English translations
│   ├── zh.json                # Chinese translations
│   ├── ja.json                # Japanese translations
│   └── ms.json                # Malay translations
├── .gitignore
├── next.config.ts             # Next.js config with API proxy
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

To add a new language:
1. Create a new JSON file in `messages/` (e.g., `messages/ko.json`)
2. Copy the structure from `messages/en.json` and translate all values
3. Add the language entry to `LANGUAGES` in [`app/components/LanguageSwitcher.tsx`](app/components/LanguageSwitcher.tsx)

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

The backend uses `flask-cors` to handle CORS. Ensure you're running the Flask server (`python api/index.py`) on port 5000 and the Next.js dev server proxies `/api/*` correctly.
</details>

<details>
<summary>❌ Download times out on Vercel</summary>

Vercel serverless functions have a 10-60 second timeout. Audio downloading + conversion typically takes longer. Use **localhost mode** for actual downloads. Vercel deployment is best suited for the UI + metadata fetching only.
</details>

<details>
<summary>❌ YouTube bot detection / Sign-in required</summary>

If YouTube blocks requests, you may need to provide authentication cookies. This is a known limitation of yt-dlp on servers without logged-in browser sessions.
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
  <sub>320kbps · Stereo · 48kHz · Full Metadata</sub>
</p>
