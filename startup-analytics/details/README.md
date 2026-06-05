# Startup Ecosystem Analytics

Neo4j + Redis + FastAPI + vanilla frontend for startup, investor, and ecosystem analytics workflows.

## Stack

- FastAPI backend
- Neo4j 5.13 graph database
- Redis 7 cache
- Vanilla HTML/CSS/JS frontend with D3.js and Chart.js
- Pytest for backend verification

## Project Layout

```text
startup-analytics/
  backend/
  frontend/
  docker/
  tests/
  Dockerfile
```

## Local Run

From the project root:

```powershell
cd "D:\BMS COLL\SEM-6\NGD\Project\startup-analytics"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn backend.app:app --reload --port 8000
```

Useful URLs:

- App UI: `http://localhost:8000/`
- API docs: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`
- Neo4j Browser: `http://localhost:7474`

## Docker Run

From the `docker` folder:

```powershell
cd "D:\BMS COLL\SEM-6\NGD\Project\startup-analytics\docker"
docker compose up -d --build
```

This starts:

- `startup-analytics-api` on port `8000`
- `neo4j` on ports `7474` and `7687`
- `redis` on port `6379`

To stop the stack:

```powershell
docker compose down
```

## Seed Sample Data

Once the backend is running:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/seed"
```

Expected response shape:

```json
{
  "startups": 100,
  "investors": 40,
  "founders": 50,
  "relationships": 180
}
```

## Test

```powershell
cd "D:\BMS COLL\SEM-6\NGD\Project\startup-analytics"
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
pytest
```

`PYTEST_DISABLE_PLUGIN_AUTOLOAD=1` avoids failures caused by unrelated globally installed pytest plugins on the machine.

## CI

GitHub Actions runs the backend test suite on every push and pull request using:

- Python 3.12
- `pip install -r requirements.txt`
- `pytest`

Workflow file:

- `.github/workflows/ci.yml`

## Environment Defaults

The backend uses these defaults unless overridden:

- `NEO4J_URI=bolt://localhost:7687`
- `NEO4J_USER=neo4j`
- `NEO4J_PASSWORD=password123`
- `REDIS_HOST=localhost`
- `REDIS_PORT=6379`

Inside Docker Compose, the API container is configured to talk to `neo4j` and `redis` by service name.

## Deployment Notes

- The backend is container-ready through `Dockerfile`.
- The frontend is served directly by FastAPI at `/`.
- For production, set real credentials and avoid the default Neo4j password.
- If deploying behind a reverse proxy, keep port `8000` internal and terminate TLS at the proxy.
