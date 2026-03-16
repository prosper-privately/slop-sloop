#!/usr/bin/env bash
set -euo pipefail

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

need_cmd npm
need_cmd npx

if [ ! -d "node_modules/playwright" ]; then
  echo "==> Installing npm dependencies (playwright module missing)"
  npm ci
else
  echo "Playwright npm module already installed."
fi

find_headless_shell() {
  find "${HOME}/.cache/ms-playwright" -type f -name 'chrome-headless-shell' 2>/dev/null | head -n 1 || true
}

browser_bin="$(find_headless_shell)"
needs_browser_install=false
needs_linux_deps=false

if [ -z "${browser_bin}" ]; then
  needs_browser_install=true
else
  echo "Playwright browser already installed at ${browser_bin}."
  if [ "$(uname -s)" = "Linux" ] && ldd "${browser_bin}" 2>/dev/null | grep -q 'not found'; then
    needs_linux_deps=true
  fi
fi

if [ "${needs_browser_install}" = true ] || [ "${needs_linux_deps}" = true ]; then
  if [ "$(uname -s)" = "Linux" ]; then
    echo "==> Installing Playwright Chromium with Linux dependencies"
    npx playwright install --with-deps chromium
  else
    echo "==> Installing Playwright Chromium"
    npx playwright install chromium
  fi
else
  echo "Playwright browser + dependencies look ready; skipping install."
fi
