# Quick Reference - Jenkins CI/CD Setup

Print or bookmark this page for quick reference during setup and demo.

---

## 1-Minute Overview

```
Code Change
    ↓
git push origin main
    ↓
GitHub Webhook Fires
    ↓
Jenkins Pipeline Starts
    ↓
6 Stages Execute (3-4 minutes)
    ├─ Checkout
    ├─ Backend Validation
    ├─ Docker Build
    ├─ Deployment
    ├─ Health Check
    └─ Success Summary
    ↓
Application Updated & Live
```

---

## Essential URLs

| Purpose | URL |
|---------|-----|
| Jenkins Dashboard | http://localhost:8080 |
| Pipeline Job | http://localhost:8080/job/startup-analytics-pipeline/ |
| Application | http://localhost |
| API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| Health Check | http://localhost:8000/health |
| Neo4j Browser | http://localhost:7474 |
| GitHub Repo | https://github.com/Manu-Sal-07/Startup_EcoSystem |

---

## Quick Setup (35 minutes)

### Step 1: Install Plugins (15 min)
Jenkins → Manage Jenkins → Manage Plugins → Available
```
Search & Install:
☑ Pipeline
☑ GitHub plugin
☑ GitHub Branch Source
☑ Docker Pipeline
☑ Stage View
☑ Timestamper
☑ AnsiColor
```

### Step 2: Configure GitHub (10 min)
1. Generate token: GitHub Settings → Developer settings → Personal tokens
2. Add webhook: Repository → Settings → Webhooks
   - URL: `http://<JENKINS_IP>:8080/github-webhook/`
   - Event: Push events only

### Step 3: Create Job (10 min)
Jenkins → New Item → Pipeline
```
Name: startup-analytics-pipeline
SCM: Git
Repository: https://github.com/Manu-Sal-07/Startup_EcoSystem.git
Branch: */main
Script Path: startup-analytics/Jenkinsfile
Build Trigger: ☑ GitHub hook trigger
```

### Step 4: Test (Automatic)
```bash
cd startup-analytics
git add .
git commit -m "Test webhook"
git push origin main
# Watch build at: http://localhost:8080/job/startup-analytics-pipeline/
```

---

## Demo Flow (5-20 minutes)

### Option 1: Quick (5 min)
1. Edit `frontend/index.html` (change title)
2. `git add . && git commit -m "Demo" && git push`
3. Refresh Jenkins dashboard
4. Watch build execute
5. Open http://localhost and verify change

### Option 2: Full (20 min)
1. Explain architecture diagram
2. Show Jenkins dashboard (existing builds)
3. Make frontend change
4. Push to GitHub
5. Live-watch all 6 stages execute
6. Verify deployment with curl tests
7. Open application
8. Show GitHub status update
9. (Optional) Intentionally break code, show failure handling

---

## Required Plugins (Quick Copy)

```bash
# Install via Jenkins CLI:
jenkins-cli install-plugin workflow-aggregator
jenkins-cli install-plugin github
jenkins-cli install-plugin github-branch-source
jenkins-cli install-plugin docker-workflow
jenkins-cli install-plugin pipeline-stage-view
jenkins-cli install-plugin timestamper
jenkins-cli install-plugin ansicolor
jenkins-cli install-plugin git
jenkins-cli install-plugin credentials
jenkins-cli install-plugin email-ext
jenkins-cli install-plugin blueocean
```

---

## GitHub Webhook Payload Format

```json
{
  "ref": "refs/heads/main",
  "before": "a1b2c3d...",
  "after": "e4f5g6h...",
  "commits": [{
    "id": "e4f5g6h...",
    "message": "Fix: Update frontend",
    "modified": ["frontend/index.html"]
  }]
}
```

---

## Pipeline Stages (Timing)

| Stage | Duration | Key Action |
|-------|----------|-----------|
| Checkout | 5-10s | Clone repo |
| Backend Validation | 15-20s | Verify imports |
| Docker Build | 2-3 min | Build images |
| Deployment | 10-15s | docker compose up |
| Health Check | 10-30s | Verify services |
| Success Summary | 5s | Log results |
| **Total** | **3-4 min** | End-to-end |

---

## Common Commands

