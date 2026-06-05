# Demo Presentation Slide Outline

## Slide 1: Title
- Startup Ecosystem Analytics
- FastAPI + Neo4j + Redis + Docker + Jenkins CI/CD
- Demo-focused: automated deployment with persistent data

## Slide 2: Problem Statement
- Challenge: startup and investor analytics require rapid deployment and reliable data continuity
- Goal: build a full-stack demo-ready system with safe CI/CD and persistent database/cache state

## Slide 3: Architecture Overview
- Components:
  - FastAPI backend
  - Neo4j graph database
  - Redis cache
  - Vanilla frontend served by backend
  - Docker Compose orchestration
  - Jenkins pipeline automation
- Visual flow: Code → GitHub → Jenkins → Docker → App

## Slide 4: Backend Design
- `backend/app.py` hosts API and frontend routes
- Health endpoint checks Neo4j and Redis
- Router modules cover auth, startups, investors, analytics, achievements, funds, connections
- `backend/db/redis_client.py`: lazy Redis initialization and safe proxy

## Slide 5: Data Persistence Strategy
- `docker-compose.yml` uses named volumes for Neo4j and Redis
- Pipeline avoids destructive cleanup (`--volumes`, `docker volume prune -f`)
- Seed logic in `backend/seed_data.py` is idempotent and skips if data exists

## Slide 6: CI/CD Pipeline
- `Jenkinsfile` stages:
  1. Checkout
  2. Workspace audit
  3. Backend validation
  4. Docker build
  5. Deployment
  6. Health check
  7. Success summary
- Emphasis: automated validation, build, deploy, and health verification

## Slide 7: Demo Flow
- Step 1: make a visible frontend change
- Step 2: commit and push to GitHub
- Step 3: Jenkins automatically builds and deploys
- Step 4: verify with frontend, API docs, and health endpoint

## Slide 8: Live Demo Commands
- `git add frontend/index.html`
- `git commit -m "Demo: update landing page title for CI/CD"`
- `git push origin main`
- `docker ps`
- `http://localhost/`
- `http://localhost:8000/docs`
- `http://localhost:8000/health`

## Slide 9: Key Benefits
- End-to-end automation
- Safe persistent backend data
- Rapid rollback-friendly Docker redeploys
- Clear health validation across stack
- Demo-ready visibility of deployment stages

## Slide 10: Q&A Preparedness
- Why Neo4j?
- Why Redis?
- How is persistence preserved?
- How does seed duplication get avoided?
- How does Jenkins verify the deployment?
- How can pipeline be extended?
