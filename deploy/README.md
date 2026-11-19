# Deploying the TapeHermes backend

The backend (the repo root package) runs as one container, `tapehermes-api`, on an ARM64 Ubuntu server. Postgres and Redis are shared containers that already run on the Docker network `alpha`. Caddy on the host proxies `api.tapehermes.xyz` to `127.0.0.1:3006`.

Images (built for amd64 and arm64 by `.github/workflows/deploy-production.yml`):

- `ghcr.io/devfreeguy/tapehermes-api:<tag>` is the service.
- `ghcr.io/devfreeguy/tapehermes-migrator:<tag>` runs `prisma migrate deploy` and exits.

The tag is the full git commit hash. `latest` is not used.

## First-time server setup

Do these once, on the server.

1. Database: the database `tapehermes_db` and the user `tapehermes_user` exist in the shared Postgres. The user must own the database (migrations create tables).
2. Folder:
   ```
   sudo mkdir -p /opt/apps/tapehermes/scripts
   sudo chown -R <deploy-user>: /opt/apps/tapehermes
   ```
   `<deploy-user>` is the SSH user the pipeline uses. It must be able to run `docker`.
3. Settings: copy `deploy/.env.example` to `/opt/apps/tapehermes/.env`, replace every `CHANGE_ME`, then `chmod 600 /opt/apps/tapehermes/.env`.
   - Rules: no quotes, no inline comments, no empty `VAR=` lines (delete optional lines instead), no dollar sign in any value.
   - `VAULT_MASTER_KEY` is 32 random bytes in base64. It must never change after launch. Back it up somewhere safe and offline before the first deploy: it encrypts every stored secret and every site signing key, and if it is lost those cannot be recovered.
   - Do not set `UNSAFE_DEV_SKIP_DELEGATION`. The app refuses to start in production with it.
   - `AUTH_DOMAIN` and `CORS_ORIGINS` must match the dashboard address owners sign in from.
4. Caddy: `api.tapehermes.xyz` reverse proxies to `127.0.0.1:3006`. One proxy hop is trusted (`TRUST_PROXY_HOPS=1`), so Caddy must be the only proxy in front.
5. DNS: an `A` record `api` pointing at the server's public IP, and ports 80 and 443 open.
6. GitHub: in the repository settings add these secrets (a GitHub environment named `production` is used by the deploy job):
   - `SERVER_HOST`, `SERVER_USER`, `SERVER_KEY` (a private key that can log in as that user)
   - `GHCR_USER`, `GHCR_TOKEN` (a token with `read:packages`, used only on the server to pull images)
7. Service: `tapehermes.service` reads `/opt/apps/tapehermes/image.env` (written by the first successful deploy) and starts the compose file. The first deploy creates `image.env`.

Push to `main` (or run the workflow by hand). The pipeline verifies, builds, pushes, syncs `deploy/compose.yml` and `deploy/scripts/` to the server, and runs `deploy.sh`. It never copies `.env` or any secret to the server.

## What a deploy does

`scripts/deploy.sh` runs these steps in order and stops at the first failure:

1. Log in to ghcr.io, pull the api and migrator images, log out. A failed pull aborts.
2. Run the migrator: `docker run --rm --network alpha --env-file /opt/apps/tapehermes/.env <migrator image>`. If it fails, the running container is not touched.
3. Recreate `tapehermes-api` through compose.
4. Check `http://localhost:3006/health` (up to 30 tries, 3 seconds apart).
5. Only after the check passes: write `image.env` atomically (temp file in the same folder, `chmod 600`, `mv`) and run `docker image prune -f`.

If the health check fails, `image.env` is left as it was, and the script tries to put the previous image back. A restart of the service therefore always starts the last good image.

## Rollback

Redeploy an older tag. Open the workflow run of the commit you want back, or run on the server:

```
IMAGE_OWNER=devfreeguy REPO_NAME=tapehermes IMAGE_TAG=<older commit hash> \
GHCR_USER=<user> GHCR_TOKEN=<token> /opt/apps/tapehermes/scripts/deploy.sh
```

The older images must still exist in ghcr.io.

**`prisma migrate deploy` never reverses a migration.** Rolling back the image does not roll back the database. A migration that already ran stays applied, so an older image must still work with the newer schema. Write migrations so the previous version keeps working (add columns and tables first, remove things in a later release). If a migration has to be undone, that is a manual, reviewed SQL change, with a backup taken first.

## Checks

- Health: `curl -s http://localhost:3006/health` should answer `{"ok":true,"database":"up","redis":"up"}`. It answers 503 when either store is down.
- Logs: `docker logs --tail 100 tapehermes-api` (rotated, 5 files of 10 MB).
- Which tag is live: `cat /opt/apps/tapehermes/image.env`.

## Notes

- The container runs as a non-root user with a read-only root filesystem, no capabilities and `no-new-privileges`. This was tested with sign-in, health and database writes; the app writes no files.
- The pipeline trusts the server's SSH host key on first contact (`ssh-keyscan`). To pin it, store the expected key in a secret and write it to `known_hosts` instead.
- The Dockerfile is only for the backend. The dashboard, demo-site and helper are not part of the image.