```bash
# Check Jenkins logs
docker logs jenkins

# View Docker containers
docker ps

# Check specific service logs
docker compose logs backend
docker compose logs frontend
docker compose logs neo4j
docker compose logs redis

# Verify services running
curl http://localhost:8000/health      # Backend
curl http://localhost                  # Frontend
docker exec neo4j cypher-shell 'RETURN 1;'  # Neo4j
docker exec redis redis-cli ping       # Redis

# Git operations
git status
git add .
git commit -m "Message"
git push origin main
git log --oneline -5  # Show last 5 commits
```

---

## Troubleshooting Quick Fixes

| Problem | Command |
|---------|---------|
| Webhook not firing | GitHub → Webhooks → Recent Deliveries → Check green ✓ |
| Docker build slow | First build is slow (~2-3 min), cache speeds up future builds |
| Health check fails | `docker compose ps` - verify all 4 containers running |
| App not updated | Hard refresh: Ctrl+Shift+Delete (clear cache) |
| Jenkins offline | Check Docker: `docker ps \| grep jenkins` |
| Containers stopped | `docker compose up -d` in startup-analytics/ |

---

## Files Quick Reference

| File | Contains |
|------|----------|
| `Jenkinsfile` | Pipeline definition (6 stages) |
| `.env` | Environment variables (GitHub, DB credentials) |
| `docker-compose.yml` | Service definitions (4 services) |
| `frontend/Dockerfile` | Nginx multi-stage build |
| `backend/Dockerfile` | Python FastAPI image |

---

## Pre-Demo Checklist

Before demonstrating to evaluators:

- [ ] Jenkins running (`docker ps \| grep jenkins`)
- [ ] All 11 plugins installed (Manage Plugins → Installed)
- [ ] GitHub webhook shows ✓ green in Recent Deliveries
- [ ] Pipeline job exists: startup-analytics-pipeline
- [ ] All 4 Docker containers running: `docker ps`
- [ ] Frontend accessible: http://localhost
- [ ] Backend API responding: `curl http://localhost:8000/health`
- [ ] Local repo is clean: `git status` shows no uncommitted changes
- [ ] You have code editor ready (`code .`)

---

## Demo Script (Talking Points)

```
"This is a fully automated CI/CD pipeline that deploys code 
changes from GitHub to Docker containers in about 3-4 minutes.

The flow is:
1. Developer makes code change and pushes to GitHub
2. GitHub fires a webhook to Jenkins
3. Jenkins runs 6 stages: checkout, validate, build, deploy, health check, summary
4. Docker images are built with the new code
5. Containers are redeployed
6. All services verified healthy
7. Application updated and live

Let me show you..."

[Make code change]
"I'm editing the page title..."

[Save and push]
"git push origin main - the webhook fires immediately"

[Open Jenkins]
"Refreshing Jenkins... new build starts"

[Watch stages]
"Notice the stages executing: checkout, validation, Docker build takes 
a couple minutes, then deployment, health checks..."

[Open application]
"And here's the application with the change deployed"

[Show metrics]
"Total time: 3 minutes from push to live. No manual steps."
```

---

## Docker Compose Services

```yaml
frontend:
  Image: startup-ecosystem-frontend:latest
  Port: 80
  Status: Should be healthy

backend:
  Image: startup-ecosystem-backend:latest
  Port: 8000
  Status: Should be healthy

neo4j:
  Image: neo4j:5.13
  Port: 7474, 7687
  Status: Should be healthy

redis:
  Image: redis:7-alpine
  Port: 6379
  Status: Should be healthy
```

Check health: `docker compose ps`

---

## Environment Variables (.env)

```env
NEO4J_AUTH=neo4j/password123
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123
NEO4J_URI=bolt://localhost:7687
NEO4J_URI_DOCKER=bolt://neo4j:7687
REDIS_HOST=localhost
REDIS_HOST_DOCKER=redis
REDIS_PORT=6379
NEO4J_dbms_memory_heap_initial__size=512m
NEO4J_dbms_memory_heap_max__size=1G
```

---

## Jenkins Credentials Setup

**Type:** Username with password
**ID:** `github-credentials`
**Username:** Your GitHub username
**Password:** Your GitHub personal access token (not password!)

How to find token:
1. GitHub → Settings → Developer settings → Personal tokens
2. Click your token name
3. Copy the token value
4. Add to Jenkins as password

---

## GitHub Webhook Status

Check webhook delivery:
1. GitHub → Repository Settings → Webhooks
2. Click on the webhook
3. Scroll to "Recent Deliveries"
4. Green ✓ = Webhook delivered successfully
5. Red ✗ = Failed (hover to see error)

