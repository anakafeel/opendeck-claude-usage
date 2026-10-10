#!/usr/bin/env bash
# OpenDeck launches this; find a Node >= 22 (needs global WebSocket).
export PATH="$HOME/.local/bin:$HOME/.volta/bin:/usr/local/bin:/usr/bin:$PATH"
for d in "$HOME"/.nvm/versions/node/*/bin; do [ -d "$d" ] && PATH="$PATH:$d"; done
exec node "$(dirname "$(readlink -f "$0")")/plugin.js" "$@"
