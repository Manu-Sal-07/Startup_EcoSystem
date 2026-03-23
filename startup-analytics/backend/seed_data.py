import random
from collections import defaultdict
from uuid import uuid4

from backend.db.neo4j_client import ensure_indexes, get_session
from backend.db.redis_client import cache_set, r

SECTORS = [
    "FinTech",
    "HealthTech",
    "EdTech",
    "CleanTech",
    "SaaS",
    "AI/ML",
    "E-commerce",
    "BioTech",
]
STAGES = ["Pre-Seed", "Seed", "Series A", "Series B"]
INVESTOR_TYPES = ["Angel", "VC", "Corporate VC", "Family Office"]

STARTUP_PREFIXES = [
    "Nova",
    "Pulse",
    "Orbit",
    "Summit",
    "Lumen",
    "Vertex",
    "Atlas",
    "Nimbus",
    "Quantum",
    "Cedar",
]
STARTUP_SUFFIXES = [
    "Labs",
    "Works",
    "Flow",
    "Grid",
    "IQ",
    "Bridge",
    "Forge",
    "Scale",
    "Sync",
    "Cloud",
]
FOUNDER_FIRST_NAMES = [
    "Aarav",
    "Maya",
    "Rohan",
    "Isha",
    "Dev",
    "Anika",
    "Kabir",
    "Nina",
    "Vihaan",
    "Sara",
]
FOUNDER_LAST_NAMES = [
    "Shah",
    "Patel",
    "Rao",
    "Mehta",
    "Kapoor",
    "Iyer",
    "Singh",
    "Gupta",
    "Nair",
    "Malhotra",
]
INVESTOR_FIRST_NAMES = [
    "Emma",
    "Noah",
    "Olivia",
    "Liam",
    "Sophia",
    "Ethan",
    "Ava",
    "Mason",
    "Isabella",
    "Lucas",
]
INVESTOR_LAST_NAMES = [
    "Chen",
    "Brooks",
    "Reed",
    "Turner",
    "Bailey",
    "Ward",
    "Parker",
    "Foster",
    "Gray",
    "Hayes",
]
FIRM_PREFIXES = [
    "Northstar",
    "BluePeak",
    "Catalyst",
    "Riverbend",
    "Summit",
    "Horizon",
    "Arc",
    "Pioneer",
]
FIRM_SUFFIXES = ["Ventures", "Capital", "Partners", "Holdings"]


def _startup_name(index: int) -> str:
    return f"{STARTUP_PREFIXES[index % len(STARTUP_PREFIXES)]} {STARTUP_SUFFIXES[(index * 3) % len(STARTUP_SUFFIXES)]}"


def _person_name(index: int, first_names: list[str], last_names: list[str]) -> str:
    return f"{first_names[index % len(first_names)]} {last_names[(index * 2) % len(last_names)]}"


def _firm_name(index: int) -> str:
    return f"{FIRM_PREFIXES[index % len(FIRM_PREFIXES)]} {FIRM_SUFFIXES[(index * 5) % len(FIRM_SUFFIXES)]}"


def generate_seed_payload(seed: int = 42) -> dict:
    rng = random.Random(seed)

    startups = []
    for index in range(100):
        sector = SECTORS[index % len(SECTORS)]
        stage = STAGES[index % len(STAGES)]
        funding_ask = round(rng.uniform(50_000, 10_000_000), 2)
        startups.append(
            {
                "id": str(uuid4()),
                "name": f"{_startup_name(index)} {index + 1}",
                "sector": sector,
                "stage": stage,
                "funding_ask": funding_ask,
                "equity_offered": round(rng.uniform(5, 20), 2),
                "pitch": f"{sector} company building data-driven products for the {stage.lower()} market.",
                "team_size": rng.randint(3, 150),
                "revenue": round(rng.uniform(0, 5_000_000), 2),
                "founded": rng.randint(2016, 2025),
            }
        )

    investors = []
    for index in range(40):
        ticket_min = rng.choice([25_000, 50_000, 100_000, 250_000, 500_000])
        ticket_max = ticket_min * rng.randint(4, 20)
        investors.append(
            {
                "id": str(uuid4()),
                "name": _person_name(index, INVESTOR_FIRST_NAMES, INVESTOR_LAST_NAMES),
                "firm": _firm_name(index),
                "type": INVESTOR_TYPES[index % len(INVESTOR_TYPES)],
                "ticket_min": float(ticket_min),
                "ticket_max": float(ticket_max),
                "preferred_sectors": rng.sample(SECTORS, k=rng.randint(2, 4)),
                "stage_focus": rng.sample(STAGES, k=rng.randint(1, 3)),
                "bio": f"Active {INVESTOR_TYPES[index % len(INVESTOR_TYPES)]} investing in early growth teams.",
            }
        )

    founders = []
    for index, startup in enumerate(rng.sample(startups, k=50)):
        founders.append(
            {
                "id": str(uuid4()),
                "name": _person_name(index, FOUNDER_FIRST_NAMES, FOUNDER_LAST_NAMES),
                "background": rng.choice(
                    [
                        "Product and growth",
                        "Deep tech research",
                        "Operations and finance",
                        "Commercial strategy",
                    ]
                ),
                "startup_id": startup["id"],
            }
        )

    invested_pairs = set()
    investments = []
    while len(investments) < 80:
        investor = rng.choice(investors)
        startup = rng.choice(startups)
        pair = (investor["id"], startup["id"])
        if pair in invested_pairs:
            continue
        invested_pairs.add(pair)
        investments.append(
            {
                "investor_id": investor["id"],
                "startup_id": startup["id"],
                "amount": round(rng.uniform(investor["ticket_min"], investor["ticket_max"]), 2),
            }
        )

    startups_by_sector = defaultdict(list)
    for startup in startups:
        startups_by_sector[startup["sector"]].append(startup)

    competes_pairs = set()
    competes_with = []
    for sector_startups in startups_by_sector.values():
        for index, startup in enumerate(sector_startups):
            for competitor in sector_startups[index + 1 : index + 4]:
                pair = tuple(sorted((startup["id"], competitor["id"])))
                if pair in competes_pairs:
                    continue
                competes_pairs.add(pair)
                competes_with.append({"startup_id": pair[0], "competitor_id": pair[1]})

    return {
        "startups": startups,
        "investors": investors,
        "founders": founders,
        "investments": investments,
        "competes_with": competes_with,
    }


