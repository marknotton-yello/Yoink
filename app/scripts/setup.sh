#!/usr/bin/env bash
# Fetches the sidecar binaries Yoink ships inside its .app bundle.
#   scripts/setup.sh          → host architecture only
#   scripts/setup.sh --all    → arm64 + x86_64 + universal (for `tauri build --target universal-apple-darwin`)
# Skips anything that already exists.
set -euo pipefail

cd "$(dirname "$0")/.."
BIN=src-tauri/binaries
mkdir -p "$BIN"

YTDLP_URL="https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
FFMPEG_BASE="https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0"

ARM="aarch64-apple-darwin"
X64="x86_64-apple-darwin"
UNI="universal-apple-darwin"

if [[ "${1:-}" == "--all" ]]; then
  TRIPLES=("$ARM" "$X64" "$UNI")
else
  TRIPLES=("$(rustc -vV | sed -n 's/^host: //p')")
fi

# yt-dlp_macos is already a universal2 PyInstaller build, so one download
# serves every triple.
fetch_ytdlp() {
  local src="$BIN/.yt-dlp-universal2"
  if [[ ! -f "$src" ]]; then
    echo "→ downloading yt-dlp"
    curl -fL --progress-bar -o "$src" "$YTDLP_URL"
  fi
  for t in "$@"; do
    [[ -f "$BIN/yt-dlp-$t" ]] || { cp "$src" "$BIN/yt-dlp-$t"; chmod 755 "$BIN/yt-dlp-$t"; }
  done
}

fetch_ffmpeg() {
  local t="$1" asset
  case "$t" in
    "$ARM") asset="ffmpeg-darwin-arm64" ;;
    "$X64") asset="ffmpeg-darwin-x64" ;;
    *) return ;;
  esac
  [[ -f "$BIN/ffmpeg-$t" ]] && return
  echo "→ downloading static ffmpeg ($t)"
  curl -fL --progress-bar "$FFMPEG_BASE/$asset.gz" | gunzip > "$BIN/ffmpeg-$t"
  chmod 755 "$BIN/ffmpeg-$t"
}

fetch_ytdlp "${TRIPLES[@]}"
for t in "${TRIPLES[@]}"; do
  if [[ "$t" == "$UNI" ]]; then
    fetch_ffmpeg "$ARM"; fetch_ffmpeg "$X64"
    [[ -f "$BIN/ffmpeg-$UNI" ]] || lipo -create "$BIN/ffmpeg-$ARM" "$BIN/ffmpeg-$X64" -output "$BIN/ffmpeg-$UNI"
  else
    fetch_ffmpeg "$t"
  fi
done

# Sidecars must only link system libraries, or they break on a clean Mac.
for f in "$BIN"/*-apple-darwin; do
  bad=$(otool -L "$f" 2>/dev/null | awk '/^\t/ {print $1}' | grep -vE '^(/usr/lib/|/System/)' || true)
  [[ -n "$bad" ]] && echo "⚠ $f links non-system libraries:" && echo "$bad"
done
echo "✓ sidecars ready in $BIN"
