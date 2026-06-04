# GitHub Webhook Setup Guide

## Overview

This guide walks through setting up GitHub webhooks to automatically trigger Jenkins CI/CD pipeline on code push.

---

## Prerequisites

- GitHub repository access (admin)
- Jenkins instance running with public URL
- GitHub personal access token

---

## Step 1: Generate GitHub Personal Access Token

### In GitHub:

1. Click your **profile avatar** (top-right)
2. Select **Settings**
3. Go to **Developer settings** (left sidebar)
4. Click **Personal access tokens** → **Tokens (classic)**
5. Click **Generate new token** → **Generate new token (classic)**

### Token Configuration:

- **Token name:** `jenkins-webhook`
- **Expiration:** 90 days (or No expiration)

### Scopes (Permissions):

Check the following:

- ✓ **repo**
  - `repo:status` - Access commit status
  - `repo_deployment` - Access deployment status
  - `public_repo` - Access public repositories
  - `repo:invite` - Access repository invitations
  - `security_events` - Read and write security events

- ✓ **admin:repo_hook**
  - Full control of repository hooks

- ✓ **admin:org_hook**
  - Full control of organization hooks

- ✓ **workflow**
  - Update GitHub Action workflows

### Generate & Copy:

Click **Generate token**

⚠️ **IMPORTANT:** Copy the token immediately (you won't see it again)

Save it temporarily:
```
ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Step 2: Add Webhook to GitHub Repository

### In GitHub Repository:

1. Go to your repository: `https://github.com/Manu-Sal-07/Startup_EcoSystem`
2. Click **Settings** (repository settings, not account)
3. Go to **Webhooks** (left sidebar)
4. Click **Add webhook**

---

### Webhook Configuration:

| Field | Value |
|-------|-------|
| **Payload URL** | `http://<JENKINS_SERVER_IP>:8080/github-webhook/` |
| **Content type** | `application/json` |
| **Secret** | (Leave empty for now, or add Jenkins token) |
| **Which events would you like to trigger this webhook?** | Just the push event |
| **Active** | ✓ Checked |

### Example Payload URL:

```
http://192.168.1.100:8080/github-webhook/
```

⚠️ **Important:** 
- Must be publicly accessible (not localhost)
- Must end with `/github-webhook/`
- Must use HTTP or HTTPS based on your setup

---

### Create Webhook:

Click **Add webhook**

---

## Step 3: Verify Webhook Connection

### In GitHub Webhook Settings:

1. Scroll to **Recent Deliveries**
2. You should see webhook attempts with:
   - ✓ Green checkmark = successful delivery
   - ✗ Red X = failed delivery

### If Delivery Failed:

Click the failed delivery to see:
- Request headers
- Request body
- Response status
- Response body

Common issues:
- `Connection refused` → Jenkins not accessible
- `Timeout` → Firewall blocking access
- `404 Not Found` → Wrong webhook URL

---

## Step 4: Jenkins Configuration (On Jenkins)

### Add GitHub Credentials:

1. Go to Jenkins: `http://<JENKINS_IP>:8080`
2. Click **Manage Jenkins** → **Manage Credentials**
3. Click **System** → **Global credentials**
4. Click **Add Credentials**

| Field | Value |
|-------|-------|
| **Kind** | Username with password |
| **Username** | (Your GitHub username) |
| **Password** | (GitHub personal access token) |
| **ID** | `github-credentials` |
| **Description** | GitHub API Credentials |

5. Click **Create**

---

### Configure Jenkins System:

1. Go to **Manage Jenkins** → **Configure System**
2. Scroll to **GitHub** section
3. Click **Add GitHub Server**

| Field | Value |
|-------|-------|
| **Name** | `GitHub` |
| **API URL** | `https://api.github.com` |
| **Credentials** | Select `github-credentials` |

4. Click **Test connection**
   - Should show: `Credentials verified for user: <github-username>, rate limit: ...`

5. Click **Save**

---

### Create Pipeline Job:

1. Click **New Item**
2. Enter name: `startup-analytics-pipeline`
3. Select **Pipeline**
4. Click **OK**

### Job Configuration:

#### General:
- ✓ **GitHub project**
- **Project URL:** `https://github.com/Manu-Sal-07/Startup_EcoSystem/`

#### Build Triggers:
- ✓ **GitHub hook trigger for GITScm polling**

#### Pipeline:
- **Definition:** Pipeline script from SCM
- **SCM:** Git
  - **Repository URL:** `https://github.com/Manu-Sal-07/Startup_EcoSystem.git`
  - **Credentials:** `github-credentials`
  - **Branch Specifier:** `*/main`
  - **Script Path:** `startup-analytics/Jenkinsfile`

5. Click **Save**

---

## Step 5: Test Webhook Trigger

### Make a Test Commit:

```bash
cd startup-analytics
git checkout -b test-webhook
echo "# Test webhook" >> README.md
git add README.md
git commit -m "Test webhook trigger"
git push origin test-webhook
```

### Create Pull Request:

In GitHub, create a PR from `test-webhook` to `main`

### Or Merge Directly:

```bash
git checkout main
git merge test-webhook
git push origin main
```

### Watch Jenkins:

Go to Jenkins dashboard:
```
http://<JENKINS_IP>:8080/job/startup-analytics-pipeline/
```

Should see:
- New build automatically triggered
- Build number incrementing
- Stages executing

---

## Webhook Delivery Troubleshooting

### Check GitHub Webhook Status:

1. Go to **GitHub repo → Settings → Webhooks**
2. Click on the webhook
3. Scroll to **Recent Deliveries**

### Common Issues & Fixes:

| Status | Problem | Solution |
|--------|---------|----------|
| ✗ Connection refused | Jenkins not running/accessible | Start Jenkins, verify firewall |
| ✗ Timeout | Network latency | Check network, increase timeout |
| ✗ 404 | Wrong webhook URL | Fix URL to end with `/github-webhook/` |
| ✗ 403 | Permission denied | Check Jenkins credentials |
| ✓ 200 | Success | Webhook working correctly |

### Re-deliver Failed Webhook:

1. Click failed delivery
2. Scroll to bottom
3. Click **Redeliver**

---

## GitHub Commit Status Integration

Jenkins automatically updates GitHub commit status:

In GitHub commit view, you'll see:
- ✓ **Continuous integration / jenkins** - Build passed
- ✗ **Continuous integration / jenkins** - Build failed

This provides immediate feedback in PRs and commits.

---

## Security Best Practices

1. **Restrict webhook access:**
   - Firewall Jenkins to known IPs only
   - Use HTTPS for webhook URL (if available)

2. **Rotate tokens:**
   - GitHub token: 90 days (recommended)
   - Jenkins credentials: Update quarterly

3. **Monitor deliveries:**
   - Check webhook deliveries weekly
   - Alert on repeated failures

4. **Limit permissions:**
   - Token should only have necessary scopes
   - Don't grant `repo:full` if not needed

---

## Advanced Configuration

### Webhook Secret (Optional):

For added security, add a webhook secret:

1. **In GitHub webhook:**
   - Add **Secret:** (any random string)

2. **In Jenkins:**
   - Install **GitHub Authentication Plugin**
   - Configure webhook secret in job

---

## Testing Without Webhooks

If webhook is not working, manually trigger:

```bash
# In Jenkins job:
# Click "Build Now" button

# Or via Jenkins API:
curl -X POST http://JENKINS_URL:8080/job/startup-analytics-pipeline/build \
  --user admin:TOKEN
```

---

## Pipeline Execution Flow

When webhook fires:

```
GitHub Push
    ↓
GitHub Webhook Request
    ↓
Jenkins Receives Payload
    ↓
Triggers Job: startup-analytics-pipeline
    ↓
Jenkinsfile Executes
    ↓
Checkout Code
    ↓
Validate Backend
    ↓
Build Docker Images
    ↓
Deploy Containers
    ↓
Health Checks
    ↓
Success/Failure Notification
    ↓
GitHub Commit Status Updated
```

---

## Verification Checklist

- ✓ GitHub personal access token created
- ✓ Webhook added to repository
- ✓ Webhook showing green checkmarks in Recent Deliveries
- ✓ Jenkins credentials configured
- ✓ Pipeline job created
- ✓ Build Trigger: "GitHub hook trigger" enabled
- ✓ Test push automatically triggered build
- ✓ GitHub commit status updated

Once all items checked, webhook is fully configured!
