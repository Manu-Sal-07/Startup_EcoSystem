from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.auth import create_token, hash_password
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


class FakeTransaction(FakeSession):
    def __init__(self, responses=None):
        super().__init__(responses=responses)
        self.committed = False
        self.rolled_back = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True


class FakeDriverSession:
    def __init__(self, transaction):
        self.transaction = transaction

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def begin_transaction(self):
        return self.transaction


class FakeDriver:
    def __init__(self, transaction):
        self.transaction = transaction

    def session(self):
        return FakeDriverSession(self.transaction)


@contextmanager
def fake_session_context(session):
    yield session


def auth_headers(role: str, user_id: str = "user-1", name: str = "Test User"):
    token = create_token(user_id=user_id, role=role, name=name)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def auth_test_defaults(monkeypatch):
    monkeypatch.setattr("backend.auth.is_blacklisted", lambda jti: False)


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
    assert "Startup Ecosystem Platform" in resp.text
    assert "Register" in resp.text


def test_favicon_does_not_404(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)

    with TestClient(app) as client:
        resp = client.get("/favicon.ico")

    assert resp.status_code == 204


def test_login_returns_token(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)
    monkeypatch.setattr(
        "backend.auth.get_user_by_email",
        lambda email: {
            "id": "analyst_01",
            "role": "ANALYST",
            "pw": hash_password("analyst123"),
            "name": "Platform Analyst",
        }
        if email == "analyst@platform.com"
        else None,
    )

    with TestClient(app) as client:
        resp = client.post("/auth/login", json={"email": "analyst@platform.com", "password": "analyst123"})

    assert resp.status_code == 200
    assert resp.json()["role"] == "ANALYST"
    assert "token" in resp.json()


def test_login_normalizes_email_before_lookup(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)
    looked_up = []

    def fake_lookup(email):
        looked_up.append(email)
        return {
            "id": "startup_01",
            "role": "STARTUP",
            "pw": hash_password("password123"),
            "name": "Orbit Labs",
        }

    monkeypatch.setattr("backend.auth.get_user_by_email", fake_lookup)

    with TestClient(app) as client:
        resp = client.post("/auth/login", json={"email": "  Founder@OrbitLabs.com ", "password": "password123"})

    assert resp.status_code == 200
    assert looked_up == ["founder@orbitlabs.com"]


def test_signup_startup_creates_account_and_returns_token(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)
    monkeypatch.setattr("backend.auth.get_user_by_email", lambda email: None)
    session = FakeSession([FakeResult()])
    cached = {}

    monkeypatch.setattr("backend.auth.get_session", lambda: fake_session_context(session))
    monkeypatch.setattr("backend.auth.cache_set", lambda key, value, ttl: cached.update({"key": key, "value": value, "ttl": ttl}))

    payload = {
        "name": "Orbit Labs",
        "email": "founder@orbitlabs.com",
        "password": "secret123",
        "sector": "AI/ML",
        "stage": "Seed",
        "funding_ask": 600000,
        "equity_offered": 12,
        "pitch": "Automation for operations teams",
        "team_size": 7,
        "revenue": 50000,
        "founded": 2025,
    }

    with TestClient(app) as client:
        resp = client.post("/auth/signup/startup", json=payload)

    assert resp.status_code == 200
    body = resp.json()
    assert body["role"] == "STARTUP"
    assert body["name"] == "Orbit Labs"
    assert "token" in body
    assert cached["key"] == f"profile:startup:{body['id']}"
    assert session.calls


def test_signup_investor_creates_account_and_returns_token(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)
    monkeypatch.setattr("backend.auth.get_user_by_email", lambda email: None)
    session = FakeSession([FakeResult()])
    cached = {}
    leaderboard = []

    class FakeRedis:
        def zadd(self, key, payload):
            leaderboard.append((key, payload))

        def sadd(self, *args, **kwargs):
            return None

        def expire(self, *args, **kwargs):
            return None

    monkeypatch.setattr("backend.auth.get_session", lambda: fake_session_context(session))
    monkeypatch.setattr("backend.auth.cache_set", lambda key, value, ttl: cached.update({"key": key, "value": value, "ttl": ttl}))
    monkeypatch.setattr("backend.auth.r", FakeRedis())

    payload = {
        "name": "Aarav Shah",
        "email": "aarav@vc.com",
        "password": "secret123",
        "firm": "Summit Capital",
        "type": "VC",
        "ticket_min": 100000,
        "ticket_max": 900000,
        "preferred_sectors": ["AI/ML", "SaaS"],
        "stage_focus": ["Seed", "Series A"],
        "bio": "Backs applied AI founders.",
    }

    with TestClient(app) as client:
        resp = client.post("/auth/signup/investor", json=payload)

    assert resp.status_code == 200
    body = resp.json()
    assert body["role"] == "INVESTOR"
    assert "token" in body
    assert cached["key"] == f"profile:investor:{body['id']}"
    assert leaderboard == [("leaderboard:investors", {body["id"]: 0})]


