import os
from contextlib import contextmanager

try:
    from neo4j import GraphDatabase
except ImportError:  # pragma: no cover - exercised in dependency-light test envs
    GraphDatabase = None

NEO4J_URI = os.getenv('NEO4J_URI', 'bolt://localhost:7687')
NEO4J_USER = os.getenv('NEO4J_USER', 'neo4j')
NEO4J_PASSWORD = os.getenv('NEO4J_PASSWORD', 'password123')

_driver = None

INDEX_STATEMENTS = (
    "CREATE INDEX startup_id IF NOT EXISTS FOR (s:Startup) ON (s.id)",
    "CREATE INDEX investor_id IF NOT EXISTS FOR (i:Investor) ON (i.id)",
    "CREATE INDEX startup_sector IF NOT EXISTS FOR (s:Startup) ON (s.sector)",
    "CREATE INDEX startup_stage IF NOT EXISTS FOR (s:Startup) ON (s.stage)",
)

def get_driver():
    global _driver
    if GraphDatabase is None:
        raise RuntimeError("neo4j package is not installed")
    if _driver is None:
        _driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    return _driver

@contextmanager
def get_session():
    driver = get_driver()
    session = driver.session()
    try:
        yield session
    finally:
        session.close()

def verify_connectivity():
    try:
        driver = get_driver()
        driver.verify_connectivity()
        return True
    except Exception:
        return False


def ensure_indexes():
    with get_session() as session:
        for statement in INDEX_STATEMENTS:
            session.run(statement).consume()
