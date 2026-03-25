from fastapi import APIRouter, BackgroundTasks, Depends

from backend.auth import require_role
from backend.db import cache_delete, cache_get, cache_set, get_session, r
from backend.matching import invalidate_match_caches, refresh_related_matches
from backend.models import ConnectionDecision, InterestRequest

router = APIRouter(tags=["connections"])


@router.post("/connect/interest")
async def express_interest(
    payload: InterestRequest,
    background_tasks: BackgroundTasks,
    _: dict = Depends(require_role("INVESTOR")),
):
    query = """
    MATCH (i:Investor {id: $investor_id})
    MATCH (s:Startup {id: $startup_id})
    CREATE (i)-[:INTERESTED_IN {
      message: $message,
      proposed_amount: $proposed_amount,
      status: 'pending',
      date: datetime()
    }]->(s)
    """
    with get_session() as session:
        session.run(query, **payload.model_dump()).consume()

    cache_delete(f"profile:investor:{payload.investor_id}", f"profile:startup:{payload.startup_id}", f"connections:{payload.startup_id}")
    r.zincrby("leaderboard:investors", 1, payload.investor_id)
    invalidate_match_caches(startup_id=payload.startup_id, investor_id=payload.investor_id)
    background_tasks.add_task(refresh_related_matches, payload.startup_id, payload.investor_id)
    return {"status": "pending", **payload.model_dump()}


@router.post("/connect/accept")
async def accept_interest(
    payload: ConnectionDecision,
    _: dict = Depends(require_role("STARTUP")),
):
    update_query = """
    MATCH (i:Investor {id: $investor_id})-[r:INTERESTED_IN]->(s:Startup {id: $startup_id})
    SET r.status = 'accepted', r.accepted_at = datetime()
    CREATE (i)-[:CONNECTED_TO {date: datetime()}]->(s)
    """
    with get_session() as session:
        session.run(update_query, **payload.model_dump()).consume()

    cache_delete(f"connections:{payload.startup_id}")
    invalidate_match_caches(startup_id=payload.startup_id, investor_id=payload.investor_id)
    return {"status": "accepted", **payload.model_dump()}


@router.post("/connect/reject")
async def reject_interest(
    payload: ConnectionDecision,
    _: dict = Depends(require_role("STARTUP")),
):
    query = """
    MATCH (:Investor {id: $investor_id})-[r:INTERESTED_IN]->(:Startup {id: $startup_id})
    SET r.status = 'rejected', r.rejected_at = datetime()
    """
    with get_session() as session:
        session.run(query, **payload.model_dump()).consume()

    cache_delete(f"connections:{payload.startup_id}")
    invalidate_match_caches(startup_id=payload.startup_id, investor_id=payload.investor_id)
    return {"status": "rejected", **payload.model_dump()}


@router.get("/connections/{startup_id}")
async def get_connections(
    startup_id: str,
    _: dict = Depends(require_role("STARTUP", "ANALYST")),
):
    cache_key = f"connections:{startup_id}"
    cached = cache_get(cache_key)
    if cached is not None:
        return {"source": "cache", "items": cached}

    query = """
    MATCH (i:Investor)-[r:INTERESTED_IN]->(s:Startup {id: $startup_id})
    RETURN {
      investor_id: i.id,
      investor_name: i.name,
      status: r.status,
      message: r.message,
      proposed_amount: r.proposed_amount
    } AS connection
    ORDER BY investor_name ASC
    """
    with get_session() as session:
        items = [record.data()["connection"] for record in session.run(query, startup_id=startup_id)]

    cache_set(cache_key, items, ttl=60)
    return {"source": "db", "items": items}
