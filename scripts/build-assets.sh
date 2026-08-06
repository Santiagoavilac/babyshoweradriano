#!/usr/bin/env bash
# Genera los assets derivados del video original.
# Ejecutar una sola vez (o cuando cambies el video fuente).
set -euo pipefail

cd "$(dirname "$0")/.."

SRC="public/video/invitacion.webm"

if [ ! -f "$SRC" ]; then
  ORIGINAL=$(find public/video -name '*.webm' ! -name 'invitacion.webm' | head -1)
  if [ -z "$ORIGINAL" ]; then
    echo "No se encontró el video fuente en public/video/" >&2
    exit 1
  fi
  echo "Renombrando $ORIGINAL -> $SRC"
  mv "$ORIGINAL" "$SRC"
fi

# El fuente está en AV1, que no decodifica en la mayoría de iPhones.
# Este MP4 H.264 es el que realmente van a ver los invitados.
echo "Generando MP4 H.264..."
ffmpeg -y -v error -i "$SRC" \
  -c:v libx264 -profile:v high -level 4.0 -pix_fmt yuv420p \
  -crf 20 -preset slow -movflags +faststart -an \
  public/video/invitacion.mp4

echo "Generando poster..."
ffmpeg -y -v error -i "$SRC" -vframes 1 -q:v 3 public/video/poster.jpg

echo "Generando og.jpg (1200x630)..."
ffmpeg -y -v error -i "$SRC" -vframes 1 \
  -vf "scale=1200:630:force_original_aspect_ratio=decrease,pad=1200:630:(ow-iw)/2:(oh-ih)/2:color=black" \
  -q:v 3 public/og.jpg

echo
echo "Listo:"
ls -lh public/video/invitacion.mp4 public/video/poster.jpg public/og.jpg