def test_signup_blocks_duplicate_email(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)
    monkeypatch.setattr("backend.auth.get_user_by_email", lambda email: {"id": "existing-user"})

    with TestClient(app) as client:
        resp = client.post(
            "/auth/signup/startup",
            json={
                "name": "Orbit Labs",
                "email": "founder@orbitlabs.com",
                "password": "secret123",
                "sector": "AI/ML",
                "stage": "Seed",
                "funding_ask": 600000,
                "equity_offered": 12,
                "pitch": "Automation for operations teams",
                "team_size": 7,
                "revenue": 50000,
                "founded": 2025,
            },
        )

    assert resp.status_code == 409


def test_logout_blacklists_token(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)
    blacklisted = set()
    monkeypatch.setattr("backend.auth.blacklist_token", lambda jti, ttl: blacklisted.add(jti))
    monkeypatch.setattr("backend.auth.is_blacklisted", lambda jti: jti in blacklisted)
    headers = auth_headers("ANALYST", user_id="analyst_01", name="Platform Analyst")

    with TestClient(app) as client:
        logout_resp = client.post("/auth/logout", headers=headers)
        me_resp = client.get("/auth/me", headers=headers)

    assert logout_resp.status_code == 200
    assert me_resp.status_code == 401


def test_refresh_returns_new_token(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)
    monkeypatch.setattr("backend.auth.is_blacklisted", lambda jti: False)

    with TestClient(app) as client:
        resp = client.post("/auth/refresh", headers=auth_headers("ANALYST", user_id="analyst_01", name="Platform Analyst"))

    assert resp.status_code == 200
    body = resp.json()
    assert body["role"] == "ANALYST"
    assert body["id"] == "analyst_01"
    assert "token" in body


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
        resp = client.get("/startups/startup-1", headers=auth_headers("INVESTOR"))

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
        resp = client.post("/startups/register", json=payload, headers=auth_headers("STARTUP", user_id="start-user"))

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
        resp = client.get("/connections/start-1", headers=auth_headers("ANALYST"))

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
        resp = client.post("/connect/interest", json=payload, headers=auth_headers("INVESTOR", user_id="inv-1"))

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
        resp = client.get("/analytics/leaderboard", headers=auth_headers("ANALYST"))

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


def test_analytics_requires_token(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)

    with TestClient(app) as client:
        resp = client.get("/analytics/network")

    assert resp.status_code == 401


def test_wrong_role_blocked_for_startup_register(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)
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
        resp = client.post("/startups/register", json=payload, headers=auth_headers("INVESTOR", user_id="inv-1"))

    assert resp.status_code == 403


def test_post_achievement_creates_node_and_invalidates_cache(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)
    session = FakeSession([FakeResult([FakeRecord({"ach_id": "ach_1234"})])])
    deleted = []
    counters = []

    class FakeRedis:
        def hincrby(self, key, field, amount):
            counters.append((key, field, amount))

    monkeypatch.setattr("backend.routes.achievements.get_session", lambda: fake_session_context(session))
    monkeypatch.setattr("backend.routes.achievements.cache_delete", lambda *keys: deleted.extend(keys))
    monkeypatch.setattr("backend.routes.achievements.r", FakeRedis())

    payload = {
        "type": "funding",
        "title": "Closed bridge round",
        "description": "Secured a strategic bridge round from angels",
        "value": 2500000,
        "date": "2026-03-01",
        "media_url": None,
    }

    with TestClient(app) as client:
        resp = client.post("/achievements/post", json=payload, headers=auth_headers("STARTUP", user_id="start-1"))

    assert resp.status_code == 200
    assert resp.json()["startup_id"] == "start-1"
    assert "achievements:start-1" in deleted
    assert ("meta:startup:start-1", "achievement_count", 1) in counters


def test_get_achievements_uses_cache(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)
    monkeypatch.setattr(
        "backend.routes.achievements.cache_get",
        lambda key: [{"title": "Cached milestone"}] if key == "achievements:start-1" else None,
    )

    with TestClient(app) as client:
        resp = client.get("/startups/start-1/achievements", headers=auth_headers("INVESTOR", user_id="inv-1"))

    assert resp.status_code == 200
    assert resp.json()["source"] == "cache"
    assert resp.json()["items"][0]["title"] == "Cached milestone"


def test_analyst_can_fetch_achievement_leaders(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)
    session = FakeSession([FakeResult([FakeRecord({"name": "Nova Forge", "sector": "AI/ML", "ach_count": 3, "types": ["product"]})])])
    monkeypatch.setattr("backend.routes.achievements.get_session", lambda: fake_session_context(session))

    with TestClient(app) as client:
        resp = client.get("/analytics/achievement-leaders", headers=auth_headers("ANALYST", user_id="analyst_01"))

    assert resp.status_code == 200
    assert resp.json()["items"][0]["ach_count"] == 3


def test_phase2_match_query_contains_achievement_score():
    assert "achievement_score" in matching.STARTUP_MATCH_QUERY
    assert "achievement_score" in matching.INVESTOR_MATCH_QUERY
    assert "+ achievement_score" in matching.STARTUP_MATCH_QUERY


