#!/usr/bin/env bash
# Regenerate docs/preview.png from the plugin's own --preview frames.
# Needs rsvg-convert (librsvg) and ImageMagick.
set -euo pipefail

root="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
for tool in node rsvg-convert magick; do
  command -v "$tool" >/dev/null || { echo "missing: $tool" >&2; exit 1; }
done

tmp="$(mktemp -d)"
trap 'rm -rf -- "$tmp"' EXIT

node "$root/dev.anakafeel.claudeusage.sdPlugin/plugin.js" --preview "$tmp"
frames=()
for name in mid high danger grass; do
  rsvg-convert -w 288 -h 288 "$tmp/$name.svg" -o "$tmp/$name.png"
  frames+=("$tmp/$name.png")
done
magick "${frames[@]}" +append "$root/docs/preview.png"
echo "wrote docs/preview.png"
