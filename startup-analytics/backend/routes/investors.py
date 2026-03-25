from time import time
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from backend.auth import require_role
from backend.db import cache_get, cache_set, get_session, r, view_log
from backend.matching import compute_matches_for_investor, get_cached_or_compute_investor_matches
from backend.models import InvestorCreate

router = APIRouter(prefix="/investors", tags=["investors"])


def _investor_cache_key(investor_id: str) -> str:
    return f"profile:investor:{investor_id}"


def _serialize_record(record):
    return record.data() if hasattr(record, "data") else record


@router.post("/register")
async def register_investor(
    payload: InvestorCreate,
    background_tasks: BackgroundTasks,
    _: dict = Depends(require_role("INVESTOR")),
):
    investor = payload.model_dump()
    investor["id"] = str(uuid4())

    query = """
    CREATE (:Investor {
      id: $id,
      name: $name,
      firm: $firm,
      type: $type,
      ticket_min: $ticket_min,
      ticket_max: $ticket_max,
      preferred_sectors: $preferred_sectors,
      stage_focus: $stage_focus,
      bio: $bio,
      created_at: datetime()
    })
    """
    with get_session() as session:
        session.run(query, **investor).consume()

    cache_set(_investor_cache_key(investor["id"]), investor, ttl=600)
    r.zadd("leaderboard:investors", {investor["id"]: 0})
    background_tasks.add_task(compute_matches_for_investor, investor["id"])
    return investor


@router.get("/{investor_id}")
async def get_investor(
    investor_id: str,
    _: dict = Depends(require_role("INVESTOR", "ANALYST")),
):
    cache_key = _investor_cache_key(investor_id)
    cached = cache_get(cache_key)
    if cached is not None:
        return {"source": "cache", "item": cached}

    query = """
    MATCH (i:Investor {id: $investor_id})
    RETURN i {
      .id, .name, .firm, .type, .ticket_min, .ticket_max,
      .preferred_sectors, .stage_focus, .bio, .wallet_balance
    } AS investor
    """
    with get_session() as session:
        record = session.run(query, investor_id=investor_id).single()

    if record is None:
        raise HTTPException(status_code=404, detail="Investor not found")

    investor = _serialize_record(record)["investor"]
    cache_set(cache_key, investor, ttl=600)
    return {"source": "db", "item": investor}


@router.get("/{investor_id}/matches")
async def get_investor_matches(
    investor_id: str,
    _: dict = Depends(require_role("INVESTOR")),
):
    matches = get_cached_or_compute_investor_matches(investor_id)
    return {"investor_id": investor_id, "matches": matches}


@router.post("/{investor_id}/view/{startup_id}")
async def log_startup_view(
    investor_id: str,
    startup_id: str,
    _: dict = Depends(require_role("INVESTOR")),
):
    timestamp = int(time())
    view_log(startup_id=startup_id, investor_id=investor_id, ts=timestamp)
    return {"investor_id": investor_id, "startup_id": startup_id, "viewed_at": timestamp}
