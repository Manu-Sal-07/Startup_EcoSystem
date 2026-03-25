from backend.db import cache_delete, cache_get, cache_set, get_session

MATCH_TTL = 300


STARTUP_MATCH_QUERY = """
MATCH (i:Investor), (s:Startup {id: $startup_id})
WITH i, s,
  CASE WHEN s.sector IN i.preferred_sectors THEN 40 ELSE 0 END AS sector_score,
  CASE
    WHEN i.ticket_min <= s.funding_ask AND s.funding_ask <= i.ticket_max THEN 30
    WHEN i.ticket_min <= s.funding_ask * 1.2 THEN 15
    ELSE 0
  END AS ticket_score,
  CASE WHEN s.stage IN i.stage_focus THEN 20 ELSE 0 END AS stage_score
OPTIONAL MATCH path = (i)-[:INVESTED_IN*1..2]->(other:Startup)
WHERE other.sector = s.sector
WITH i, sector_score, ticket_score, stage_score,
  CASE WHEN count(path) > 0 THEN 10 ELSE 0 END AS network_score
OPTIONAL MATCH (s)-[:HAS_ACHIEVEMENT]->(a:Achievement)
WHERE a.date >= date() - duration({days: 90})
WITH i, s, sector_score, ticket_score, stage_score, network_score,
  CASE WHEN count(a) >= 3 THEN 10 ELSE 0 END AS achievement_score
WITH i, sector_score, ticket_score, stage_score, network_score, achievement_score,
  (sector_score + ticket_score + stage_score + network_score + achievement_score) AS total_score
WHERE total_score > 0
RETURN
  i.id AS id,
  i.name AS name,
  i.firm AS firm,
  i.type AS type,
  total_score,
  sector_score,
  ticket_score,
  stage_score,
  network_score,
  achievement_score
ORDER BY total_score DESC, name ASC
LIMIT 10
"""

RELATED_MATCH_CACHE_QUERY = """
MATCH (s:Startup {id: $startup_id})
OPTIONAL MATCH (peer:Startup)
WHERE peer.sector = s.sector
WITH s, collect(DISTINCT peer.id) AS startup_ids
OPTIONAL MATCH (i:Investor)
WHERE s.sector IN i.preferred_sectors
RETURN startup_ids, collect(DISTINCT i.id) AS investor_ids
"""


INVESTOR_MATCH_QUERY = """
MATCH (i:Investor {id: $investor_id}), (s:Startup)
WITH i, s,
  CASE WHEN s.sector IN i.preferred_sectors THEN 40 ELSE 0 END AS sector_score,
  CASE
    WHEN i.ticket_min <= s.funding_ask AND s.funding_ask <= i.ticket_max THEN 30
    WHEN i.ticket_min <= s.funding_ask * 1.2 THEN 15
    ELSE 0
  END AS ticket_score,
  CASE WHEN s.stage IN i.stage_focus THEN 20 ELSE 0 END AS stage_score
OPTIONAL MATCH path = (i)-[:INVESTED_IN*1..2]->(other:Startup)
WHERE other.sector = s.sector
WITH s, sector_score, ticket_score, stage_score,
  CASE WHEN count(path) > 0 THEN 10 ELSE 0 END AS network_score
OPTIONAL MATCH (s)-[:HAS_ACHIEVEMENT]->(a:Achievement)
WHERE a.date >= date() - duration({days: 90})
WITH s, sector_score, ticket_score, stage_score, network_score,
  CASE WHEN count(a) >= 3 THEN 10 ELSE 0 END AS achievement_score
WITH s, sector_score, ticket_score, stage_score, network_score, achievement_score,
  (sector_score + ticket_score + stage_score + network_score + achievement_score) AS total_score
WHERE total_score > 0
RETURN
  s.id AS id,
  s.name AS name,
  s.sector AS sector,
  s.stage AS stage,
  s.funding_ask AS funding_ask,
  total_score,
  sector_score,
  ticket_score,
  stage_score,
  network_score,
  achievement_score
ORDER BY total_score DESC, name ASC
LIMIT 10
"""


def _query_matches(query: str, **params):
    with get_session() as session:
        records = session.run(query, **params)
        return [record.data() for record in records]


def _get_related_match_ids(startup_id: str):
    with get_session() as session:
        record = session.run(RELATED_MATCH_CACHE_QUERY, startup_id=startup_id).single()
    if record is None:
        return {"startup_ids": [startup_id], "investor_ids": []}
    data = record.data()
    startup_ids = [item for item in data.get("startup_ids", []) if item]
    investor_ids = [item for item in data.get("investor_ids", []) if item]
    if startup_id not in startup_ids:
        startup_ids.append(startup_id)
    return {"startup_ids": startup_ids, "investor_ids": investor_ids}


def compute_matches(startup_id: str):
    matches = _query_matches(STARTUP_MATCH_QUERY, startup_id=startup_id)
    cache_set(f"matches:startup:{startup_id}", matches, ttl=MATCH_TTL)
    return matches


def compute_matches_for_investor(investor_id: str):
    matches = _query_matches(INVESTOR_MATCH_QUERY, investor_id=investor_id)
    cache_set(f"matches:investor:{investor_id}", matches, ttl=MATCH_TTL)
    return matches


def get_cached_or_compute_startup_matches(startup_id: str):
    cache_key = f"matches:startup:{startup_id}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    return compute_matches(startup_id)


def get_cached_or_compute_investor_matches(investor_id: str):
    cache_key = f"matches:investor:{investor_id}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    return compute_matches_for_investor(investor_id)


def invalidate_match_caches(startup_id: str, investor_id: str | None = None):
    keys = [f"matches:startup:{startup_id}"]
    if investor_id:
        keys.append(f"matches:investor:{investor_id}")
    cache_delete(*keys)


def invalidate_related_match_caches(startup_id: str):
    related = _get_related_match_ids(startup_id)
    keys = [f"matches:startup:{item}" for item in related["startup_ids"]]
    keys.extend(f"matches:investor:{item}" for item in related["investor_ids"])
    cache_delete(*keys)
    return related


def refresh_related_matches(startup_id: str, investor_id: str | None = None):
    related = invalidate_related_match_caches(startup_id)
    compute_matches(startup_id)
    if investor_id:
        compute_matches_for_investor(investor_id)
    return related
