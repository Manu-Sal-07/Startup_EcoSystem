# Startup Analytics Demo & Presentation Package

## 1. What to present

- Project name: **Startup Ecosystem Analytics**
- Stack: **FastAPI backend + Neo4j graph DB + Redis cache + Vanilla frontend**
- Deployment: **Docker Compose + Jenkins CI/CD pipeline**
- Key focus: **automated build, safe data persistence, health validation, and live demo flow**

## 2. Architecture highlights

### Core components
- `backend/app.py`
  - FastAPI entrypoint
  - Router registration for `auth`, `startups`, `investors`, `analytics`, `connections`, `funds`, `achievements`
  - Static frontend served from `/frontend`
  - `/health` endpoint verifies Neo4j and Redis
  - `/seed` endpoint runs idempotent seed initialization

- `backend/db/neo4j_client.py`
  - Neo4j driver wrapper
  - Session management
  - Index creation on app startup

- `backend/db/redis_client.py`
  - Lazy Redis initialization
  - Proxy `r` object for avoid import-time failures
  - Cache helpers: `cache_get`, `cache_set`, `cache_delete`, token blacklist, fund lock, view logs

- `backend/seed_data.py`
  - Reproducible seed payload generator
  - `is_database_initialized()` checks Neo4j node count
  - `run_seed(skip_if_initialized=True)` skips seeding when data exists

- `docker-compose.yml`
  - Named volumes: `neo4j_data`, `neo4j_logs`, `neo4j_import`, `redis_data`
  - Service dependencies with healthchecks
  - Backend and frontend services with host ports `8000` and `80`

- `Jenkinsfile`
  - Checkout, validation, Docker build, deployment, health check, success summary
  - Safe cleanup preserves Neo4j / Redis volumes
  - `.env` generation for Docker Compose

## 3. Demo flow

### Pre-demo checklist

- Jenkins server running and accessible
- GitHub webhook connected to Jenkins job
- If Jenkins is local, start ngrok and use its public URL for the webhook endpoint
- Docker installed and available
- `startup-analytics` repository cloned locally
- Browser open to Jenkins job and application endpoints

### Recommended live demo steps

1. Open `CI_CD_ARCHITECTURE.md`
   - Walk through GitHub → webhook → Jenkins → Docker Compose → app
   - Explain the goal: automated, repeatable deployment with data persistence

2. Show current code snapshot
   - `backend/app.py` health and frontend routes
   - `backend/db/redis_client.py` lazy proxy and safe startup behavior
   - `backend/seed_data.py` idempotent seed logic
   - `docker-compose.yml` named volumes and service healthchecks
   - `Jenkinsfile` pipeline stages

3. Make a visible change for the demo
   - Recommended file: `frontend/index.html`
   - Example change: update the `<title>` line to
     ```html
     <title>Startup Ecosystem Platform - CI/CD Demo</title>
     ```
   - Optionally update the visible demo badge or header text

4. Commit and push
   - Stage changes: `git add frontend/index.html`
   - Commit: `git commit -m "Demo: update landing page title for CI/CD"`
   - Push: `git push origin main`
   - Explain: this push triggers GitHub webhook and Jenkins job

5. Observe Jenkins pipeline
   - Open Jenkins job page: `http://localhost:8080/job/startup-analytics-pipeline/`
   - Refresh and click the new build
   - Explain each stage as it runs

6. Verify deployment
   - Confirm containers: `docker ps --filter "name=backend" --filter "name=frontend"`
   - Visit frontend: `http://localhost/`
   - Visit API docs: `http://localhost:8000/docs`
   - Check health: `http://localhost:8000/health`

## 4. Pipeline stage talking points

### Checkout
- Fresh clone of `main`
- Commit hash/name capture
- Ensures pipeline runs from source control

### Backend Validation
- `requirements.txt` existence
- Python version check
- `py_compile` syntax validation for backend modules
- Prevents broken Python from advancing

### Docker Build
- Builds frontend and backend images
- Tags images with commit hash and `latest`
- Keeps build outputs reproducible

### Deployment
- `docker-compose down --remove-orphans` preserves volumes
- Network and dangling image cleanup only
- `docker-compose up -d --force-recreate` relaunches services
- Named volumes keep Neo4j and Redis state across redeploys

### Health Check
- Backend `/health` endpoint
- Frontend HTTP response
- `neo4j` Cypher check
- `redis` `PING`
- Validates full stack, not just containers

### Success Summary
- Build metadata
- Runtime access points
- Confirms end-to-end deployment

## 5. Key code/feature wins to emphasize

- **Safe data persistence**: `docker-compose down --remove-orphans` and named volumes preserve Neo4j and Redis data
- **Idempotent seed initialization**: `seed_data.is_database_initialized()` prevents duplicate seed insertion
- **Reliable startup**: `backend/db/redis_client.py` now lazy-loads Redis and avoids import-time fails
- **Automated health checks**: Jenkins verifies backend, frontend, Neo4j, and Redis before marking success
- **Full-stack integration**: Graph database, cache layer, auth, analytics, and frontend delivered in one pipeline

## 6. Useful commands for the demo

### Local validation
```powershell
cd "d:/BMS COLL/SEM-6/NGD/Project/startup-analytics"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn backend.app:app --reload --port 8000
```

### Docker-compose run
```powershell
cd "d:/BMS COLL/SEM-6/NGD/Project/startup-analytics/docker"
docker compose up -d --build
```

### Trigger seed on running backend
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/seed"
```

### Jenkins-related commands
```bash
git add frontend/index.html
git commit -m "Demo: update landing page title for CI/CD"
git push origin main
```

### Inspect Docker state
```bash
docker ps
docker volume ls
docker-compose -f docker/docker-compose.yml ps
```

## 7. Potential viva / Q&A topics

- Why use Neo4j?  
  For relationship analytics, investor-startup graphs, connected view and interest flows, and efficient social/proximity queries.

- Why use Redis?  
  Fast caching, session-like data, token blacklist, leaderboard scores, and lightweight locking for funding operations.

- How does persistence work across redeploys?  
  Named volumes store Neo4j and Redis data separately from container lifecycle, and the pipeline avoids `--volumes` or `docker volume prune -f`.

- How do you avoid seed duplication?  
  `seed_data.run_seed()` checks Neo4j node count and skips seeding if data already exists.

- What happens if Neo4j or Redis is unavailable on startup?  
  FastAPI still boots; Redis uses a proxy object to defer connection errors until runtime and prints a warning instead of crashing.

- How does Jenkins verify deployment health?  
  It checks API health, front-end response, Neo4j Cypher connectivity, and Redis `PING`.

- How can this pipeline be extended?  
  Add unit/test stages, dependency scanning, Docker image publishing, rollbacks, environment-specific config, deploy to Kubernetes/Azure/AWS.

## 8. Demo safety notes

- Use `docker-compose down --remove-orphans` only; do not use `--volumes` during the demo.
- Avoid deleting or pruning named volumes that contain Neo4j/Redis state.
- If the app fails, verify `backend/app.py` and `backend/db/redis_client.py`, then re-run Jenkins.
- If a pipeline build fails, open Jenkins console log and inspect stage output for syntax or Docker issues.

## 9. Files worth opening during the presentation

- `Jenkinsfile`
- `CI_CD_ARCHITECTURE.md`
- `CI_CD_DEMO_GUIDE.md`
- `docker-compose.yml`
- `backend/app.py`
- `backend/db/redis_client.py`
- `backend/seed_data.py`
- `frontend/index.html`

---

*Prepared for the Startup Analytics CI/CD demo and final presentation.*
