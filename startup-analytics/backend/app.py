from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.auth import router as auth_router
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from backend.db import neo4j_client, redis_client
from backend import seed_data
from backend.routes import achievements_router, analytics_router, connections_router, funds_router, investors_router, startups_router

BASE_DIR = Path(__file__).resolve().parents[1]
FRONTEND_DIR = BASE_DIR / "frontend"
INDEX_FILE = FRONTEND_DIR / "index.html"
LOGIN_FILE = FRONTEND_DIR / "login.html"
REGISTER_FILE = FRONTEND_DIR / "register.html"
STARTUP_FILE = FRONTEND_DIR / "startup.html"
INVESTOR_FILE = FRONTEND_DIR / "investor.html"
ANALYST_FILE = FRONTEND_DIR / "analyst.html"
ANALYST_PREMIUM_FILE = FRONTEND_DIR / "analyst-premium.html"

NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
}


class NoCacheStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers.update(NO_CACHE_HEADERS)
        return response


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
app.include_router(achievements_router)
app.include_router(funds_router)
app.include_router(auth_router)
app.mount("/frontend", NoCacheStaticFiles(directory=FRONTEND_DIR), name="frontend")


@app.get("/", include_in_schema=False)
async def frontend_home():
    return FileResponse(INDEX_FILE, headers=NO_CACHE_HEADERS)


@app.get("/login", include_in_schema=False)
async def frontend_login():
    return FileResponse(LOGIN_FILE, headers=NO_CACHE_HEADERS)


@app.get("/register", include_in_schema=False)
async def frontend_register():
    return FileResponse(REGISTER_FILE, headers=NO_CACHE_HEADERS)


@app.get("/startup", include_in_schema=False)
async def frontend_startup():
    return FileResponse(STARTUP_FILE, headers=NO_CACHE_HEADERS)


@app.get("/investor", include_in_schema=False)
async def frontend_investor():
    return FileResponse(INVESTOR_FILE, headers=NO_CACHE_HEADERS)


@app.get("/analyst", include_in_schema=False)
async def frontend_analyst():
    return FileResponse(ANALYST_PREMIUM_FILE, headers=NO_CACHE_HEADERS)


@app.get("/analyst-classic", include_in_schema=False)
async def frontend_analyst_classic():
    return FileResponse(ANALYST_FILE, headers=NO_CACHE_HEADERS)


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
