#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load the site environment first.
# Calling through bash avoids executable-permission issues on Vercel.
if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec bash "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

# Make sure GNU timeout exists.
if ! command -v timeout >/dev/null 2>&1; then
  echo "build-verified.sh requires GNU timeout." >&2
  exit 69
fi

vinext="${SITES_PROJECT_ROOT}/node_modules/.bin/vinext"

if [[ ! -f "${vinext}" ]]; then
  echo "vinext is unavailable. Dependencies may not have installed correctly." >&2
  exit 69
fi

echo "Running bounded vinext build..."

timeout \
  --signal=TERM \
  --kill-after="${SITES_BUILD_KILL_AFTER:-10s}" \
  "${SITES_BUILD_TIMEOUT:-3m}" \
  bash "${vinext}" build
