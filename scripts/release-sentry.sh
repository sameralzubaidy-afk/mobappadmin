#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

RELEASE=${RELEASE:-$(git rev-parse --short HEAD)}
export RELEASE

if [ -z "${SENTRY_AUTH_TOKEN:-}" ]; then
  echo "SENTRY_AUTH_TOKEN is not set. Please export SENTRY_AUTH_TOKEN in your environment." >&2
  exit 1
fi

echo "Creating Sentry release $RELEASE for admin..."
npx sentry-cli releases -o ${SENTRY_ORG:-} -p ${SENTRY_PROJECT_ADMIN:-} new $RELEASE
echo "Uploading sourcemaps..."
npx sentry-cli releases -o ${SENTRY_ORG:-} -p ${SENTRY_PROJECT_ADMIN:-} files $RELEASE upload-sourcemaps .next --rewrite --url-prefix ~/_next
npx sentry-cli releases -o ${SENTRY_ORG:-} -p ${SENTRY_PROJECT_ADMIN:-} finalize $RELEASE

echo "Sentry release $RELEASE created for admin."
