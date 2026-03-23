from fastapi import APIRouter

from backend.db import cache_get, cache_set, get_session, r

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/network")
async def get_network():
    cache_key = "analytics:network"
    cached = cache_get(cache_key)
    if cached is not None:
        return {"source": "cache", "items": cached}

    node_query = """
    MATCH (n)
    RETURN {
      id: n.id,
      label: head(labels(n)),
      name: coalesce(n.name, n.id),
      sector: n.sector,
      stage: n.stage
    } AS node
    """
    edge_query = """
    MATCH (a)-[r]->(b)
    RETURN {
      source: a.id,
      target: b.id,
      type: type(r)
    } AS edge
    """
    with get_session() as session:
        nodes = [record.data()["node"] for record in session.run(node_query)]
        edges = [record.data()["edge"] for record in session.run(edge_query)]

    payload = {"nodes": nodes, "edges": edges}
    cache_set(cache_key, payload, ttl=300)
    return {"source": "db", "items": payload}


@router.get("/leaderboard")
async def get_leaderboard():
    leaders = r.zrevrange("leaderboard:investors", 0, 19, withscores=True)
    return {
        "items": [
            {"investor_id": investor_id, "score": score}
            for investor_id, score in leaders
        ]
    }


@router.get("/sector-trends")
async def get_sector_trends():
    cache_key = "analytics:sector-trends"
    cached = cache_get(cache_key)
    if cached is not None:
        return {"source": "cache", "items": cached}

    query = """
    MATCH (s:Startup)
    RETURN s.sector AS sector, count(*) AS startup_count, sum(s.funding_ask) AS total_funding_ask
    ORDER BY total_funding_ask DESC
    """
    with get_session() as session:
        items = [record.data() for record in session.run(query)]

    cache_set(cache_key, items, ttl=300)
    return {"source": "db", "items": items}


@router.get("/hot-sectors")
async def get_hot_sectors():
    cache_key = "analytics:hot-sectors"
    cached = cache_get(cache_key)
    if cached is not None:
        return {"source": "cache", "items": cached}

    query = """
    MATCH (:Investor)-[r:INTERESTED_IN]->(s:Startup)
    WHERE r.date >= datetime() - duration('P30D')
    RETURN s.sector AS sector, count(*) AS interest_count
    ORDER BY interest_count DESC, sector ASC
    """
    with get_session() as session:
        items = [record.data() for record in session.run(query)]

    cache_set(cache_key, items, ttl=120)
    return {"source": "db", "items": items}


@router.get("/influence")
async def get_influence():
    cache_key = "analytics:influence"
    cached = cache_get(cache_key)
    if cached is not None:
        return {"source": "cache", "items": cached}

    query = """
    MATCH (n)
    OPTIONAL MATCH (n)-[*1..2]-(neighbor)
    WITH n, count(DISTINCT neighbor) AS influence_score
    RETURN {
      id: n.id,
      label: head(labels(n)),
      name: coalesce(n.name, n.id),
      influence_score: influence_score
    } AS item
    ORDER BY item.influence_score DESC, item.name ASC
    """
    with get_session() as session:
        items = [record.data()["item"] for record in session.run(query)]

    cache_set(cache_key, items, ttl=600)
    return {"source": "db", "items": items}