def run_seed(seed: int = 42) -> dict:
    payload = generate_seed_payload(seed=seed)
    leaderboard_scores = defaultdict(int)

    ensure_indexes()

    with get_session() as session:
        session.run("MATCH (n) DETACH DELETE n").consume()

        session.run(
            """
            UNWIND $startups AS startup
            CREATE (:Startup {
                id: startup.id,
                name: startup.name,
                sector: startup.sector,
                stage: startup.stage,
                funding_ask: startup.funding_ask,
                equity_offered: startup.equity_offered,
                pitch: startup.pitch,
                team_size: startup.team_size,
                revenue: startup.revenue,
                founded: startup.founded,
                created_at: datetime()
            })
            """,
            startups=payload["startups"],
        ).consume()

        session.run(
            """
            UNWIND $investors AS investor
            CREATE (:Investor {
                id: investor.id,
                name: investor.name,
                firm: investor.firm,
                type: investor.type,
                ticket_min: investor.ticket_min,
                ticket_max: investor.ticket_max,
                preferred_sectors: investor.preferred_sectors,
                stage_focus: investor.stage_focus,
                bio: investor.bio,
                created_at: datetime()
            })
            """,
            investors=payload["investors"],
        ).consume()

        session.run(
            """
            UNWIND $founders AS founder
            MATCH (s:Startup {id: founder.startup_id})
            CREATE (f:Founder {
                id: founder.id,
                name: founder.name,
                background: founder.background,
                created_at: datetime()
            })
            CREATE (f)-[:FOUNDED {date: datetime()}]->(s)
            """,
            founders=payload["founders"],
        ).consume()

        session.run(
            """
            UNWIND $investments AS investment
            MATCH (i:Investor {id: investment.investor_id})
            MATCH (s:Startup {id: investment.startup_id})
            CREATE (i)-[:INVESTED_IN {
                amount: investment.amount,
                date: datetime()
            }]->(s)
            """,
            investments=payload["investments"],
        ).consume()

        session.run(
            """
            UNWIND $relationships AS relationship
            MATCH (s1:Startup {id: relationship.startup_id})
            MATCH (s2:Startup {id: relationship.competitor_id})
            CREATE (s1)-[:COMPETES_WITH {date: datetime()}]->(s2)
            """,
            relationships=payload["competes_with"],
        ).consume()

    try:
        r.flushdb()
    except Exception:
        pass

    for startup in payload["startups"]:
        cache_set(f"profile:startup:{startup['id']}", startup, ttl=600)
    for investor in payload["investors"]:
        cache_set(f"profile:investor:{investor['id']}", investor, ttl=600)
    for founder in payload["founders"]:
        cache_set(f"profile:founder:{founder['id']}", founder, ttl=600)

    for investment in payload["investments"]:
        leaderboard_scores[investment["investor_id"]] += 1

    if leaderboard_scores:
        r.zadd("leaderboard:investors", leaderboard_scores)

    relationships = (
        len(payload["founders"])
        + len(payload["investments"])
        + len(payload["competes_with"])
    )
    return {
        "startups": len(payload["startups"]),
        "investors": len(payload["investors"]),
        "founders": len(payload["founders"]),
        "relationships": relationships,
    }


if __name__ == "__main__":
    print(run_seed())
