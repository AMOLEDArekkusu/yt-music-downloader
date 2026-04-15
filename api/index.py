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
import tempfile
import unicodedata

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


# ─── Utilities ────────────────────────────────────────────────────────────────

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
    Format output filename as: Song_Name-Artist_Name.mp3
    Spaces in song/artist names are replaced with underscores.
    UTF-8 characters are preserved.
    """
    safe_title = sanitize_filename(title).replace(' ', '_')
    safe_artist = sanitize_filename(artist).replace(' ', '_')
    if safe_artist and safe_artist != "Unknown":
        return f"{safe_title}-{safe_artist}.mp3"
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

    session_id = str(uuid.uuid4())
    session_dir = get_session_dir(session_id)

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'ignoreerrors': True,
        'noplaylist': False,
        'skip_download': True,
        'force_generic_extractor': False,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        if info is None:
            return jsonify({'error': 'Could not extract info from this URL.'}), 400

        tracks = []
        entries = info.get('entries', None)

        if entries:
            # It's a playlist / album
            for entry in entries:
                if entry is None:
                    continue
                tracks.append({
                    'id': entry.get('id', str(uuid.uuid4())),
                    'title': entry.get('title', 'Unknown Title'),
                    'artist': entry.get('artist') or entry.get('uploader') or entry.get('channel', 'Unknown Artist'),
                    'duration': entry.get('duration', 0) or 0,
                    'thumbnail': entry.get('thumbnail', ''),
                    'url': entry.get('webpage_url') or entry.get('url', ''),
                })
        else:
            # Single video
            tracks.append({
                'id': info.get('id', str(uuid.uuid4())),
                'title': info.get('title', 'Unknown Title'),
                'artist': info.get('artist') or info.get('uploader') or info.get('channel', 'Unknown Artist'),
                'duration': info.get('duration', 0) or 0,
                'thumbnail': info.get('thumbnail', ''),
                'url': info.get('webpage_url') or url,
            })

        return jsonify({
            'session_id': session_id,
            'tracks': tracks,
            'count': len(tracks),
        })

    except Exception as e:
        # Cleanup on error
        shutil.rmtree(session_dir, ignore_errors=True)
        return jsonify({'error': str(e)}), 500


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

    # Temporary output template — yt-dlp will replace %(ext)s
    raw_output = os.path.join(session_dir, f"{track_id or 'track'}_raw.%(ext)s")

    ydl_opts = {
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
                '-write_id3v1', '1',
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
            # Search for any mp3 in session dir matching the track_id pattern
            for f in os.listdir(session_dir):
                if f.endswith('.mp3') and (track_id in f or 'raw' in f):
                    raw_mp3 = os.path.join(session_dir, f)
                    break

        if not os.path.exists(raw_mp3):
            return jsonify({'error': 'MP3 file was not generated. FFmpeg may be missing.'}), 500

        # Rename to final format
        if raw_mp3 != final_path:
            shutil.move(raw_mp3, final_path)

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
    tags.setall('TIT2', [TIT2(encoding=3, text=[title])])
    # Artist
    tags.setall('TPE1', [TPE1(encoding=3, text=[artist])])
    # Album (use playlist title or single track title)
    album = info.get('album') or info.get('playlist_title') or title
    tags.setall('TALB', [TALB(encoding=3, text=[album])])
    # Year
    upload_date = info.get('upload_date', '')
    if upload_date and len(upload_date) >= 4:
        tags.setall('TDRC', [TDRC(encoding=3, text=[upload_date[:4]])])
    # Genre
    genre = info.get('genre', '')
    if genre:
        tags.setall('TCON', [TCON(encoding=3, text=[genre])])
    # Track number
    track_number = info.get('playlist_index')
    if track_number:
        tags.setall('TRCK', [TRCK(encoding=3, text=[str(track_number)])])
    # Comment — source URL
    url = info.get('webpage_url', '')
    if url:
        tags.setall('COMM', [COMM(encoding=3, lang='eng', desc='Source', text=[url])])

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


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
