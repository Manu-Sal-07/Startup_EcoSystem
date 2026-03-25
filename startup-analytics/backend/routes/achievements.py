from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth import get_current_user, require_role
from backend.db import cache_delete, cache_get, cache_set, get_session, r

router = APIRouter(tags=["achievements"])


class AchievementIn(BaseModel):
    type: str
    title: str
    description: str
    value: float | None = None
    date: str
    media_url: str | None = None


@router.post("/achievements/post")
async def post_achievement(
    payload: AchievementIn,
    current_user: dict = Depends(require_role("STARTUP")),
):
    startup_id = current_user["id"]
    ach_id = f"ach_{str(uuid4())[:8]}"

    query = """
    MATCH (s:Startup {id: $startup_id})
    CREATE (a:Achievement {
      id: $ach_id,
      type: $type,
      title: $title,
      description: $description,
      value: $value,
      date: date($date),
      verified: false,
      media_url: $media_url,
      created_at: datetime()
    })
    CREATE (s)-[:HAS_ACHIEVEMENT {posted_at: datetime()}]->(a)
    RETURN a.id AS ach_id
    """
    with get_session() as session:
        record = session.run(query, startup_id=startup_id, ach_id=ach_id, **payload.model_dump()).single()

    if record is None:
        raise HTTPException(status_code=404, detail="Startup not found")

    cache_delete(f"achievements:{startup_id}", f"profile:startup:{startup_id}", f"matches:startup:{startup_id}")
    r.hincrby(f"meta:startup:{startup_id}", "achievement_count", 1)
    return {"ach_id": ach_id, "startup_id": startup_id, "title": payload.title}


@router.get("/startups/{startup_id}/achievements")
async def get_startup_achievements(
    startup_id: str,
    _: dict = Depends(require_role("INVESTOR", "ANALYST", "STARTUP")),
):
    cache_key = f"achievements:{startup_id}"
    cached = cache_get(cache_key)
    if cached is not None:
        return {"source": "cache", "items": cached}

    query = """
    MATCH (s:Startup {id: $startup_id})-[:HAS_ACHIEVEMENT]->(a:Achievement)
    RETURN {
      id: a.id,
      type: a.type,
      title: a.title,
      description: a.description,
      value: a.value,
      date: toString(a.date),
      verified: a.verified,
      media_url: a.media_url
    } AS achievement
    ORDER BY achievement.date DESC
    """
    with get_session() as session:
        items = [record.data()["achievement"] for record in session.run(query, startup_id=startup_id)]

    cache_set(cache_key, items, ttl=600)
    return {"source": "db", "items": items}


@router.patch("/achievements/{ach_id}/verify")
async def verify_achievement(
    ach_id: str,
    _: dict = Depends(require_role("ANALYST")),
):
    query = """
    MATCH (s:Startup)-[:HAS_ACHIEVEMENT]->(a:Achievement {id: $ach_id})
    SET a.verified = true
    RETURN a.id AS ach_id, s.id AS startup_id
    """
    with get_session() as session:
        record = session.run(query, ach_id=ach_id).single()

    if record is None:
        raise HTTPException(status_code=404, detail="Achievement not found")

    payload = record.data()
    cache_delete(f"achievements:{payload['startup_id']}", f"matches:startup:{payload['startup_id']}")
    return {"ach_id": payload["ach_id"], "verified": True}


@router.get("/analytics/achievement-leaders")
async def get_achievement_leaders(_: dict = Depends(require_role("ANALYST"))):
    query = """
    MATCH (s:Startup)-[:HAS_ACHIEVEMENT]->(a:Achievement)
    WHERE a.date >= date() - duration({days: 90})
    RETURN s.name AS name, s.sector AS sector, count(a) AS ach_count, collect(a.type) AS types
    ORDER BY ach_count DESC, name ASC
    LIMIT 10
    """
    with get_session() as session:
        items = [record.data() for record in session.run(query)]
    return {"items": items}
