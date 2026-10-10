#!/usr/bin/env bash
# Install (or uninstall) the Claude Usage plugin into OpenDeck.
#
#   ./install.sh              copy the plugin into OpenDeck
#   ./install.sh --link       symlink instead (for development: edits apply on restart)
#   ./install.sh --uninstall  remove it
#   ./install.sh --yes        don't ask before restarting OpenDeck
set -euo pipefail

UUID="dev.anakafeel.claudeusage.sdPlugin"
FLATPAK_ID="me.amankhanna.opendeck"
SRC="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)/$UUID"
MIN_NODE=22

mode=copy
assume_yes=0
for a in "$@"; do
  case "$a" in
    --link) mode=link ;;
    --uninstall) mode=uninstall ;;
    -y | --yes) assume_yes=1 ;;
    -h | --help) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $a (try --help)" >&2; exit 2 ;;
  esac
done

if [ -t 1 ]; then B=$'\e[1m' G=$'\e[32m' Y=$'\e[33m' R=$'\e[31m' N=$'\e[0m'; else B= G= Y= R= N=; fi
ok() { echo "${G}✓${N} $*"; }
warn() { echo "${Y}!${N} $*"; }
die() { echo "${R}✗${N} $*" >&2; exit 1; }

[ "$(uname -s)" = Linux ] || die "This plugin supports Linux only (OpenDeck). Detected: $(uname -s)."
[ -f "$SRC/manifest.json" ] || die "Can't find $SRC. Run this script from a clone of the repo."

# ---------- OpenDeck ----------
native=0 flatpak=0
command -v opendeck >/dev/null 2>&1 && native=1
command -v flatpak >/dev/null 2>&1 && flatpak info "$FLATPAK_ID" >/dev/null 2>&1 && flatpak=1

if [ $native = 1 ]; then
  PLUGINS="${XDG_CONFIG_HOME:-$HOME/.config}/opendeck/plugins"
  ok "OpenDeck found: $(command -v opendeck)"
elif [ $flatpak = 1 ]; then
  PLUGINS="$HOME/.var/app/$FLATPAK_ID/config/opendeck/plugins"
  ok "OpenDeck found (Flatpak $FLATPAK_ID)"
else
  die "OpenDeck is not installed. Get it from https://github.com/nekename/OpenDeck (AUR, .deb, .rpm, or Flathub: $FLATPAK_ID), then run this again."
fi
DEST="$PLUGINS/$UUID"

restart_opendeck() {
  pgrep -x opendeck >/dev/null 2>&1 || { echo "Start OpenDeck when you're ready."; return; }
  if [ $assume_yes = 0 ]; then
    if [ -t 0 ]; then
      read -r -p "OpenDeck is running. Restart it now to load the change? [y/N] " ans
      case "$ans" in y | Y | yes) ;; *) echo "Restart OpenDeck yourself to load the change."; return ;; esac
    else
      echo "Restart OpenDeck to load the change."; return
    fi
  fi
  if [ $flatpak = 1 ] && [ $native = 0 ]; then
    flatpak kill "$FLATPAK_ID" 2>/dev/null || true
    sleep 1
    setsid flatpak run "$FLATPAK_ID" >/dev/null 2>&1 < /dev/null &
  else
    pkill -x opendeck || true
    for _ in $(seq 20); do pgrep -x opendeck >/dev/null || break; sleep 0.25; done
    setsid opendeck >/dev/null 2>&1 < /dev/null &
  fi
  ok "OpenDeck restarted"
}

# ---------- uninstall ----------
if [ $mode = uninstall ]; then
  if [ -e "$DEST" ] || [ -L "$DEST" ]; then
    rm -rf "$DEST"
    ok "Removed $DEST"
    restart_opendeck
  else
    ok "Not installed; nothing to remove."
  fi
  exit 0
fi

# ---------- Node ----------
# Same search order as run.sh, which is what OpenDeck actually launches.
find_node() {
  local IFS=:
  local dirs="$HOME/.local/bin:$HOME/.volta/bin:/usr/local/bin:/usr/bin:$PATH"
  for d in "$HOME"/.nvm/versions/node/*/bin "$HOME"/.local/share/fnm/node-versions/*/installation/bin; do
    [ -d "$d" ] && dirs="$dirs:$d"
  done
  for d in $dirs; do
    [ -x "$d/node" ] || continue
    local major
    major="$("$d/node" -p 'process.versions.node.split(".")[0]' 2>/dev/null)" || continue
    if [ "$major" -ge $MIN_NODE ]; then echo "$d/node"; return 0; fi
  done
  return 1
}
if node_bin="$(find_node)"; then
  ok "Node $("$node_bin" -v) found: $node_bin"
else
  die "Node $MIN_NODE+ not found (needed for the built-in WebSocket). Install it with your package manager, nvm, fnm, or volta, then run this again."
fi
if [ $flatpak = 1 ] && [ $native = 0 ]; then
  case "$node_bin" in
    "$HOME"/*) warn "Flatpak OpenDeck can only see Node inside your home directory. $node_bin should work." ;;
    *) warn "Flatpak OpenDeck can't see $node_bin (outside your home directory). Install Node via nvm/fnm/volta, or use the native OpenDeck package." ;;
  esac
fi

# ---------- Claude login ----------
CRED="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.credentials.json"
if [ -f "$CRED" ]; then
  ok "Claude Code login found: $CRED"
else
  warn "No Claude Code login at $CRED. The key will show LOGIN until you sign in to Claude Code (run: claude)."
fi

# ---------- install ----------
mkdir -p "$PLUGINS"
if [ -e "$DEST" ] || [ -L "$DEST" ]; then
  rm -rf "$DEST"
  echo "Replacing existing install."
fi
if [ $mode = link ]; then
  ln -s "$SRC" "$DEST"
  ok "Linked $DEST -> $SRC"
else
  cp -r "$SRC" "$DEST"
  ok "Copied to $DEST"
fi
chmod +x "$DEST/run.sh"

restart_opendeck
echo
echo "${B}Next:${N} in OpenDeck, drag ${B}Claude → Usage Ring${N} onto a key."
echo "Tap the key to switch 5H / 7D. Hold it to refresh."
