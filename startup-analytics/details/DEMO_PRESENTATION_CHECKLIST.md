# Demo Checklist

## Before the demo
- [ ] Jenkins is running and the pipeline job is available
- [ ] GitHub webhook is configured for the repository
- [ ] If Jenkins is local and not publicly reachable, start ngrok and update the webhook URL
- [ ] Docker Desktop is running
- [ ] `startup-analytics` repo is cloned locally
- [ ] Browser open to Jenkins job and app endpoints
- [ ] `frontend/index.html` is ready for a visible change

## Ready files to show
- `Jenkinsfile`
- `CI_CD_ARCHITECTURE.md`
- `docker-compose.yml`
- `backend/app.py`
- `backend/db/redis_client.py`
- `backend/seed_data.py`
- `frontend/index.html`

## Demo execution
- [ ] Open architecture guide and explain the flow
- [ ] Modify `frontend/index.html` title or demo badge
- [ ] Commit with a clear message: `Demo: update landing page title for CI/CD`
- [ ] Push to `origin main`
- [ ] Watch Jenkins pipeline trigger
- [ ] Open build console and explain each stage
- [ ] Confirm deployment succeeded
- [ ] Visit `http://localhost/`
- [ ] Visit `http://localhost:8000/docs`
- [ ] Check `http://localhost:8000/health`

## Validation checks
- [ ] Backend validation passes
- [ ] Docker images build successfully
- [ ] `docker-compose up -d --force-recreate` restarts services
- [ ] Neo4j and Redis remain persistent
- [ ] Health check confirms all services are online

## If there is a failure
- [ ] Inspect Jenkins console output
- [ ] Check `backend/app.py` import and startup errors
- [ ] Check `backend/db/redis_client.py` lazy Redis proxy
- [ ] Confirm named volumes are still present
- [ ] Restart pipeline after fix

## Demo talking points
- Automated CI/CD from GitHub push to live deployment
- Persistence of Neo4j and Redis data across redeploys
- Idempotent seed logic avoids duplicate data
- Health checks protect against partial failures
- Jenkins stages provide transparent build feedback
