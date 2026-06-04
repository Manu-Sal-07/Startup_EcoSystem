# CI/CD Architecture & Workflow

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         DEVELOPER MACHINE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Make Code Changes                                           │
│     ├─ Edit frontend files (.html, .css, .js)                  │
│     ├─ Edit backend files (.py)                                │
│     └─ Edit Docker configs (Dockerfile, docker-compose.yml)    │
│                                                                  │
│  2. Git Workflow                                                │
│     ├─ git add .                                               │
│     ├─ git commit -m "Descriptive message"                     │
│     └─ git push origin main                                    │
│                                                                  │
└────────────┬──────────────────────────────────────────────────┬─┘
             │                                                  │
             │                 PUSH EVENT                       │
             │                                                  │
             ▼                                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                        GITHUB (REPOSITORY)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ├─ Repository: Manu-Sal-07/Startup_EcoSystem                 │
│  ├─ Branch: main                                              │
│  ├─ Files: updated with new commit                            │
│  └─ Webhook: Configured to notify Jenkins                     │
│                                                                  │
│  3. GitHub Webhook FIRES                                       │
│     ├─ Payload created with:                                  │
│     │   ├─ Repository details                                 │
│     │   ├─ Commit hash & message                              │
│     │   ├─ Changed files list                                 │
│     │   └─ Pusher information                                 │
│     └─ HTTP POST to Jenkins webhook URL                       │
│                                                                  │
└────────────┬──────────────────────────────────────────────────┬─┘
             │                                                  │
             │  WEBHOOK PAYLOAD (JSON)                          │
             │  ───────────────────────                         │
             │  {                                               │
             │    "ref": "refs/heads/main",                     │
             │    "commits": [{                                 │
             │      "id": "a1b2c3d...",                         │
             │      "message": "Update...",                     │
             │      "modified": ["frontend/index.html"]         │
             │    }]                                            │
             │  }                                               │
             │                                                  │
             ▼                                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   JENKINS (CI/CD ORCHESTRATOR)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  4. Webhook Received                                            │
