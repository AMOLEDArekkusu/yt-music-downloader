# -*- coding: utf-8 -*-
"""
Collector Pro — Python Backend API
YouTube Music to MP3 conversion with metadata tagging.
Designed for use with Flask on localhost or Vercel serverless functions.
"""

import os
import re
import uuid
import json
import shutil
import sqlite3
import subprocess
import tempfile
import threading
import time
import unicodedata
import logging

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ─── Configuration ────────────────────────────────────────────────────────────

# Base temp directory for all download sessions
TEMP_BASE = os.path.join(tempfile.gettempdir(), "yt_music_dl_sessions")
os.makedirs(TEMP_BASE, exist_ok=True)

# Default audio settings
DEFAULT_QUALITY = "320"  # kbps
DEFAULT_SAMPLE_RATE = "48000"  # Hz
DEFAULT_CHANNELS = "2"  # stereo

# Path to cookies.txt (Netscape format, written by auto-capture or manually exported).
COOKIES_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cookies.txt")

# How long to wait for the user to sign in before giving up (seconds).
CAPTURE_TIMEOUT_S = 300  # 5 minutes

# Common Chrome/Chromium executable paths on Windows.
CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    r"C:\Program Files\Chromium\Application\chrome.exe",
    r"C:\Program Files (x86)\Chromium\Application\chrome.exe",
    # Also check PATH
    shutil.which("google-chrome") or "",
    shutil.which("chromium") or "",
    shutil.which("chromium-browser") or "",
    shutil.which("chrome") or "",
]

# Global capture state (simple in-process flag for single-user local use).
_capture_state: dict = {"running": False, "status": "idle", "message": ""}
_capture_lock = threading.Lock()

logger = logging.getLogger(__name__)


# ─── Utilities ────────────────────────────────────────────────────────────────

def _normalize_yt_url(url: str) -> str:
    """
    Normalize YouTube Music URLs to standard YouTube equivalents.

    yt-dlp handles music.youtube.com natively, but normalising here ensures
    consistent behaviour for edge-cases (e.g. short-form music URLs):
      music.youtube.com/watch?v=xxx    →  youtube.com/watch?v=xxx
      music.youtube.com/playlist?list= →  youtube.com/playlist?list=

    All other URLs are returned unchanged.
    """
    return re.sub(
        r'https?://music\.youtube\.com/',
        'https://www.youtube.com/',
        url,
    )


def _get_cookie_opts() -> dict:
    """
    Return yt-dlp cookie options to bypass YouTube bot-detection.

    NOTE: Chrome/Edge 127+ uses App-Bound Encryption (DPAPI) which prevents
    any external process from reading browser cookies. Browser auto-extraction
    is therefore disabled. Only a manually exported cookies.txt is supported.

    To generate cookies.txt:
      1. Install the 'Get cookies.txt LOCALLY' Chrome/Edge extension
      2. Visit youtube.com while signed in
      3. Click the extension icon -> Export -> save as api/cookies.txt
    """
    if os.path.isfile(COOKIES_FILE):
        logger.info("Using cookies from file: %s", COOKIES_FILE)
        return {'cookiefile': COOKIES_FILE}

    logger.warning("No cookies.txt found at %s. YouTube may block requests.", COOKIES_FILE)
    return {}


def sanitize_filename(name: str) -> str:
    """
    Sanitize a filename for safe filesystem usage while preserving UTF-8 characters.
    Replaces path separators and control characters but keeps unicode letters/symbols.
    """
    if not name:
        return "Unknown"
    # Normalize unicode to NFC form for consistent representation
    name = unicodedata.normalize("NFC", name)
    # Remove control characters and path separators
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', name)
    # Replace multiple spaces/dots with single ones
    name = re.sub(r'\s+', ' ', name).strip()
    name = re.sub(r'\.{2,}', '.', name)
    # Ensure the name is not empty after sanitization
    if not name or name == '.':
        return "Unknown"
    return name


def format_output_filename(title: str, artist: str) -> str:
    """
    Format output filename as: Song Name - Artist Name.mp3
    Spaces are preserved in both song and artist names.
    UTF-8 characters are preserved.
    """
    safe_title = sanitize_filename(title)
    safe_artist = sanitize_filename(artist)
    if safe_artist and safe_artist != "Unknown":
        return f"{safe_title} - {safe_artist}.mp3"
    return f"{safe_title}.mp3"


