#!/usr/bin/env bash
# OpenDeck launches this; find a Node >= 22 (needs global WebSocket).
export PATH="$HOME/.local/bin:$HOME/.volta/bin:/usr/local/bin:/usr/bin:$PATH"
for d in "$HOME"/.nvm/versions/node/*/bin "$HOME"/.local/share/fnm/node-versions/*/installation/bin; do [ -d "$d" ] && PATH="$PATH:$d"; done
plugin="$(dirname "$(readlink -f "$0")")/plugin.js"
IFS=:
for d in $PATH; do
  [ -x "$d/node" ] || continue
  major="$("$d/node" -p 'process.versions.node.split(".")[0]' 2>/dev/null)" || continue
  [ "$major" -ge 22 ] && exec "$d/node" "$plugin" "$@"
done
echo "claude-usage: Node 22+ not found" >&2
exit 1