│     └─ POST /github-webhook/ endpoint triggered               │
│                                                                  │
│  5. Pipeline Job Triggered                                      │
│     └─ Job: startup-analytics-pipeline                         │
│                                                                  │
└────────────┬──────────────────────────────────────────────────┬─┘
             │
             │  PIPELINE EXECUTION (6 STAGES)
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 1: CHECKOUT                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ✓ Clone repository from GitHub                               │
│  ✓ Checkout main branch                                       │
│  ✓ Extract commit hash & message                              │
│  ✓ Prepare workspace                                          │
│                                                                  │
│  Output: Fresh code in Jenkins workspace                        │
│                                                                  │
└────────────┬──────────────────────────────────────────────────┬─┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│              STAGE 2: BACKEND VALIDATION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ✓ Verify Python version                                      │
│  ✓ Install dependencies (pip install -r requirements.txt)      │
│  ✓ Validate FastAPI imports                                   │
│  ✓ Check Python syntax (py_compile)                           │
│  ✓ Test FastAPI app instantiation                             │
│                                                                  │
│  Output: Validated backend code ready for Docker               │
│                                                                  │
└────────────┬──────────────────────────────────────────────────┬─┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│               STAGE 3: DOCKER BUILD                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ✓ Build Frontend Image                                        │
│    └─ Image: startup-ecosystem-frontend:<commit-hash>         │
│    └─ Multi-stage: Node builder → Nginx runtime               │
│    └─ Size: ~150MB                                            │
│                                                                  │
│  ✓ Build Backend Image                                         │
│    └─ Image: startup-ecosystem-backend:<commit-hash>          │
│    └─ Base: Python 3.12-slim                                  │
│    └─ Size: ~400MB                                            │
│                                                                  │
│  ✓ Tag as latest                                              │
│  ✓ Verify images in Docker registry                           │
│                                                                  │
│  Output: Two production-ready Docker images                     │
│                                                                  │
└────────────┬──────────────────────────────────────────────────┬─┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                 STAGE 4: DEPLOYMENT                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ✓ Stop existing Docker services                              │
│    └─ docker compose down --remove-orphans                    │
│    └─ Graceful shutdown of all containers                     │
│    └─ Wait 3 seconds for cleanup                              │
│                                                                  │
│  ✓ Start new services                                          │
│    └─ docker compose up -d --force-recreate                   │
│    └─ Pulls latest images                                     │
│    └─ Creates/recreates containers                            │
│                                                                  │
│  ✓ Wait for services to stabilize (5 seconds)                 │
│  ✓ List running containers                                    │
│                                                                  │
│  Services Started:                                              │
│    ├─ frontend (Nginx on port 80)                             │
│    ├─ backend (FastAPI on port 8000)                          │
│    ├─ neo4j (Graph DB on port 7474/7687)                      │
│    └─ redis (Cache on port 6379)                              │
│                                                                  │
│  Output: All 4 services running with new code                  │
│                                                                  │
└────────────┬──────────────────────────────────────────────────┬─┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                STAGE 5: HEALTH CHECK                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ✓ Backend Health Endpoint                                     │
│    └─ curl http://localhost:8000/health                       │
│    └─ Retry every 2 seconds (max 30 attempts)                 │
│    └─ Verifies API is responding                              │
│                                                                  │
│  ✓ Frontend HTTP Response                                      │
│    └─ curl http://localhost:80                                │
│    └─ Retry every 2 seconds (max 30 attempts)                 │
│    └─ Verifies web server is responding                       │
│                                                                  │
│  ✓ Neo4j Availability                                          │
│    └─ docker exec neo4j cypher-shell 'RETURN 1;'              │
│    └─ Verifies database is accessible                         │
│                                                                  │
│  ✓ Redis Availability                                          │
│    └─ docker exec redis redis-cli ping                        │
│    └─ Verifies cache is accessible                            │
│                                                                  │
│  Output: All services confirmed healthy & responsive           │
│                                                                  │
└────────────┬──────────────────────────────────────────────────┬─┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│              STAGE 6: SUCCESS SUMMARY                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Display:                                                       │
│    ├─ Build Number: #42                                       │
│    ├─ Build Status: ✓ SUCCESS                                 │
│    ├─ Git Commit: a1b2c3d                                     │
│    ├─ Commit Message: "Fix: Update frontend"                  │
│    ├─ Timestamp: 2026-06-04 14:35:42 UTC                      │
│    ├─ Frontend Image: startup-ecosystem-frontend:a1b2c3d      │
│    ├─ Backend Image: startup-ecosystem-backend:a1b2c3d        │
│    └─ Access Points:                                          │
│        ├─ Application: http://localhost                       │
│        ├─ API: http://localhost:8000                          │
│        ├─ API Docs: http://localhost:8000/docs                │
│        ├─ Health: http://localhost:8000/health                │
│        ├─ Neo4j: http://localhost:7474                        │
│        └─ Redis: localhost:6379                               │
│                                                                  │
│  Output: Complete build log with deployment details           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
             │
             │ Build Completed Successfully
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│               DEPLOYED APPLICATION                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Frontend Available:                                            │
│    ├─ URL: http://localhost/                                  │
│    ├─ Assets: Latest HTML/CSS/JS                              │
│    └─ D3.js graph & Chart.js analytics loaded                 │
│                                                                  │
│  Backend Available:                                             │
│    ├─ API: http://localhost:8000                              │
│    ├─ Routes: All available with latest code                  │
│    └─ Database: Connected to Neo4j                            │
│                                                                  │
│  Databases Available:                                           │
│    ├─ Neo4j: Graph database for relationships                 │
│    └─ Redis: Cache layer for performance                      │
│                                                                  │
│  Users can access the updated application immediately          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
Developer's Local Machine
        ↓
   [Code Editor]
        ↓
   [Git Repository]
        ↓
    git push origin main
        ↓
        ├─────────────────────────────────────────────────────┐
        │                                                     │
        ▼                                                     ▼
   [GitHub Server]                        [GitHub Webhook Service]
        ↓                                         ↓
   Store Code                            Parse Commit Metadata
        ↓                                         ↓
   Update Branch                          Generate Payload
        ↓                                         ↓
   Update Commit Status                  Send HTTP POST
        ↓                                         ↓
        │                                        │
        └────────────────────────────┬───────────┘
                                     │
                                     ▼
                          [Jenkins Webhook Receiver]
                                     ↓
                          Verify Payload Signature
                                     ↓
                          Trigger Pipeline Job
                                     ↓
        ┌────────────────────────────────────────────────────┐
        │                                                    │
        ▼                                                    ▼
   [Build Executor]                              [GitHub Status API]
        ↓                                              ↓
   Checkout Code                              Update Commit Status
        ↓                                       (PENDING/IN PROGRESS)
   Validate Backend
        ↓
   Build Docker Images
        ↓
   Deploy Containers
        ↓
   Health Checks
        ↓
   ┌─────────┴──────────┐
   │                    │
   ▼                    ▼
 SUCCESS             FAILURE
   │                    │
   ├────────┬───────────┤
   │        │           │
   ▼        │           ▼
 Update    │      Update Commit
 Commit    │      Status: FAILURE
 Status:   │
 SUCCESS   ├──► Send Failure
           │     Notification
           │
           └──► Store Build Logs
                │
                └──► Jenkins
                     Build Dashboard
                         ↓
                    [User Reviews
                     Failure Logs]
                         ↓
                    [Developer Fixes]
                         ↓
                    [Push Again]
