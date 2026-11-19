#!/usr/bin/env bash
# Deploy one image tag of the TapeHermes backend. Run on the server by the CI job (or by hand).
# Required environment: IMAGE_OWNER, REPO_NAME, IMAGE_TAG, GHCR_USER, GHCR_TOKEN.
# Order: pull both images, migrate, recreate the API, check /health, and ONLY THEN record the tag in image.env.
# A failed deploy leaves image.env untouched, so a restart of the service still brings back the last good image.
set -euo pipefail

: "${IMAGE_OWNER:?IMAGE_OWNER is required}"
: "${REPO_NAME:?REPO_NAME is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"
: "${GHCR_USER:?GHCR_USER is required}"
: "${GHCR_TOKEN:?GHCR_TOKEN is required}"

APP_DIR=/opt/apps/tapehermes
REGISTRY=ghcr.io
API_IMAGE="$REGISTRY/$IMAGE_OWNER/$REPO_NAME-api:$IMAGE_TAG"
MIGRATOR_IMAGE="$REGISTRY/$IMAGE_OWNER/$REPO_NAME-migrator:$IMAGE_TAG"
HEALTH_URL=http://localhost:3006/health
HEALTH_TRIES=30
HEALTH_WAIT=3

log() { printf '[deploy] %s\n' "$*"; }
fail() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

[ -f "$APP_DIR/.env" ] || fail "$APP_DIR/.env is missing (see deploy/README.md)"
[ -f "$APP_DIR/compose.yml" ] || fail "$APP_DIR/compose.yml is missing"

# Registry login only for the pulls: the token is read from stdin and the login is removed straight after (also on any failure).
logged_in=0
logout() { if [ "$logged_in" = 1 ]; then docker logout "$REGISTRY" >/dev/null 2>&1 || true; logged_in=0; fi; }
tmp=""
cleanup() { logout; if [ -n "$tmp" ]; then rm -f "$tmp"; fi; }
trap cleanup EXIT

# compose <tag> <compose args...>
compose() {
  IMAGE_OWNER="$IMAGE_OWNER" REPO_NAME="$REPO_NAME" IMAGE_TAG="$1" \
    docker compose -f "$APP_DIR/compose.yml" "${@:2}"
}

log "logging in to $REGISTRY"
printf '%s' "$GHCR_TOKEN" | docker login "$REGISTRY" -u "$GHCR_USER" --password-stdin >/dev/null
logged_in=1

log "pulling $API_IMAGE"
docker pull "$API_IMAGE" >/dev/null || fail "could not pull $API_IMAGE"
log "pulling $MIGRATOR_IMAGE"
docker pull "$MIGRATOR_IMAGE" >/dev/null || fail "could not pull $MIGRATOR_IMAGE"
logout

# The tag now running, if any, so a failed health check can put it back.
PREVIOUS_TAG=""
if [ -f "$APP_DIR/image.env" ]; then
  PREVIOUS_TAG="$(sed -n 's/^IMAGE_TAG=//p' "$APP_DIR/image.env" | head -n 1)"
fi

# Migrations first. If this fails nothing has been touched: the running container is still the old one.
# prisma migrate deploy only moves forward; it never reverses a migration.
log "running migrations"
docker run --rm --network alpha --env-file "$APP_DIR/.env" "$MIGRATOR_IMAGE" \
  || fail "migrations failed; the running container was not touched and image.env is unchanged"

log "recreating tapehermes-api with $IMAGE_TAG"
compose "$IMAGE_TAG" up -d --force-recreate --no-build --pull never tapehermes-api

healthy=0
for i in $(seq 1 "$HEALTH_TRIES"); do
  if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then healthy=1; break; fi
  log "waiting for /health ($i/$HEALTH_TRIES)"
  sleep "$HEALTH_WAIT"
done

if [ "$healthy" != 1 ]; then
  docker logs --tail 40 tapehermes-api >&2 || true
  if [ -n "$PREVIOUS_TAG" ] && [ "$PREVIOUS_TAG" != "$IMAGE_TAG" ]; then
    log "health check failed; putting back the previous image ($PREVIOUS_TAG)"
    compose "$PREVIOUS_TAG" up -d --force-recreate --no-build --pull never tapehermes-api || true
  fi
  fail "health check failed for $IMAGE_TAG; image.env was not changed"
fi

# Healthy: record the tag atomically (same directory, so mv is a rename), readable by the service user only.
log "health check passed; recording $IMAGE_TAG in image.env"
tmp="$(mktemp "$APP_DIR/.image.env.XXXXXX")"
printf 'IMAGE_OWNER=%s\nREPO_NAME=%s\nIMAGE_TAG=%s\n' "$IMAGE_OWNER" "$REPO_NAME" "$IMAGE_TAG" > "$tmp"
chmod 600 "$tmp"
mv -f "$tmp" "$APP_DIR/image.env"
tmp=""

docker image prune -f >/dev/null
log "done: $IMAGE_TAG is live"