def test_transfer_funds_commits_and_updates_caches(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)
    transaction = FakeTransaction(
        [
            FakeResult([FakeRecord({"bal": 500000.0})]),
            FakeResult([FakeRecord({"ask": 300000.0, "recv": 100000.0})]),
            FakeResult(),
            FakeResult(),
            FakeResult(),
        ]
    )
    deleted = []
    released = []
    leaderboard = []

    class FakeRedis:
        def zincrby(self, key, amount, member):
            leaderboard.append((key, amount, member))

        def get(self, key):
            return None

    monkeypatch.setattr("backend.routes.funds.acquire_fund_lock", lambda startup_id: "lock-123")
    monkeypatch.setattr("backend.routes.funds.release_fund_lock", lambda startup_id, token: released.append((startup_id, token)) or True)
    monkeypatch.setattr("backend.routes.funds.get_driver", lambda: FakeDriver(transaction))
    monkeypatch.setattr("backend.routes.funds.cache_delete", lambda *keys: deleted.extend(keys))
    monkeypatch.setattr("backend.routes.funds.r", FakeRedis())

    with TestClient(app) as client:
        resp = client.post(
            "/funds/transfer",
            json={"startup_id": "start-1", "amount": 50000},
            headers=auth_headers("INVESTOR", user_id="inv-1"),
        )

    assert resp.status_code == 200
    assert resp.json()["status"] == "transferred"
    assert transaction.committed is True
    assert released == [("start-1", "lock-123")]
    assert "profile:startup:start-1" in deleted
    assert "profile:investor:inv-1" in deleted
    assert ("leaderboard:investors", 50000, "inv-1") in leaderboard


def test_transfer_funds_blocks_oversubscription(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)
    transaction = FakeTransaction(
        [
            FakeResult([FakeRecord({"bal": 500000.0})]),
            FakeResult([FakeRecord({"ask": 150000.0, "recv": 120000.0})]),
        ]
    )
    released = []
    leaderboard = []

    class FakeRedis:
        def zincrby(self, key, amount, member):
            leaderboard.append((key, amount, member))

        def get(self, key):
            return None

    monkeypatch.setattr("backend.routes.funds.acquire_fund_lock", lambda startup_id: "lock-456")
    monkeypatch.setattr("backend.routes.funds.release_fund_lock", lambda startup_id, token: released.append((startup_id, token)) or True)
    monkeypatch.setattr("backend.routes.funds.get_driver", lambda: FakeDriver(transaction))
    monkeypatch.setattr("backend.routes.funds.r", FakeRedis())

    with TestClient(app) as client:
        resp = client.post(
            "/funds/transfer",
            json={"startup_id": "start-1", "amount": 50000},
            headers=auth_headers("INVESTOR", user_id="inv-1"),
        )

    assert resp.status_code == 409
    assert transaction.rolled_back is True
    assert transaction.committed is False
    assert released == [("start-1", "lock-456")]
    assert leaderboard == []


def test_funding_progress_reports_percentage_and_lock(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)
    session = FakeSession([FakeResult([FakeRecord({"name": "Signal Forge", "funding_ask": 400000.0, "received_funding": 100000.0})])])

    class FakeRedis:
        def get(self, key):
            return "lock-token"

    monkeypatch.setattr("backend.routes.funds.get_session", lambda: fake_session_context(session))
    monkeypatch.setattr("backend.routes.funds.r", FakeRedis())

    with TestClient(app) as client:
        resp = client.get("/startups/start-1/funding-progress", headers=auth_headers("ANALYST", user_id="analyst_01"))

    assert resp.status_code == 200
    assert resp.json()["percentage"] == 25.0
    assert resp.json()["is_locked"] is True


def test_wallet_topup_updates_balance_and_invalidates_profile(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)
    session = FakeSession([FakeResult([FakeRecord({"investor_id": "inv-1", "wallet_balance": 650000.0})])])
    deleted = []

    monkeypatch.setattr("backend.routes.funds.get_session", lambda: fake_session_context(session))
    monkeypatch.setattr("backend.routes.funds.cache_delete", lambda *keys: deleted.extend(keys))

    with TestClient(app) as client:
        resp = client.post(
            "/wallet/topup",
            json={"investor_id": "inv-1", "amount": 150000},
            headers=auth_headers("ANALYST", user_id="analyst_01"),
        )

    assert resp.status_code == 200
    assert resp.json()["status"] == "topped_up"
    assert resp.json()["wallet_balance"] == 650000.0
    assert deleted == ["profile:investor:inv-1"]


def test_funding_history_is_limited_to_current_investor(monkeypatch):
    monkeypatch.setattr("backend.app.neo4j_client.ensure_indexes", lambda: None)

    with TestClient(app) as client:
        resp = client.get("/funds/history/inv-2", headers=auth_headers("INVESTOR", user_id="inv-1"))

    assert resp.status_code == 403