```

---

## Failure Handling Flow

```
Stage Execution
        ↓
    [Condition Check]
        ↓
   ┌────┴─────┐
   │           │
SUCCESS      FAILURE
   │           │
   │           ▼
   │      [Stop Pipeline]
   │           ↓
   │      [Mark Build FAILED]
   │           ↓
   │      [Post Block: failure]
   │           ├─ Display Error Message
   │           ├─ Show Failed Stage Name
   │           ├─ Capture Docker Logs
   │           └─ Display Build URL
   │           ↓
   │      [Update GitHub Status]
   │           ├─ Commit Status: FAILURE
   │           └─ GitHub Shows Red X
   │           ↓
   │      [Optional: Send Email]
   │           └─ Notify team members
   │           ↓
   │      [Store Logs]
   │           └─ Jenkins dashboard
   │
   └──────────►[Continue to Next Stage]
                        ↓
                   [Stage 6: Success Summary]
                        ↓
                   [Post Block: always]
                        ├─ Clean Workspace
                        └─ Cleanup Artifacts
                        ↓
                   [Build Complete]
```

---

## Rollback Strategy

If deployment causes issues:

### Immediate Rollback (Manual)

```bash
# SSH to server running Docker
cd startup-analytics

# Check running containers
docker ps

# View previous image tags
docker images

# Redeploy with previous version
docker compose down
docker tag startup-ecosystem-backend:previous startup-ecosystem-backend:latest
docker tag startup-ecosystem-frontend:previous startup-ecosystem-frontend:latest
docker compose up -d

# Verify rollback
curl http://localhost:8000/health
```

### Automated Rollback (Future Enhancement)

```groovy
// Add to Jenkinsfile post block
post {
    failure {
        script {
            sh '''
                echo "Rolling back to previous stable version..."
                docker compose down
                docker pull startup-ecosystem-backend:stable
                docker pull startup-ecosystem-frontend:stable
                docker compose up -d
            '''
        }
    }
}
```

---

## Performance Metrics

| Component | Typical Duration | Notes |
|-----------|-----------------|-------|
| Checkout | 5-10 seconds | Depends on repo size & network |
| Backend Validation | 15-20 seconds | Python dependency installation |
| Docker Build (Frontend) | 30-45 seconds | Nginx multi-stage build |
| Docker Build (Backend) | 45-60 seconds | Python dependencies & packages |
| Deployment | 10-15 seconds | Container orchestration |
| Health Checks | 10-30 seconds | Depends on service startup time |
| **Total Pipeline** | **~3-4 minutes** | End-to-end deployment |

---

## Security Considerations

1. **GitHub Webhook Secret:** Add signature verification
2. **Jenkins Credentials:** Store securely (vault/secrets manager)
3. **Docker Registry:** Use private registry with authentication
4. **Network:** Firewall Jenkins to trusted IPs only
5. **SSL/TLS:** Use HTTPS for webhook URLs (if possible)
6. **Build Logs:** Don't expose sensitive data (tokens, passwords)
7. **Image Scanning:** Scan Docker images for vulnerabilities

---

## Monitoring & Alerting

Recommended additions:

- **Build Success Rate:** Track successful deployments
- **Pipeline Duration:** Monitor performance trends
- **Stage Duration:** Identify bottlenecks
- **Failure Rate:** Track reliability
- **Deployment Frequency:** Measure CI/CD effectiveness
- **Error Notifications:** Slack/Email on failures

---

## Next Steps

1. ✓ Install Jenkins plugins
2. ✓ Configure GitHub webhook
3. ✓ Create pipeline job
4. ✓ Test first deployment
5. → Monitor build logs & metrics
6. → Iterate & optimize pipeline
