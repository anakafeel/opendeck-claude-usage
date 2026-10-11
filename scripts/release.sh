#!/usr/bin/env bash
# Cut a release: bump the manifest version, tag, push, and publish a GitHub
# release with the plugin zip that OpenDeck's plugin store installs.
#
#   scripts/release.sh 1.1.0
set -euo pipefail

UUID="dev.anakafeel.claudeusage.sdPlugin"
root="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
cd "$root"

version="${1:-}"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "usage: scripts/release.sh X.Y.Z" >&2; exit 2; }
tag="v$version"

command -v gh >/dev/null || { echo "missing: gh (GitHub CLI)" >&2; exit 1; }
[ "$(git branch --show-current)" = main ] || { echo "switch to main first" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "working tree not clean; commit or stash first" >&2; exit 1; }
git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "main is not in sync with origin/main" >&2; exit 1; }
git rev-parse -q --verify "refs/tags/$tag" >/dev/null && { echo "tag $tag already exists" >&2; exit 1; }

current="$(node -p "require('./$UUID/manifest.json').Version")"
echo "Releasing $current -> $version"
read -r -p "Continue? [y/N] " ans
case "$ans" in y | Y | yes) ;; *) echo "aborted"; exit 1 ;; esac

# Bump the top-level version in place (not Nodejs.Version), keeping the formatting.
sed -i -E "s/^(  \"Version\": *\")[^\"]+(\")/\1$version\2/" "$UUID/manifest.json"
[ "$(node -p "require('./$UUID/manifest.json').Version")" = "$version" ] || { echo "failed to bump manifest version" >&2; exit 1; }
node --check "$UUID/plugin.js"

git commit -q -m "Release $tag" -- "$UUID/manifest.json"
git tag -a "$tag" -m "$tag"
git push -q origin main "$tag"

zip="$(mktemp -d)/$UUID.zip"
git archive --format=zip -o "$zip" "$tag" "$UUID"
gh release create "$tag" "$zip" --title "$tag" --generate-notes
echo "Published $tag. OpenDeck's plugin store picks it up from the latest release."
