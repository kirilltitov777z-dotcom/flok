#!/usr/bin/env bash
# Apply Flok icons, splash and manifest tweaks to the generated Capacitor project.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AND="${1:-$ROOT/android}"
RES="$AND/app/src/main/res"

if [ ! -d "$RES" ]; then
  echo "Android res not found: $RES" >&2
  exit 1
fi

for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  if [ -d "$ROOT/assets/android/mipmap-$d" ]; then
    mkdir -p "$RES/mipmap-$d"
    cp "$ROOT/assets/android/mipmap-$d/"*.png "$RES/mipmap-$d/" || true
  fi
done

BG="$(find "$RES/values" -name 'ic_launcher_background.xml' 2>/dev/null | head -1 || true)"
if [ -n "$BG" ]; then
  sed -i 's|#[Ff][Ff][Ff][Ff][Ff][Ff]|#0B1116|g; s|#ffffff|#0B1116|g' "$BG" || true
fi

while IFS= read -r -d '' f; do
  case "$f" in
    *land*) cp "$ROOT/assets/android/splash-land.png" "$f" ;;
    *) cp "$ROOT/assets/android/splash-port.png" "$f" ;;
  esac
done < <(find "$RES" -name 'splash.png' -print0)

MAN="$AND/app/src/main/AndroidManifest.xml"
if [ -f "$MAN" ] && ! grep -q 'screenOrientation' "$MAN"; then
  sed -i 's|android:name=".MainActivity"|android:name=".MainActivity"\n            android:screenOrientation="portrait"|' "$MAN" || true
fi

STR="$RES/values/strings.xml"
if [ -f "$STR" ]; then
  sed -i 's|<string name="app_name">.*</string>|<string name="app_name">Flok</string>|' "$STR" || true
  sed -i 's|<string name="title_activity_main">.*</string>|<string name="title_activity_main">Flok</string>|' "$STR" || true
fi

echo "Flok branding applied to $AND"
