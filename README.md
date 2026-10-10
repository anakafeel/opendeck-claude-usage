# opendeck-claude-usage

Animated Stream Deck key that shows your Claude usage limits. Built for [OpenDeck](https://github.com/nekename/OpenDeck) on Linux; uses the standard Stream Deck plugin protocol.

![preview](docs/preview.png)

> **Unofficial.** Not made, endorsed, or supported by Anthropic. "Claude" is a trademark of Anthropic, PBC. This plugin reads an undocumented endpoint that Claude Code itself uses, so it can break without notice.

## What it shows

- A ring gauge for the **5-hour** or **7-day** limit, green → amber → red, with a glowing tip and an orbiting comet.
- The local time the limit resets, under the ring (`10:20P`, or `THU 7P` when it isn't today).
- **Meme mode:** from 90% a nervous sweating face takes over the centre and the key pulses red. At 100% it tells you to **touch grass** and shows when the limit resets.
- `STALE` when the login token has expired, a red dot when the last refresh failed.

Tap the key to switch 5H / 7D. Hold for 0.6 s to refresh now.

## Install

You need:

- Linux with [OpenDeck](https://github.com/nekename/OpenDeck) (native package or Flatpak)
- Node.js 22 or newer (for the built-in `WebSocket`)
- [Claude Code](https://docs.claude.com/en/docs/claude-code) signed in with a Claude subscription (Pro / Max)

```sh
git clone https://github.com/anakafeel/opendeck-claude-usage.git
cd opendeck-claude-usage
./install.sh
```

The script checks for OpenDeck, Node and your Claude Code login, copies the plugin into OpenDeck's plugin folder, and offers to restart OpenDeck. Then drag **Claude → Usage Ring** onto a key.

| Command | What it does |
| --- | --- |
| `./install.sh` | Copy the plugin into OpenDeck |
| `./install.sh --link` | Symlink instead, for hacking on it (restart OpenDeck to pick up edits) |
| `./install.sh --uninstall` | Remove it |
| `./install.sh --yes` | Restart OpenDeck without asking |

To update, `git pull` and run `./install.sh` again.

## Privacy

The plugin reads `~/.claude/.credentials.json` (or `$CLAUDE_CONFIG_DIR/.credentials.json`) and sends the access token only to `https://api.anthropic.com/api/oauth/usage`, every 90 s. It never refreshes the token, never writes the file, and sends nothing anywhere else. If the token expires, open Claude Code and it refreshes it itself.

## Troubleshooting

- **Key shows `LOGIN`:** no Claude Code login found. Run `claude` and sign in.
- **Key shows `STALE`:** the token expired. Use Claude Code once and it refreshes.
- **Key stays blank:** OpenDeck couldn't start the plugin, usually because Node 22+ isn't found. Check `~/.local/share/opendeck/logs/plugins/dev.anakafeel.claudeusage.sdPlugin.log`.
- **Flatpak OpenDeck:** the sandbox only sees Node installed inside your home directory (nvm, fnm, volta, or `~/.local/bin`).
- **macOS / Windows:** not supported. Claude Code stores the login in the system keychain there, not in a file.

## Preview without a deck

```sh
node dev.anakafeel.claudeusage.sdPlugin/plugin.js --preview /tmp/frames
```

Writes sample SVG frames (no network).

## License

[MIT](LICENSE) © Saim Hashmi
