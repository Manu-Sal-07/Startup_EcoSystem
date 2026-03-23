import hashlib
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

from backend.db import cache_delete_pattern, cache_get, cache_set, get_session, view_get
from backend.matching import compute_matches, get_cached_or_compute_startup_matches, invalidate_related_match_caches
from backend.models import StartupCreate

router = APIRouter(prefix="/startups", tags=["startups"])


def _startup_cache_key(startup_id: str) -> str:
    return f"profile:startup:{startup_id}"


def _serialize_record(record):
    return record.data() if hasattr(record, "data") else record


@router.get("/feed")
async def get_startups_feed(
    sector: str | None = None,
    stage: str | None = None,
    min_ask: float | None = Query(default=None),
    max_ask: float | None = Query(default=None),
):
    raw_filters = f"{sector}|{stage}|{min_ask}|{max_ask}"
    filter_hash = hashlib.md5(raw_filters.encode("utf-8")).hexdigest()
    cache_key = f"feed:filtered:{filter_hash}"

    cached = cache_get(cache_key)
    if cached is not None:
        return {"source": "cache", "items": cached}

    query = """
    MATCH (s:Startup)
    WHERE ($sector IS NULL OR s.sector = $sector)
      AND ($stage IS NULL OR s.stage = $stage)
      AND ($min_ask IS NULL OR s.funding_ask >= $min_ask)
      AND ($max_ask IS NULL OR s.funding_ask <= $max_ask)
    RETURN s {
      .id, .name, .sector, .stage, .funding_ask, .equity_offered,
      .pitch, .team_size, .revenue, .founded
    } AS startup
    ORDER BY s.created_at DESC, s.name ASC
    LIMIT 50
    """
    with get_session() as session:
        items = [_serialize_record(record)["startup"] for record in session.run(query, sector=sector, stage=stage, min_ask=min_ask, max_ask=max_ask)]

    cache_set(cache_key, items, ttl=120)
    return {"source": "db", "items": items}


@router.post("/register")
async def register_startup(payload: StartupCreate, background_tasks: BackgroundTasks):
    startup = payload.model_dump()
    startup["id"] = str(uuid4())

    query = """
    CREATE (:Startup {
      id: $id,
      name: $name,
      sector: $sector,
      stage: $stage,
      funding_ask: $funding_ask,
      equity_offered: $equity_offered,
      pitch: $pitch,
      team_size: $team_size,
      revenue: $revenue,
      founded: $founded,
      created_at: datetime()
    })
    """
    with get_session() as session:
        session.run(query, **startup).consume()

    cache_set(_startup_cache_key(startup["id"]), startup, ttl=600)
    cache_delete_pattern("feed:filtered:*")
    background_tasks.add_task(invalidate_related_match_caches, startup["id"])
    background_tasks.add_task(compute_matches, startup["id"])

    return startup


@router.get("/{startup_id}")
async def get_startup(startup_id: str):
    cache_key = _startup_cache_key(startup_id)
    cached = cache_get(cache_key)
    if cached is not None:
        return {"source": "cache", "item": cached}

    query = """
    MATCH (s:Startup {id: $startup_id})
    RETURN s {
      .id, .name, .sector, .stage, .funding_ask, .equity_offered,
      .pitch, .team_size, .revenue, .founded
    } AS startup
    """
    with get_session() as session:
        record = session.run(query, startup_id=startup_id).single()

    if record is None:
        raise HTTPException(status_code=404, detail="Startup not found")

    startup = _serialize_record(record)["startup"]
    cache_set(cache_key, startup, ttl=600)
    return {"source": "db", "item": startup}


@router.get("/{startup_id}/viewers")
async def get_startup_viewers(startup_id: str):
    viewers = view_get(startup_id)
    return {"startup_id": startup_id, "viewers": viewers}


@router.get("/{startup_id}/matches")
async def get_startup_matches(startup_id: str):
    matches = get_cached_or_compute_startup_matches(startup_id)
    return {"startup_id": startup_id, "matches": matches}
