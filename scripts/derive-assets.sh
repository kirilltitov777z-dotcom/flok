#!/usr/bin/env bash
# Rebuild every derived icon/splash from assets/icon.png, icon-foreground.png, splash.png.
# Requires ffmpeg and python3. Run after scripts/make_assets.py.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
A="$ROOT/assets"
FF="ffmpeg -y -v error"

scale() { # src dst w h
  $FF -i "$1" -vf "scale=$3:$4:flags=lanczos" -frames:v 1 "$2"
}

# ---------- web + desktop ----------
scale "$A/icon.png" "$ROOT/web/icon-512.png" 512 512
scale "$A/icon.png" "$ROOT/web/icon-192.png" 192 192
scale "$A/icon.png" "$ROOT/web/apple-touch-icon.png" 180 180
scale "$A/icon.png" "$ROOT/desktop/icon.png" 512 512

# ---------- android launcher icons ----------
for spec in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  d="${spec%%:*}"; s="${spec##*:}"
  res="$A/android/mipmap-$d"
  mkdir -p "$res"
  scale "$A/icon.png" "$res/ic_launcher.png" "$s" "$s"
  cp "$res/ic_launcher.png" "$res/ic_launcher_round.png"
  echo "launcher $d ${s}px"
done

# adaptive foreground: 108dp canvas, artwork already in the 66% safe zone
for spec in mdpi:108 hdpi:162 xhdpi:216 xxhdpi:324 xxxhdpi:432; do
  d="${spec%%:*}"; s="${spec##*:}"
  scale "$A/icon-foreground.png" "$A/android/mipmap-$d/ic_launcher_foreground.png" "$s" "$s"
  echo "foreground $d ${s}px"
done

# ---------- android splash ----------
scale "$A/splash.png" "$A/android/splash-port.png" 1080 1920
$FF -f lavfi -i "color=c=0x070a10:s=1920x1080" -i "$A/icon.png" \
  -filter_complex "[1:v]scale=520:520:flags=lanczos[ic];[0:v][ic]overlay=(W-w)/2:(H-h)/2" \
  -frames:v 1 "$A/android/splash-land.png"
echo "splash port 1080x1920, land 1920x1080"

# ---------- windows ico (classic 32-bpp BMP entries) ----------
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
for s in 16 24 32 48 64 128 256; do
  $FF -i "$A/icon.png" -vf "scale=$s:$s:flags=lanczos,format=bgra" -f rawvideo "$TMP/$s.bgra"
done
python3 "$ROOT/scripts/pack-ico.py" "$ROOT/desktop/icon.ico" "$TMP"
