# opendeck-claude-usage

Animated Stream Deck key that shows your Claude usage limits. Built for [OpenDeck](https://github.com/nekename/OpenDeck) on Linux; uses the standard Stream Deck plugin protocol.

![preview](docs/preview.png)

## What it shows

- A ring gauge for the **5-hour** or **7-day** limit, green → amber → red, with a glowing tip and an orbiting comet.
- Reset countdown under the ring (`52M`, `2:14`, `3D4H`).
- **Meme mode:** from 90% a nervous sweating face takes over the centre and the key pulses red. At 100% it tells you to **touch grass** and counts down to the reset.
- `STALE` when the login token has expired, a red dot when the last refresh failed.

Tap the key to switch 5H / 7D. Hold for 0.6 s to refresh now.

## Read-only

The plugin reads `~/.claude/.credentials.json` (or `$CLAUDE_CONFIG_DIR/.credentials.json`) and calls only `https://api.anthropic.com/api/oauth/usage`, every 90 s. It never refreshes the token and never writes the file. If the token expires, open Claude Code and it refreshes it itself.

## Install

Needs Node 22+ (for the built-in `WebSocket`).

```sh
git clone git@github.com:anakafeel/opendeck-claude-usage.git
ln -s "$PWD/opendeck-claude-usage/dev.anakafeel.claudeusage.sdPlugin" ~/.config/opendeck/plugins/
```

Restart OpenDeck, then drag **Claude → Usage Ring** onto a key.

## Preview without a deck

```sh
node dev.anakafeel.claudeusage.sdPlugin/plugin.js --preview /tmp/frames
```

Writes sample SVG frames (no network).