Common webhook failures:
- `Connection refused` - Jenkins not accessible
- `404 Not Found` - Wrong webhook URL
- `Timeout` - Network issue or Jenkins slow

---

## Performance Benchmarks

Assuming:
- 2GB+ RAM available
- SSD storage
- Decent network

Expected timings:
- Checkout: 5-10 seconds
- Validation: 15-20 seconds
- Docker Build (cold): 2-3 minutes
- Docker Build (warm cache): 30-45 seconds
- Deployment: 10-15 seconds
- Health Checks: 10-30 seconds

Total: 3-4 minutes for complete pipeline

---

## Webhook URL Format

Make sure this is correct:

```
❌ Wrong: http://localhost:8080/github-webhook/
         (localhost won't work for webhooks)

✓ Correct: http://192.168.1.100:8080/github-webhook/
           (Must use actual IP or domain)

✓ Correct: http://jenkins.company.com/github-webhook/
           (Or publicly accessible domain)

✓ ALWAYS: Must end with /github-webhook/
          (Exact path required)
```

---

## Failure Handling Summary

When a stage fails:

1. **Pipeline Stops** - No further stages execute
2. **Build Marked FAILED** - Red indicator in Jenkins
3. **GitHub Updated** - Commit shows red ✗
4. **Logs Saved** - Full error message available
5. **Services Continue** - Previous version still running
6. **Developer Fixes** - Push corrected code
7. **Auto-Redeploy** - Pipeline runs again

Example failure trigger:
```bash
# Add bad import
echo "from invalid_module import something" >> backend/app.py
git commit -m "Bad import"
git push
# Watch pipeline fail at Backend Validation stage
# Fix it
# Push again → Pipeline succeeds
```

---

## Questions to Answer

**"How long does deployment take?"**
A: "3-4 minutes from git push to live application. Checkout is fast, Docker build takes ~2 minutes, rest is validation and health checks."

**"What if code is broken?"**
A: "Pipeline validates all imports and syntax before building. If validation fails, pipeline stops and shows the error. Previous version keeps running."

**"Can I rollback?"**
A: "Yes. Every Docker image is tagged with the git commit hash. You can redeploy any previous version by checking out that commit."

**"Is this production-ready?"**
A: "Yes, for small deployments. For enterprise, you'd add image scanning, staging environments, canary deployments, and metrics."

---

## Success Indicators

After pushing code, you'll see:

1. Jenkins dashboard refreshes
2. New build number appears
3. Stages execute one by one (colors: blue=running, green=success, red=failed)
4. All 6 stages turn green
5. Success Summary displayed with build details
6. GitHub shows green ✓ on commit
7. Application accessible with new changes
8. Total time: ~3-4 minutes

---

## Emergency Procedures

If something goes wrong:

```bash
# Stop everything
docker compose down

# Check status
docker ps

# See logs
docker compose logs

# Restart services
docker compose up -d

# Verify
docker compose ps
curl http://localhost:8000/health
```

If Jenkins is hung:
```bash
# Restart Jenkins
docker restart jenkins

# Or if Docker is stuck
docker system prune -a
```

If you need to rollback deployment:
```bash
cd startup-analytics

# Find previous image tag
docker images | grep startup-ecosystem

# Redeploy old image
docker tag startup-ecosystem-backend:OLD_HASH startup-ecosystem-backend:latest
docker tag startup-ecosystem-frontend:OLD_HASH startup-ecosystem-frontend:latest
docker compose up -d
```

---

## Pro Tips

1. **First push is slow** - Docker builds cache images. Second push is ~2x faster.
2. **Watch the logs** - Console Output shows exactly what's happening at each stage.
3. **Blue Ocean UI** - If installed, gives beautiful pipeline visualization.
4. **GitHub integration** - Commit status updates automatically (green ✓ or red ✗).
5. **Multiple builds** - Can run same pipeline multiple times with different commits.
6. **Parallel stages** - Could be added to Jenkinsfile for faster builds (advanced).
7. **Webhook delivery** - Check Recent Deliveries in GitHub if webhook seems stuck.

---

**Last Updated:** June 4, 2026  
**For complete details, see:** [CI_CD_COMPLETE_GUIDE.md](CI_CD_COMPLETE_GUIDE.md)
