# Jenkins CI/CD Setup Guide

## Prerequisites

- Jenkins 2.375+ installed and running
- Docker installed on Jenkins agent
- GitHub repository access
- GitHub personal access token (for webhooks)

---

## PHASE 1: Jenkins Installation & Configuration

### Step 1: Install Required Jenkins Plugins

Navigate to **Manage Jenkins → Manage Plugins → Available**.

Search for and install:

1. **GitHub Integration Plugin**
   - Enables GitHub webhook triggers
   - ID: `github`

2. **GitHub Branch Source Plugin**
   - Better GitHub integration
   - ID: `github-branch-source`

3. **Docker Pipeline Plugin**
   - Docker support in pipelines
   - ID: `docker-workflow`

4. **Pipeline: Stage View Plugin**
   - Visual stage execution
   - ID: `pipeline-stage-view`

5. **Timestamper Plugin**
   - Add timestamps to logs
   - ID: `timestamper`

6. **AnsiColor Plugin**
   - Colored console output
   - ID: `ansicolor`

**Installation:** Click "Install" and let Jenkins restart automatically.

---

### Step 2: Configure GitHub Credentials

1. Go to **Manage Jenkins → Manage Credentials → System → Global credentials**

2. Click **Add Credentials**

3. Fill in:
   - **Kind:** Username with password
   - **Username:** `github-user` (your GitHub username)
   - **Password:** (GitHub personal access token)
   - **ID:** `github-credentials`
   - **Description:** GitHub API Credentials

4. Click **Create**

---

### Step 3: Configure Docker Environment

On the Jenkins agent machine (or Jenkins host):

```bash
# Ensure Jenkins user can access Docker
sudo usermod -aG docker jenkins

# Verify Docker daemon is accessible
docker ps

# Restart Jenkins
sudo systemctl restart jenkins
```

---

## PHASE 2: GitHub Webhook Configuration

### Step 1: Generate GitHub Personal Access Token

1. Go to **GitHub Settings → Developer settings → Personal access tokens**

2. Click **Generate new token**

3. Name it: `jenkins-webhook`

4. Select scopes:
   - ✓ `repo` (Full control of private repositories)
   - ✓ `admin:repo_hook` (Access to repo hooks)
   - ✓ `admin:org_hook` (Access to org hooks)

5. Click **Generate token**

6. **Copy the token** (you won't see it again)

---

### Step 2: Add Webhook to GitHub Repository

1. Go to **GitHub repository → Settings → Webhooks**

2. Click **Add webhook**

3. Fill in:
   - **Payload URL:** `http://<JENKINS_URL>:8080/github-webhook/`
   - **Content type:** `application/json`
   - **Events:** Push events (Just the push event)
   - **Active:** ✓ Checked

4. Click **Add webhook**

---

## PHASE 3: Create Jenkins Pipeline Job

### Step 1: Create New Pipeline Job

1. Go to Jenkins dashboard
2. Click **New Item**
3. Enter name: `startup-analytics-pipeline`
4. Select: **Pipeline**
5. Click **OK**

---

### Step 2: Configure Pipeline Job

1. **General:**
   - ✓ GitHub project
   - Project URL: `https://github.com/Manu-Sal-07/Startup_EcoSystem/`

2. **Build Triggers:**
   - ✓ GitHub hook trigger for GITScm polling

3. **Pipeline:**
   - **Definition:** Pipeline script from SCM
   - **SCM:** Git
   - **Repository URL:** `https://github.com/Manu-Sal-07/Startup_EcoSystem.git`
   - **Credentials:** `github-credentials`
   - **Branch Specifier:** `*/main`
   - **Script Path:** `startup-analytics/Jenkinsfile`

4. Click **Save**

---

## PHASE 4: Configure Jenkins Server Address

1. Go to **Manage Jenkins → System → Jenkins Location**

2. Set **Jenkins URL** to your accessible Jenkins address:
   ```
   http://<YOUR_SERVER_IP>:8080/
   ```
   (This must be publicly accessible for webhooks)

3. Click **Save**

---

## PHASE 5: Docker Configuration

### Ensure Docker is Running

```bash
# Check Docker status
docker ps

# If Docker is not running
sudo systemctl start docker
sudo systemctl enable docker
```

### Create .env File

In `startup-analytics/` directory:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

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

## DEMO MODE: Step-by-Step

### Prerequisites

- Jenkins running and configured
- GitHub webhook active
- Repository cloned locally

### Demo Steps

#### 1. Make a Code Change

In your local repository:

```bash
cd startup-analytics/frontend
# Edit any file, e.g., add a comment to index.html
echo "<!-- Updated at $(date) -->" >> index.html
```

#### 2. Commit the Change

```bash
git add .
git commit -m "Demo: Update frontend [ci]"
```

#### 3. Push to GitHub

```bash
git push origin main
```

**Automatic trigger:** GitHub webhook fires immediately → Jenkins job starts

#### 4. Watch Jenkins Build

Go to Jenkins dashboard:

```
http://localhost:8080/job/startup-analytics-pipeline/
```

Watch stages execute in real-time:
- ✓ Checkout
- ✓ Backend Validation
- ✓ Docker Build
- ✓ Deployment
- ✓ Health Check
- ✓ Success Summary

#### 5. Verify Deployment

Open the application:

```
http://localhost
```

Your frontend changes are now live.

#### 6. Check Health Endpoints

```bash
# Backend health
curl http://localhost:8000/health

# API documentation
curl http://localhost:8000/docs

# Neo4j Browser
open http://localhost:7474
```

---

## TROUBLESHOOTING

### Webhook Not Triggering

1. Check webhook delivery in GitHub:
   - **Settings → Webhooks → Deliveries**
   - Verify green checkmarks

2. Check Jenkins logs:
   ```bash
   sudo tail -f /var/log/jenkins/jenkins.log
   ```

3. Verify webhook URL is accessible:
   ```bash
   curl http://<JENKINS_URL>:8080/github-webhook/
   ```

### Docker Build Fails

1. Check Docker daemon:
   ```bash
   docker ps
   ```

2. Check disk space:
   ```bash
   df -h
   ```

3. Clean Docker cache:
   ```bash
   docker system prune -a
   ```

### Health Check Fails

1. Check running containers:
   ```bash
   docker ps
   ```

2. Check service logs:
   ```bash
   docker compose logs backend
   docker compose logs frontend
   ```

3. Verify ports are not in use:
   ```bash
   netstat -tuln | grep -E '80|8000|6379|7474|7687'
   ```

---

## Pipeline Failure Handling

If any stage fails:

1. **Build marked as FAILED** with red indicator
2. **Email notification** sent (if configured)
3. **GitHub commit status** updated to failure
4. **Jenkins log** shows exact error and failed stage

To debug:

```bash
# View recent build logs
cat /var/lib/jenkins/jobs/startup-analytics-pipeline/builds/lastBuild/log

# Check Docker logs
docker compose logs
```

---

## Success Indicators

✓ Successful pipeline run shows:
- All 6 stages complete (green)
- Build timestamp logged
- Git commit information displayed
- Access points listed
- Docker images created
- All services healthy

---

## Next Steps

1. **Test multiple commits** to validate pipeline
2. **Monitor build history** in Jenkins
3. **Configure email notifications** for failures
4. **Set up Docker Hub** for image registry (optional)
5. **Configure production deployment** stage (optional)