def get_session_dir(session_id: str) -> str:
    """Get or create the temp directory for a session."""
    session_dir = os.path.join(TEMP_BASE, session_id)
    os.makedirs(session_dir, exist_ok=True)
    return session_dir


# ─── API Routes ───────────────────────────────────────────────────────────────

@app.route('/api/status', methods=['GET'])
def handle_status():
    """Health check endpoint."""
    return jsonify({
        'status': 'online',
        'message': 'Collector Pro backend is running.',
        'version': '2.1.0'
    })


@app.route('/api/fetch', methods=['POST'])
def handle_fetch():
    """
    Fetch track metadata from a YouTube URL (video or playlist).
    Does NOT download audio — only extracts metadata for the UI.
    """
    try:
        import yt_dlp
    except ImportError:
        return jsonify({'error': 'yt-dlp is not installed on the server.'}), 500

    data = request.json or {}
    url = data.get('url', '').strip()

    if not url:
        return jsonify({'error': 'URL is required.'}), 400

    # If no cookies file exists, return a structured auth_required error that the
    # frontend can surface with an actionable "Auto-Capture" button.
    if not os.path.isfile(COOKIES_FILE):
        return jsonify({
            'error': (
                'YouTube requires authentication cookies. '
                'Use the \'Auto-Capture\' button in the app to sign in automatically, '
                'or export cookies.txt manually using the \'Get cookies.txt LOCALLY\' extension.'
            ),
            'error_type': 'auth_required',
        }), 401

    session_id = str(uuid.uuid4())
    session_dir = get_session_dir(session_id)

    cookie_opts = _get_cookie_opts()

    # Capture yt-dlp error messages so we can surface them in the API response
    ydl_errors: list[str] = []

    class _YdlLogger:
        def debug(self, msg):   pass
        def info(self, msg):    pass
        def warning(self, msg): ydl_errors.append(msg)
        def error(self, msg):
            ydl_errors.append(msg)
            logger.error("[yt-dlp] %s", msg)

    # Normalize music.youtube.com → youtube.com so yt-dlp resolves correctly.
    url = _normalize_yt_url(url)

    # Player clients ordered by reliability (2026).
    # NOTE: 'ios' now requires a GVS PO Token (yt-dlp 2026+) and silently
    # skips all its formats when one isn't provided, leaving only storyboard
    # images — which causes the "Requested format is not available" error.
    # 'android' and 'tv_embedded' work without PO tokens.
    _fetch_player_clients = ['android', 'tv_embedded', 'web']

    _common_extractor_args = {
        'youtube': {
            'player_client': _fetch_player_clients,
        },
    }
    _common_headers = {
        'User-Agent': (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/124.0.0.0 Safari/537.36'
        ),
    }

    ydl_opts = {
        **cookie_opts,
        'logger': _YdlLogger(),
        # extract_flat=True: skip per-entry format resolution for playlists.
        'extract_flat': True,
        # no_check_formats + allow_unplayable_formats: do NOT validate whether
        # formats are actually streamable. This is the key fix for single-video
        # URLs — yt-dlp normally applies the format selector and raises
        # "Requested format is not available" even during a metadata-only call.
        # Since /api/fetch never downloads anything, format reachability is
        # irrelevant; we only need title / thumbnail / duration / artist.
        'no_check_formats': True,
        'allow_unplayable_formats': True,
        'ignoreerrors': False,
        'noplaylist': False,
        'skip_download': True,
        'simulate': True,
        'force_generic_extractor': False,
        # Use ios + web clients — ios client does not require Proof-of-Origin
        # (PO) tokens so avoids the "page needs to be reloaded" error introduced
        # by YouTube's bot detection in 2025/2026.
        'extractor_args': _common_extractor_args,
        'http_headers': _common_headers,
    }

    def _extract_info_robust(opts: dict, target_url: str) -> object:
        """Try to extract info; on format-unavailable errors retry with looser settings."""
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                return ydl.extract_info(target_url, download=False)
        except yt_dlp.utils.DownloadError as exc:
            err_str = str(exc)
            if 'requested format is not available' in err_str.lower():
                # Retry: drop the format selector entirely so yt-dlp doesn't
                # try to validate stream availability during metadata extraction.
                fallback_opts = {
                    **opts,
                    'format': None,
                    'no_check_formats': True,
                    'allow_unplayable_formats': True,
                    'simulate': False,
                    'listformats': False,
                }
                with yt_dlp.YoutubeDL(fallback_opts) as ydl2:
                    return ydl2.extract_info(target_url, download=False)
            raise

    try:
        info = _extract_info_robust(ydl_opts, url)

        if info is None:
            detail = ydl_errors[-1] if ydl_errors else 'Unknown error'
            # Detect the PO-token / bot-detection error (yt-dlp 2025+)
            if 'reload' in detail.lower() or 'po token' in detail.lower() or 'potoken' in detail.lower():
                return jsonify({
                    'error': (
                        'YouTube blocked the request (bot detection / PO token required). '
                        'Your cookies may be stale — please re-export cookies.txt using the '
                        '"Get cookies.txt LOCALLY" extension or use the Auto-Capture button.'
                    ),
                    'error_type': 'auth_required',
                }), 401
            return jsonify({'error': f'Could not extract info: {detail}'}), 400

        tracks = []
        entries = info.get('entries', None)

        if entries:
            # Playlist / album — entries are flat (minimal metadata) due to extract_flat=True
            for entry in entries:
                if entry is None:
                    continue
                vid_id = entry.get('id', str(uuid.uuid4()))
                # Synthesize thumbnail from video ID (avoids extra HTTP requests per entry)
                thumbnail = (
                    entry.get('thumbnail')
                    or f'https://i.ytimg.com/vi/{vid_id}/mqdefault.jpg'
                )
                # Reconstruct full URL if only a short url/id is present
                webpage_url = (
                    entry.get('webpage_url')
                    or entry.get('url')
                    or f'https://www.youtube.com/watch?v={vid_id}'
                )
                tracks.append({
                    'id': vid_id,
                    'title': entry.get('title', 'Unknown Title'),
                    'artist': entry.get('artist') or entry.get('uploader') or entry.get('channel', 'Unknown Artist'),
                    'duration': entry.get('duration', 0) or 0,
                    'thumbnail': thumbnail,
                    'url': webpage_url,
                })
        else:
            # Single video — flat metadata (format details not resolved; that happens in handle_download).
            vid_id = info.get('id', str(uuid.uuid4()))
            thumbnail = (
                info.get('thumbnail')
                or f'https://i.ytimg.com/vi/{vid_id}/mqdefault.jpg'
            )
            # With extract_flat=True, webpage_url may be absent for single videos.
            webpage_url = (
                info.get('webpage_url')
                or info.get('url')
                or (f'https://www.youtube.com/watch?v={vid_id}' if vid_id else url)
            )
            tracks.append({
                'id': vid_id,
                'title': info.get('title', 'Unknown Title'),
                'artist': info.get('artist') or info.get('uploader') or info.get('channel', 'Unknown Artist'),
                'duration': info.get('duration', 0) or 0,
                'thumbnail': thumbnail,
                'url': webpage_url,
            })

        return jsonify({
            'session_id': session_id,
            'tracks': tracks,
            'count': len(tracks),
        })


    except Exception as e:
        # Cleanup on error
        shutil.rmtree(session_dir, ignore_errors=True)
        err = str(e)
        _err_lower = err.lower()
        # Detect auth / bot-detection errors (including PO token / "page needs to be reloaded")
        if ('sign in' in err or 'bot' in _err_lower or 'cookies' in _err_lower
                or 'reload' in _err_lower or 'po token' in _err_lower or 'potoken' in _err_lower):
            return jsonify({
                'error': (
                    'YouTube blocked the request (authentication or bot detection). '
                    'Your cookies may be missing or stale. '
                    'Please re-export cookies.txt using the "Get cookies.txt LOCALLY" extension '
                    'or use the Auto-Capture button.'
                ),
                'error_type': 'auth_required',
            }), 401
        return jsonify({'error': err}), 500


