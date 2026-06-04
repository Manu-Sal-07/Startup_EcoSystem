# Jenkins Plugins & Requirements

## Required Jenkins Plugins

All plugins listed below are required for full CI/CD pipeline functionality.

### Plugin Installation Methods

#### Method 1: Via Jenkins UI (Recommended)
1. Go to **Manage Jenkins → Manage Plugins → Available**
2. Search for plugin by name
3. Check checkbox and click **Install**
4. Jenkins will install and auto-restart if needed

#### Method 2: Via Jenkins CLI
```bash
# SSH into Jenkins host
java -jar jenkins-cli.jar -s http://localhost:8080 \
  install-plugin <PLUGIN_ID> \
  -restart
```

#### Method 3: Via docker-compose (if using Jenkins container)
Add to environment variables in docker-compose:
```yaml
CASC_JENKINS_CONFIG: /var/jenkins_config.yml
```

---

## Required Plugins (11 Total)

### 1. Pipeline Plugin
- **ID:** `workflow-aggregator`
- **Version:** 2.6 or higher
- **Purpose:** Core Jenkins pipeline support (declarative & scripted)
- **Install:** Typically pre-installed

```bash
java -jar jenkins-cli.jar -s http://localhost:8080 install-plugin workflow-aggregator
```

---

### 2. GitHub Integration Plugin
- **ID:** `github`
- **Version:** 1.35.0 or higher
- **Purpose:** GitHub repository integration & webhook support
- **Critical for:** Webhook trigger, commit status updates

```bash
java -jar jenkins-cli.jar -s http://localhost:8080 install-plugin github
```

---

### 3. GitHub Branch Source Plugin
- **ID:** `github-branch-source`
- **Version:** 2.11.4 or higher
- **Purpose:** Better GitHub organization integration
- **Features:** Multi-branch pipelines, PR detection

```bash
java -jar jenkins-cli.jar -s http://localhost:8080 install-plugin github-branch-source
```

---

### 4. Docker Pipeline Plugin
- **ID:** `docker-workflow`
- **Version:** 1.28 or higher
- **Purpose:** Docker agent support & Docker commands in pipelines
- **Usage:** `docker build`, `docker push` in Jenkins

```bash
java -jar jenkins-cli.jar -s http://localhost:8080 install-plugin docker-workflow
```

---

### 5. Pipeline: Stage View Plugin
- **ID:** `pipeline-stage-view`
- **Version:** 2.25 or higher
- **Purpose:** Visual stage execution display
- **Benefit:** See pipeline stages in real-time with timing

```bash
java -jar jenkins-cli.jar -s http://localhost:8080 install-plugin pipeline-stage-view
```

---

### 6. Timestamper Plugin
- **ID:** `timestamper`
- **Version:** 1.11.10 or higher
- **Purpose:** Add timestamps to console logs
- **Benefit:** Better log debugging & tracing

```bash
java -jar jenkins-cli.jar -s http://localhost:8080 install-plugin timestamper
```

---

### 7. AnsiColor Plugin
- **ID:** `ansicolor`
- **Version:** 1.0.0 or higher
- **Purpose:** Colored console output support
- **Benefit:** Better readability of build logs with colors

```bash
java -jar jenkins-cli.jar -s http://localhost:8080 install-plugin ansicolor
```

---

### 8. Git Plugin
- **ID:** `git`
- **Version:** 4.10.0 or higher
- **Purpose:** Git version control system integration
- **Critical for:** Repository checkout, branch operations
- **Install:** Usually pre-installed

```bash
java -jar jenkins-cli.jar -s http://localhost:8080 install-plugin git
```

---

### 9. Credentials Plugin
- **ID:** `credentials`
- **Version:** 2.4.0 or higher
- **Purpose:** Secure credential management
- **Features:** Store GitHub tokens, Docker credentials
- **Install:** Usually pre-installed

```bash
java -jar jenkins-cli.jar -s http://localhost:8080 install-plugin credentials
```

---

### 10. Email Extension Plugin (Optional)
- **ID:** `email-ext`
- **Version:** 2.99.0 or higher
- **Purpose:** Email notifications on build failure
- **Benefit:** Alert team on pipeline failures

```bash
java -jar jenkins-cli.jar -s http://localhost:8080 install-plugin email-ext
```

---

### 11. Blue Ocean Plugin (Optional but Recommended)
- **ID:** `blueocean`
- **Version:** 1.25.5 or higher
- **Purpose:** Modern Jenkins UI for pipelines
- **Benefit:** Beautiful visualization of pipeline execution

```bash
java -jar jenkins-cli.jar -s http://localhost:8080 install-plugin blueocean
```

---

## Plugin Installation Script

Run all at once:

```bash
#!/bin/bash

PLUGINS=(
  "workflow-aggregator"
  "github"
  "github-branch-source"
  "docker-workflow"
  "pipeline-stage-view"
  "timestamper"
  "ansicolor"
  "git"
  "credentials"
  "email-ext"
  "blueocean"
)

JENKINS_URL="http://localhost:8080"
JENKINS_USER="admin"
JENKINS_TOKEN="your_api_token"

for plugin in "${PLUGINS[@]}"; do
  echo "Installing $plugin..."
  java -jar jenkins-cli.jar -s $JENKINS_URL \
    -auth $JENKINS_USER:$JENKINS_TOKEN \
    install-plugin $plugin
done

echo "Restarting Jenkins..."
java -jar jenkins-cli.jar -s $JENKINS_URL \
  -auth $JENKINS_USER:$JENKINS_TOKEN \
  restart
```

---

## Verification

### Check Installed Plugins

1. Go to **Manage Jenkins → Manage Plugins → Installed**
2. Verify all plugins from the list are present

### Via Jenkins CLI

```bash
java -jar jenkins-cli.jar -s http://localhost:8080 list-plugins | grep -E "github|docker|pipeline"
```

### Expected Output
```
email-ext: Email Extension Plugin
git: Git plugin
github: GitHub plugin
...
```

---

## Troubleshooting Plugin Issues

### Plugin Installation Failed

```bash
# Clear Jenkins cache and retry
rm -rf /var/lib/jenkins/plugins/*/
systemctl restart jenkins
```

### Plugin Conflicts

If plugins conflict, check Jenkins logs:
```bash
tail -f /var/log/jenkins/jenkins.log | grep -i "plugin"
```

### Update Plugins

1. Go to **Manage Jenkins → Manage Plugins → Updates**
2. Check "Select All" → **Download now and install after restart**

---

## System Requirements

### Jenkins Version
- **Minimum:** Jenkins 2.375+
- **Recommended:** Jenkins 2.414+ (LTS)

### Java Version
- **Minimum:** Java 11
- **Recommended:** Java 17

### Memory
- **Minimum:** 2GB
- **Recommended:** 4GB or more

### Disk Space
- **Minimum:** 20GB (for builds, caches, artifacts)
- **Recommended:** 50GB

---

## Next Steps After Plugin Installation

1. ✓ Install all required plugins
2. ✓ Restart Jenkins
3. ✓ Configure GitHub credentials
4. ✓ Create pipeline job
5. ✓ Add GitHub webhook
6. ✓ Test pipeline trigger

See [JENKINS_SETUP.md](JENKINS_SETUP.md) for complete setup instructions.
