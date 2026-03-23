from contextlib import contextmanager

from fastapi.testclient import TestClient

from backend.app import app
from backend import matching


class FakeRecord:
    def __init__(self, payload):
        self.payload = payload

    def data(self):
        return self.payload


class FakeResult(list):
    def single(self):
        return self[0] if self else None

    def consume(self):
        return None


class FakeSession:
    def __init__(self, responses=None):
        self.responses = responses or []
        self.calls = []

    def run(self, query, **params):
        self.calls.append({"query": query, "params": params})
        response = self.responses.pop(0) if self.responses else FakeResult()
        return response


@contextmanager
def fake_session_context(session):
    yield session


def test_health(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)
    monkeypatch.setattr("backend.app.neo4j_client.verify_connectivity", lambda: True)

    class FakeRedis:
        def ping(self):
            return True

    monkeypatch.setattr("backend.app.redis_client.r", FakeRedis())

    with TestClient(app) as client:
        resp = client.get("/health")

    assert resp.status_code == 200
    assert resp.json() == {"neo4j": "ok", "redis": "ok"}


def test_root_serves_frontend(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)

    with TestClient(app) as client:
        resp = client.get("/")

    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]
    assert "Startup Ecosystem Analytics" in resp.text


def test_seed(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)
    monkeypatch.setattr(
        "backend.app.seed_data.run_seed",
        lambda: {
            "startups": 100,
            "investors": 40,
            "founders": 50,
            "relationships": 205,
        },
    )

    with TestClient(app) as client:
        resp = client.post("/seed")

    assert resp.status_code == 200
    assert resp.json()["relationships"] >= 180


def test_get_startup_uses_cache(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)
    monkeypatch.setattr(
        "backend.routes.startups.cache_get",
        lambda key: {"id": "startup-1", "name": "Cached Startup"} if key == "profile:startup:startup-1" else None,
    )

    with TestClient(app) as client:
        resp = client.get("/startups/startup-1")

    assert resp.status_code == 200
    assert resp.json()["source"] == "cache"
    assert resp.json()["item"]["name"] == "Cached Startup"


def test_register_startup_creates_node_and_invalidates_feed(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)
    session = FakeSession([FakeResult()])
    created = {}
    invalidated = []
    related_invalidations = []
    matched = []

    monkeypatch.setattr("backend.routes.startups.get_session", lambda: fake_session_context(session))
    monkeypatch.setattr("backend.routes.startups.cache_set", lambda key, value, ttl: created.update({"key": key, "value": value, "ttl": ttl}))
    monkeypatch.setattr("backend.routes.startups.cache_delete_pattern", lambda pattern: invalidated.append(pattern))
    monkeypatch.setattr("backend.routes.startups.invalidate_related_match_caches", lambda startup_id: related_invalidations.append(startup_id))
    monkeypatch.setattr("backend.routes.startups.compute_matches", lambda startup_id: matched.append(startup_id))

    payload = {
        "name": "Signal Forge",
        "sector": "AI/ML",
        "stage": "Seed",
        "funding_ask": 500000,
        "equity_offered": 10,
        "pitch": "AI tooling",
        "team_size": 8,
        "revenue": 12000,
        "founded": 2024,
    }

    with TestClient(app) as client:
        resp = client.post("/startups/register", json=payload)

    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == payload["name"]
    assert created["key"] == f"profile:startup:{body['id']}"
    assert invalidated == ["feed:filtered:*"]
    assert related_invalidations == [body["id"]]
    assert matched == [body["id"]]
    assert session.calls


def test_connections_uses_cache(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)
    monkeypatch.setattr(
        "backend.routes.connections.cache_get",
        lambda key: [{"investor_id": "inv-1", "status": "pending"}] if key == "connections:start-1" else None,
    )

    with TestClient(app) as client:
        resp = client.get("/connections/start-1")

    assert resp.status_code == 200
    assert resp.json()["source"] == "cache"
    assert resp.json()["items"][0]["investor_id"] == "inv-1"


def test_interest_refreshes_match_caches(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)
    session = FakeSession([FakeResult()])
    deleted = []
    invalidated = []
    refreshed = []

    class FakeRedis:
        def zincrby(self, key, amount, member):
            refreshed.append((key, amount, member))

    monkeypatch.setattr("backend.routes.connections.get_session", lambda: fake_session_context(session))
    monkeypatch.setattr("backend.routes.connections.cache_delete", lambda *keys: deleted.extend(keys))
    monkeypatch.setattr("backend.routes.connections.r", FakeRedis())
    monkeypatch.setattr(
        "backend.routes.connections.invalidate_match_caches",
        lambda startup_id, investor_id=None: invalidated.append((startup_id, investor_id)),
    )
    monkeypatch.setattr(
        "backend.routes.connections.refresh_related_matches",
        lambda startup_id, investor_id=None: refreshed.append(("refresh", startup_id, investor_id)),
    )

    payload = {
        "investor_id": "inv-1",
        "startup_id": "start-1",
        "message": "Interested",
        "proposed_amount": 300000,
    }

    with TestClient(app) as client:
        resp = client.post("/connect/interest", json=payload)

    assert resp.status_code == 200
    assert "profile:investor:inv-1" in deleted
    assert "profile:startup:start-1" in deleted
    assert invalidated == [("start-1", "inv-1")]
    assert ("leaderboard:investors", 1, "inv-1") in refreshed
    assert ("refresh", "start-1", "inv-1") in refreshed


def test_leaderboard_reads_sorted_set(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)

    class FakeRedis:
        def zrevrange(self, key, start, stop, withscores=False):
            assert key == "leaderboard:investors"
            assert withscores is True
            return [("inv-7", 5.0), ("inv-2", 3.0)]

    monkeypatch.setattr("backend.routes.analytics.r", FakeRedis())

    with TestClient(app) as client:
        resp = client.get("/analytics/leaderboard")

    assert resp.status_code == 200
    assert resp.json()["items"][0] == {"investor_id": "inv-7", "score": 5.0}


def test_phase4_match_query_contains_weighted_components():
    query = matching.STARTUP_MATCH_QUERY
    assert "THEN 40" in query
    assert "THEN 30" in query
    assert "THEN 20" in query
    assert "THEN 10" in query
    assert "[:INVESTED_IN*1..2]" in query


def test_invalidate_related_match_caches_removes_sector_related_keys(monkeypatch):
    monkeypatch.setattr(
        "backend.matching.get_session",
        lambda: fake_session_context(
            FakeSession(
                [
                    FakeResult(
                        [
                            FakeRecord(
                                {
                                    "startup_ids": ["start-1", "start-2"],
                                    "investor_ids": ["inv-1", "inv-2"],
                                }
                            )
                        ]
                    )
                ]
            )
        ),
    )
    deleted = []
    monkeypatch.setattr("backend.matching.cache_delete", lambda *keys: deleted.extend(keys))

    related = matching.invalidate_related_match_caches("start-1")

    assert related == {"startup_ids": ["start-1", "start-2"], "investor_ids": ["inv-1", "inv-2"]}
    assert "matches:startup:start-1" in deleted
    assert "matches:startup:start-2" in deleted
    assert "matches:investor:inv-1" in deleted
    assert "matches:investor:inv-2" in deleted
