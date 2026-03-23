from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from backend.db import neo4j_client, redis_client
from backend import seed_data
from backend.routes import analytics_router, connections_router, investors_router, startups_router

BASE_DIR = Path(__file__).resolve().parents[1]
FRONTEND_DIR = BASE_DIR / "frontend"
INDEX_FILE = FRONTEND_DIR / "index.html"


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        neo4j_client.ensure_indexes()
    except Exception:
        # Keep the app bootable even if the database is offline.
        pass
    yield


app = FastAPI(title="Startup Ecosystem Analytics", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(startups_router)
app.include_router(investors_router)
app.include_router(connections_router)
app.include_router(analytics_router)
app.mount("/frontend", StaticFiles(directory=FRONTEND_DIR), name="frontend")


@app.get("/", include_in_schema=False)
async def frontend_home():
    return FileResponse(INDEX_FILE)


@app.get("/health")
async def health():
    neo_ok = neo4j_client.verify_connectivity()
    try:
        # simple ping
        redis_client.r.ping()
        redis_ok = True
    except Exception:
        redis_ok = False

    return {"neo4j": "ok" if neo_ok else "fail", "redis": "ok" if redis_ok else "fail"}


@app.post("/seed")
async def seed():
    """Run the seed script (Phase 2 stub)."""
    result = seed_data.run_seed()
    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.app:app", host="0.0.0.0", port=8000, reload=True)