def _cleanup_stale_files(session_dir: str, track_id: str):
    """Remove leftover .temp.* and partial files from a previous attempt."""
    if not os.path.isdir(session_dir):
        return
    prefix = track_id or 'track'
    for f in os.listdir(session_dir):
        # Remove .temp.mp3, .temp.webm, .part, etc. from previous runs
        if (f.startswith(prefix) and
                ('.temp.' in f or f.endswith('.part') or f.endswith('.ytdl'))):
            try:
                os.remove(os.path.join(session_dir, f))
            except OSError:
                pass


def _robust_move(src: str, dst: str, retries: int = 5, delay: float = 0.5):
    """
    Move/rename a file with retry logic for Windows file-locking issues.
    Windows antivirus and FFmpeg sometimes hold brief locks on newly created files.
    """
    import time
    import gc

    for attempt in range(retries):
        try:
            # Remove destination if it already exists
            if os.path.exists(dst):
                os.remove(dst)
            shutil.move(src, dst)
            return
        except PermissionError:
            if attempt < retries - 1:
                gc.collect()  # Release any Python-held file handles
                time.sleep(delay * (attempt + 1))
            else:
                raise


@app.route('/api/download', methods=['POST'])
def handle_download():
    """
    Download a single track, convert to MP3 (320kbps, stereo, 48kHz),
    embed ID3v2 metadata with thumbnail, and return the filename.
    """
    try:
        import yt_dlp
    except ImportError:
        return jsonify({'error': 'yt-dlp is not installed on the server.'}), 500

    data = request.json or {}
    session_id = data.get('session_id', '').strip()
    track_url = data.get('track_url', '').strip()
    track_id = data.get('track_id', '').strip()

    if not session_id or not track_url:
        return jsonify({'error': 'session_id and track_url are required.'}), 400

    session_dir = get_session_dir(session_id)

    # Clean up stale temp files from any previous failed attempt
    _cleanup_stale_files(session_dir, track_id)

    # Temporary output template — yt-dlp will replace %(ext)s
    raw_output = os.path.join(session_dir, f"{track_id or 'track'}_raw.%(ext)s")

    cookie_opts = _get_cookie_opts()

    ydl_opts = {
        **cookie_opts,
        'format': 'bestaudio/best',
        'postprocessors': [
            {
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': DEFAULT_QUALITY,
            },
            {
                'key': 'FFmpegMetadata',
                'add_chapters': True,
                'add_metadata': True,
            },
            {
                'key': 'EmbedThumbnail',
                'already_have_thumbnail': False,
            },
        ],
        'postprocessor_args': {
            'FFmpegExtractAudio': [
                '-ar', DEFAULT_SAMPLE_RATE,
                '-ac', DEFAULT_CHANNELS,
                '-id3v2_version', '3',
            ],
        },
        'outtmpl': raw_output,
        'writethumbnail': True,
        'updatetime': False,
        'overwrites': True,
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
        'ignoreerrors': False,
        # Use android + tv_embedded clients — ios now requires a GVS PO Token
        # (yt-dlp 2026+) and skips all its formats without one, causing
        # "Requested format is not available". android and tv_embedded work
        # reliably without PO tokens. Clients are tried in order; first wins.
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'tv_embedded', 'web'],
            },
        },
        'http_headers': {
            'User-Agent': (
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/124.0.0.0 Safari/537.36'
            ),
        },
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(track_url, download=True)

        if info is None:
            return jsonify({'error': 'Failed to download track.'}), 500

        title = info.get('title', 'Unknown Title')
        artist = (info.get('artist')
                  or info.get('uploader')
                  or info.get('channel')
                  or 'Unknown Artist')

        # Build the final filename: Song_Name-Artist_Name.mp3
        final_filename = format_output_filename(title, artist)
        final_path = os.path.join(session_dir, final_filename)

        # Find the downloaded MP3 file (yt-dlp names it with the raw template)
        raw_mp3 = os.path.join(session_dir, f"{track_id or 'track'}_raw.mp3")
        if not os.path.exists(raw_mp3):
            # Also check for .temp.mp3 — yt-dlp may have failed mid-rename
            temp_mp3 = os.path.join(session_dir, f"{track_id or 'track'}_raw.temp.mp3")
            if os.path.exists(temp_mp3):
                _robust_move(temp_mp3, raw_mp3)

        if not os.path.exists(raw_mp3):
            # Search for any mp3 in session dir matching the track_id pattern
            for f in os.listdir(session_dir):
                if f.endswith('.mp3') and (track_id in f or 'raw' in f):
                    raw_mp3 = os.path.join(session_dir, f)
                    break

        if not os.path.exists(raw_mp3):
            return jsonify({'error': 'MP3 file was not generated. FFmpeg may be missing.'}), 500

        # Rename to final format (with retry for Windows file locking)
        if raw_mp3 != final_path:
            _robust_move(raw_mp3, final_path)

        # Clean up leftover thumbnail files and other temp artifacts
        for f in os.listdir(session_dir):
            fpath = os.path.join(session_dir, f)
            if fpath != final_path and not f.endswith('.mp3'):
                try:
                    os.remove(fpath)
                except OSError:
                    pass

        # Try to enhance metadata with mutagen if available
        try:
            _tag_mp3(final_path, title, artist, info)
        except Exception:
            pass  # Non-critical — file still has yt-dlp embedded metadata

        return jsonify({
            'status': 'success',
            'filename': final_filename,
            'title': title,
            'artist': artist,
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _tag_mp3(filepath: str, title: str, artist: str, info: dict):
    """
    Enhance MP3 metadata using mutagen for reliable ID3v2 tagging.
    This supplements yt-dlp's built-in metadata embedding.
    """
    try:
        from mutagen.mp3 import MP3
        from mutagen.id3 import ID3, TIT2, TPE1, TALB, TDRC, TCON, TRCK, COMM
    except ImportError:
        return  # mutagen not available, skip enhancement

    try:
        audio = MP3(filepath, ID3=ID3)
    except Exception:
        return

    if audio.tags is None:
        audio.add_tags()

    tags = audio.tags

    # Title
    tags.setall('TIT2', [TIT2(encoding=1, text=[title])])
    # Artist
    tags.setall('TPE1', [TPE1(encoding=1, text=[artist])])
    # Album (use playlist title or single track title)
    album = info.get('album') or info.get('playlist_title') or title
    tags.setall('TALB', [TALB(encoding=1, text=[album])])
    # Year
    upload_date = info.get('upload_date', '')
    if upload_date and len(upload_date) >= 4:
        tags.setall('TDRC', [TDRC(encoding=1, text=[upload_date[:4]])])
    # Genre
    genre = info.get('genre', '')
    if genre:
        tags.setall('TCON', [TCON(encoding=1, text=[genre])])
    # Track number
    track_number = info.get('playlist_index')
    if track_number:
        tags.setall('TRCK', [TRCK(encoding=1, text=[str(track_number)])])
    # Comment — source URL
    url = info.get('webpage_url', '')
    if url:
        tags.setall('COMM', [COMM(encoding=1, lang='eng', desc='Source', text=[url])])

    audio.save(v2_version=3)


@app.route('/api/download/<session_id>/<filename>', methods=['GET'])
def serve_file(session_id: str, filename: str):
    """Serve a downloaded MP3 file for browser download."""
    session_dir = get_session_dir(session_id)
    filepath = os.path.join(session_dir, filename)

    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found.'}), 404

    # Ensure the path doesn't escape the session directory (security check)
    real_session = os.path.realpath(session_dir)
    real_file = os.path.realpath(filepath)
    if not real_file.startswith(real_session):
        return jsonify({'error': 'Access denied.'}), 403

    return send_file(
        filepath,
        mimetype='audio/mpeg',
        as_attachment=True,
        download_name=filename,
    )


@app.route('/api/cleanup', methods=['POST'])
def handle_cleanup():
    """Delete all temp files for a given session."""
    data = request.json or {}
    session_id = data.get('session_id', '').strip()

    if not session_id:
        return jsonify({'error': 'session_id is required.'}), 400

    session_dir = os.path.join(TEMP_BASE, session_id)

    # Security: ensure session_id is a valid UUID (no path traversal)
    try:
        uuid.UUID(session_id)
    except ValueError:
        return jsonify({'error': 'Invalid session_id.'}), 400

    if os.path.exists(session_dir):
        shutil.rmtree(session_dir, ignore_errors=True)

    return jsonify({
        'status': 'success',
        'message': 'Session cleaned up successfully.',
    })


# ─── Cookie Auto-Capture Routes ───────────────────────────────────────────────

def _find_chrome() -> str | None:
    """Return the first Chrome/Chromium executable found on the system."""
    for path in CHROME_PATHS:
        if path and os.path.isfile(path):
            return path
    return None


def _poll_for_login(cookies_db_path: str, timeout: float) -> bool:
    """
    Poll Chrome's SQLite Cookies DB for a YouTube login cookie.
    Returns True when a valid login is detected, False on timeout.

    We look for the presence of the 'LOGIN_INFO' cookie on .youtube.com —
    this cookie is only set when the user is actively signed in.
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            if os.path.isfile(cookies_db_path):
                # Copy the DB first — Chrome may have a lock on it.
                tmp_db = cookies_db_path + ".poll_copy"
                shutil.copy2(cookies_db_path, tmp_db)
                try:
                    conn = sqlite3.connect(tmp_db)
                    cur = conn.execute(
                        "SELECT name FROM cookies "
                        "WHERE (host_key LIKE '%youtube.com' OR host_key LIKE '%music.youtube.com') "
                        "  AND name IN ('LOGIN_INFO', 'SID', 'HSID', 'SSID', '__Secure-3PSID') "
                        "LIMIT 1"
                    )
                    row = cur.fetchone()
                    conn.close()
                    if row:
                        return True
                finally:
                    try:
                        os.remove(tmp_db)
                    except OSError:
                        pass
        except Exception:
            pass  # DB not ready yet — keep polling
        time.sleep(3)
    return False


def _run_capture(chrome_exe: str):
    """
    Background thread: launch a throwaway Chrome profile, wait for YouTube login,
    export cookies.txt via yt-dlp, then clean up.
    """
    global _capture_state
    tmp_profile = tempfile.mkdtemp(prefix="yt_dl_chrome_")
    chrome_proc = None

    try:
        with _capture_lock:
            _capture_state = {"running": True, "status": "waiting_login", "message": "Opening YouTube login…"}

        # Launch Chrome with a fresh profile pointing at YouTube Music.
        # Opening music.youtube.com directly sets both youtube.com and
        # music.youtube.com cookies in one sign-in, which is what yt-dlp needs.
        chrome_args = [
            chrome_exe,
            f"--user-data-dir={tmp_profile}",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-sync",
            "--disable-extensions",
            "--disable-background-networking",
            "--disable-client-side-phishing-detection",
            "--disable-default-apps",
            "--window-size=900,700",
            "--window-position=200,100",
            "https://music.youtube.com",
        ]
        chrome_proc = subprocess.Popen(
            chrome_args,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        logger.info("[cookie-capture] Chrome launched (PID %d), profile: %s", chrome_proc.pid, tmp_profile)

        # Chrome writes its Cookies DB here (Windows path inside the profile).
        cookies_db = os.path.join(tmp_profile, "Default", "Cookies")

        # Poll until login detected or timeout.
        detected = _poll_for_login(cookies_db, CAPTURE_TIMEOUT_S)

        if not detected:
            with _capture_lock:
                _capture_state = {"running": False, "status": "timeout",
                                  "message": "Timed out waiting for YouTube sign-in."}
            logger.warning("[cookie-capture] Timed out — no login detected.")
            return

        with _capture_lock:
            _capture_state["message"] = "Sign-in detected — exporting cookies…"

        logger.info("[cookie-capture] Login detected, exporting cookies.txt via yt-dlp…")

        # Give Chrome a moment to flush the Cookies DB.
        time.sleep(2)

        # Use yt-dlp to export a proper Netscape cookies.txt from the temp profile.
        try:
            import yt_dlp
            with yt_dlp.YoutubeDL({
                'cookiesfrombrowser': ('chromium', tmp_profile, None, None),
                'cookiefile': COOKIES_FILE,
                'skip_download': True,
                'quiet': True,
                'no_warnings': True,
                'extract_flat': True,
            }) as ydl:
                # Extracting info forces cookie export; URL doesn't need to succeed.
                try:
                    # Fetch from YouTube Music so cookies for both
                    # music.youtube.com and youtube.com are captured.
                    ydl.extract_info('https://music.youtube.com', download=False)
                except Exception:
                    pass  # We just need the cookie export side-effect.
        except Exception as e:
            logger.error("[cookie-capture] yt-dlp cookie export failed: %s", e)
            # Fallback: manually write a minimal Netscape file from the SQLite DB.
            _manual_export_cookies(cookies_db)

        if os.path.isfile(COOKIES_FILE) and os.path.getsize(COOKIES_FILE) > 100:
            with _capture_lock:
                _capture_state = {"running": False, "status": "success",
                                  "message": "Cookies saved successfully!"}
            logger.info("[cookie-capture] cookies.txt written: %s", COOKIES_FILE)
        else:
            with _capture_lock:
                _capture_state = {"running": False, "status": "error",
                                  "message": "Cookie export produced an empty file."}

    except Exception as e:
        logger.exception("[cookie-capture] Unexpected error: %s", e)
        with _capture_lock:
            _capture_state = {"running": False, "status": "error", "message": str(e)}
    finally:
        # Always terminate Chrome and clean up the temp profile.
        if chrome_proc and chrome_proc.poll() is None:
            try:
                chrome_proc.terminate()
                chrome_proc.wait(timeout=5)
            except Exception:
                try:
                    chrome_proc.kill()
                except Exception:
                    pass
        shutil.rmtree(tmp_profile, ignore_errors=True)
        logger.info("[cookie-capture] Temp profile removed.")


def _manual_export_cookies(cookies_db: str):
    """
    Fallback: read unencrypted cookies from the temp profile's SQLite DB
    and write a Netscape-format cookies.txt.

    NOTE: Cookies stored by Chrome 127+ in a *temporary profile* that was
    just created for this session may not be encrypted with ABE (the profile
    is brand-new and ABE only protects cookies written by a Chrome instance
    that owns DPAPI keys). This fallback handles that case.
    """
    try:
        tmp_db = cookies_db + ".export_copy"
        shutil.copy2(cookies_db, tmp_db)
        conn = sqlite3.connect(tmp_db)
        rows = conn.execute(
            "SELECT host_key, path, is_secure, expires_utc, name, value "
            "FROM cookies "
            "WHERE host_key LIKE '%youtube.com' "
            "   OR host_key LIKE '%music.youtube.com' "
            "   OR host_key LIKE '%google.com'"
        ).fetchall()
        conn.close()
        os.remove(tmp_db)

        with open(COOKIES_FILE, 'w', encoding='utf-8') as f:
            f.write("# Netscape HTTP Cookie File\n")
            f.write("# Auto-generated by Collector Pro cookie capture\n")
            for host, path, secure, exp_utc, name, value in rows:
                # Chrome stores expiry as microseconds since 1601-01-01.
                # Convert to Unix timestamp (seconds since 1970-01-01).
                exp_unix = max(0, (exp_utc - 11644473600_000_000) // 1_000_000) if exp_utc else 0
                include_subdomains = "TRUE" if host.startswith(".") else "FALSE"
                secure_str = "TRUE" if secure else "FALSE"
                f.write(f"{host}\t{include_subdomains}\t{path}\t{secure_str}\t{exp_unix}\t{name}\t{value}\n")

        logger.info("[cookie-capture] Manual export wrote %d cookies.", len(rows))
    except Exception as e:
        logger.error("[cookie-capture] Manual export failed: %s", e)


@app.route('/api/cookies/status', methods=['GET'])
def handle_cookies_status():
    """
    Return the current state of cookies.txt and any ongoing capture.
    Response fields:
      - exists      : bool — whether cookies.txt is present
      - age_days    : float | None — age of the file in days (None if missing)
      - fresh       : bool — True if age < 14 days
      - capture     : object — current capture state {running, status, message}
    """
    exists = os.path.isfile(COOKIES_FILE)
    age_days = None
    fresh = False

    if exists:
        mtime = os.path.getmtime(COOKIES_FILE)
        age_days = round((time.time() - mtime) / 86400, 1)
        fresh = age_days < 14

    with _capture_lock:
        capture = dict(_capture_state)

    return jsonify({
        'exists': exists,
        'age_days': age_days,
        'fresh': fresh,
        'capture': capture,
    })


@app.route('/api/cookies/capture', methods=['POST'])
def handle_cookies_capture():
    """
    Start an asynchronous cookie capture flow.
    Launches Chrome with a temporary profile and returns immediately;
    the client should poll GET /api/cookies/status to track progress.
    """
    with _capture_lock:
        if _capture_state.get('running'):
            return jsonify({
                'status': 'already_running',
                'message': 'A capture session is already in progress.',
            }), 409

    chrome_exe = _find_chrome()
    if not chrome_exe:
        return jsonify({
            'error': (
                'Google Chrome or Chromium was not found on this system. '
                'Please install Chrome and try again, or export cookies.txt manually.'
            ),
            'error_type': 'chrome_not_found',
        }), 422

    # Launch the capture in a background daemon thread so Flask can return immediately.
    t = threading.Thread(target=_run_capture, args=(chrome_exe,), daemon=True)
    t.start()

    return jsonify({
        'status': 'started',
        'message': 'Chrome is opening — please sign in to YouTube, then the window will close automatically.',
    })


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
