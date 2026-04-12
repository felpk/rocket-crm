# CI/CD & Deployment — .github/

GitHub Actions workflows for automated deployment.

## Workflows

### deploy-dev.yml (Dev Environment)
- **Trigger**: Push to `develop`, `fix/*`, or `feature/*` branches.
- **Action**: SSH into VPS, checkout branch, `docker build`, `docker service update --force`.
- **URL**: https://dev.rocket.avancesbr.com
- **Docker service**: `rocket_rocket-crm-dev`

### deploy-prod.yml (Production)
- **Trigger**: Push to `main` branch.
- **Action**: Same SSH deploy pattern.
- **URL**: https://rocket.avancesbr.com
- **Docker service**: `rocket_rocket-crm`

## GitHub Secrets Required
| Secret | Description |
|--------|-------------|
| `VPS_HOST` | Server IP or hostname |
| `VPS_USER` | SSH username |
| `VPS_SSH_KEY` | Private SSH key for deployment |

## Deployment Flow
1. Push to branch triggers GitHub Actions.
2. Action SSHs into VPS at `/opt/rocket/rocket-crm`.
3. `git fetch` + `git checkout` + `git pull` to update code.
4. `docker build -t rocket-crm-dev:latest .` (or `rocket-crm:latest` for prod).
5. `docker service update --force` restarts the Docker Swarm service.
6. Container startup: runs Prisma migrations, then starts Next.js.

## Docker Architecture

### Dockerfile (Multi-stage)
4 stages for optimized image:

1. **base**: `node:22-alpine` — shared base image.
2. **deps**: Installs all npm dependencies (includes native build tools: python3, make, g++).
3. **prisma-deps**: Isolated `npm ci` to get Prisma CLI + all transitive deps for runtime migrations.
4. **builder**: Copies deps, generates Prisma client, builds Next.js (standalone output).
5. **runner**: Minimal runtime image:
   - Copies Next.js standalone build.
   - Copies Prisma schema + generated client.
   - Merges prisma-deps into node_modules (without overwriting standalone deps like better-sqlite3).
   - Runs as non-root user `nextjs` (UID 1001).
   - Startup: `prisma migrate deploy` then `node server.js`.

### Docker Swarm Services
| Service | Image | Port |
|---------|-------|------|
| `rocket_rocket-crm-dev` | `rocket-crm-dev:latest` | 3000 |
| `rocket_rocket-crm` | `rocket-crm:latest` | 3000 |

### Volumes & Data
- SQLite database stored at `/app/data/dev.db` inside the container.
- Data directory `/app/data` owned by `nextjs` user.
- Next.js cache at `/app/.next/cache`.

### Troubleshooting
```bash
# Check service status
docker service ls | grep rocket
docker service ps rocket_rocket-crm-dev --no-trunc

# View logs
docker service logs rocket_rocket-crm-dev --tail 50

# Run migration manually
docker exec $(docker ps -q -f name=rocket_rocket-crm-dev) node node_modules/prisma/build/index.js migrate deploy

# Check app health
curl -s -o /dev/null -w "%{http_code}" https://dev.rocket.avancesbr.com
```
