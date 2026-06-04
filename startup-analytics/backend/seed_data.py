import random
import re
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.auth import hash_password
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
_today = date.today()
RECENT_ACHIEVEMENT_DATES = [
    (_today - timedelta(days=60)).isoformat(),
    (_today - timedelta(days=30)).isoformat(),
    (_today - timedelta(days=5)).isoformat(),
]


def _startup_name(index: int) -> str:
    return f"{STARTUP_PREFIXES[index % len(STARTUP_PREFIXES)]} {STARTUP_SUFFIXES[(index * 3) % len(STARTUP_SUFFIXES)]}"


def _person_name(index: int, first_names: list[str], last_names: list[str]) -> str:
    return f"{first_names[index % len(first_names)]} {last_names[(index * 2) % len(last_names)]}"


def _firm_name(index: int) -> str:
    return f"{FIRM_PREFIXES[index % len(FIRM_PREFIXES)]} {FIRM_SUFFIXES[(index * 5) % len(FIRM_SUFFIXES)]}"


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", ".", value.lower()).strip(".")


def _achievement_templates(startup: dict) -> list[dict]:
    sector_templates = {
        "FinTech": [
            ("revenue", "Crossed ₹1 Crore ARR", "Achieved ₹1 Crore annual recurring revenue through SME payment products.", 10_000_000.0),
            ("partnership", "Partnership with HDFC Bank", "Signed a distribution partnership with HDFC Bank for embedded payment rails.", None),
            ("product", "Launched UPI Merchant App v2.0", "Released the next-generation merchant dashboard with automated settlement insights.", None),
        ],
        "HealthTech": [
            ("team", "Expanded Clinical Operations Team", "Built a specialist care operations team across Mumbai and Bengaluru.", None),
            ("partnership", "Partnered with Apollo Clinics", "Integrated remote monitoring workflows with Apollo-affiliated clinics.", None),
            ("product", "Released AI Triage Assistant", "Shipped an AI-assisted patient triage workflow for chronic care programs.", None),
        ],
        "EdTech": [
            ("revenue", "Reached 50,000 Paid Learners", "Crossed a major paid learner milestone across test prep and upskilling cohorts.", None),
            ("partnership", "University Upskilling Tie-up", "Signed a curriculum delivery partnership with a leading university network.", None),
            ("product", "Launched Adaptive Learning Suite", "Rolled out a new personalized learning engine for exam preparation.", None),
        ],
        "CleanTech": [
            ("partnership", "Signed Industrial Decarbonization Pilot", "Started a paid pilot with a manufacturing partner for energy optimization.", None),
            ("product", "Released Carbon Dashboard", "Launched a real-time emissions monitoring and reporting dashboard.", None),
            ("award", "Won State Climate Innovation Grant", "Received a climate innovation grant for industrial efficiency deployment.", None),
        ],
        "SaaS": [
            ("revenue", "Closed 100 B2B Accounts", "Reached 100 active B2B subscriptions across India and Southeast Asia.", None),
            ("product", "Launched Workflow Automation Suite", "Released a no-code workflow automation product for operations teams.", None),
            ("team", "Opened Enterprise Sales Pod", "Built an enterprise sales pod to accelerate Series A growth.", None),
        ],
        "AI/ML": [
            ("product", "Released GenAI Copilot", "Launched a production-grade GenAI copilot for internal knowledge search.", None),
            ("partnership", "Model Partnership with Cloud Provider", "Partnered with a cloud AI provider for accelerated inference workloads.", None),
            ("award", "Selected for National AI Mission Cohort", "Chosen for a national AI startup acceleration cohort.", None),
        ],
        "E-commerce": [
            ("revenue", "Reached 1 Lakh Monthly Orders", "Hit a major monthly order milestone across metro and tier-2 cities.", None),
            ("partnership", "Logistics Partnership with Delhivery", "Integrated priority fulfillment and reverse logistics with Delhivery.", None),
            ("product", "Launched Seller Analytics Dashboard", "Released live seller analytics for inventory and conversion tracking.", None),
        ],
        "BioTech": [
            ("award", "Received Research Innovation Grant", "Secured a translational research innovation grant for clinical validation.", None),
            ("partnership", "Hospital Lab Collaboration", "Started a diagnostic validation collaboration with a hospital lab network.", None),
            ("product", "Advanced Prototype to Pilot Stage", "Moved a biotech prototype into pilot deployments with clinical partners.", None),
        ],
    }
    templates = sector_templates.get(startup["sector"], sector_templates["SaaS"])
    achievements = []
    for index, (ach_type, title, description, value) in enumerate(templates, start=1):
        achievements.append(
            {
                "id": f"ach_{startup['id'][:8]}_{index}",
                "startup_id": startup["id"],
                "type": ach_type,
                "title": title,
                "description": description,
                "value": value,
                "date": RECENT_ACHIEVEMENT_DATES[index - 1],
                "verified": False,
                "media_url": None,
            }
        )
    return achievements


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
                "email": f"{_slugify(f'{_startup_name(index)} {index + 1}')}@startup.com",
                "password_hash": hash_password("password123"),
                "role": "STARTUP",
                "wallet_balance": 0.0,
                "received_funding": 0.0,
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
                "email": f"{_slugify(_person_name(index, INVESTOR_FIRST_NAMES, INVESTOR_LAST_NAMES))}@vc.com",
                "password_hash": hash_password("password123"),
                "role": "INVESTOR",
                "wallet_balance": 500_000.0,
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

    achievements = []
    for startup in startups:
        achievements.extend(_achievement_templates(startup))

    interested_in = []
    for _ in range(40):
        investor = rng.choice(investors)
        startup = rng.choice(startups)
        interested_in.append({
            "investor_id": investor["id"],
            "startup_id": startup["id"],
            "message": "Interested in learning more about your product.",
            "proposed_amount": round(rng.uniform(investor["ticket_min"], investor["ticket_max"]), 2),
        })

    return {
        "startups": startups,
        "investors": investors,
        "founders": founders,
        "investments": investments,
        "competes_with": competes_with,
        "achievements": achievements,
        "interested_in": interested_in,
        "analyst": {
            "id": "analyst_01",
            "email": "analyst@platform.com",
            "password_hash": hash_password("analyst123"),
            "role": "ANALYST",
            "name": "Platform Analyst",
            "wallet_balance": 0.0,
        },
    }


def is_database_initialized() -> bool:
    """Check if Neo4j database already contains data."""
    try:
        with get_session() as session:
            result = session.run("MATCH (n) RETURN count(n) as count").single()
            count = result["count"]
            return count > 0
    except Exception as e:
        print(f"Error checking database initialization: {e}")
        return False


def run_seed(seed: int = 42, skip_if_initialized: bool = True) -> dict:
    """
    Generate and load seed data into the database.
    
    Args:
        seed: Random seed for reproducible data
        skip_if_initialized: If True, skip seeding if database already has data
    
    Returns:
        Dictionary with seeding results
    """
    # Check if database is already initialized
    if skip_if_initialized and is_database_initialized():
        print("Database already initialized - skipping seed")
        return {"status": "skipped", "reason": "database_already_initialized"}
    
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
                email: startup.email,
                password_hash: startup.password_hash,
                role: startup.role,
                wallet_balance: startup.wallet_balance,
                received_funding: startup.received_funding,
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
                email: investor.email,
                password_hash: investor.password_hash,
                role: investor.role,
                wallet_balance: investor.wallet_balance,
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
            UNWIND $interests AS interest
            MATCH (i:Investor {id: interest.investor_id})
            MATCH (s:Startup {id: interest.startup_id})
            CREATE (i)-[:INTERESTED_IN {
                message: interest.message,
                proposed_amount: interest.proposed_amount,
                status: 'pending',
                date: datetime()
            }]->(s)
            """,
            interests=payload["interested_in"],
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

        session.run(
            """
            UNWIND $achievements AS achievement
            MATCH (s:Startup {id: achievement.startup_id})
            CREATE (a:Achievement {
                id: achievement.id,
                type: achievement.type,
                title: achievement.title,
                description: achievement.description,
                value: achievement.value,
                date: date(achievement.date),
                verified: achievement.verified,
                media_url: achievement.media_url,
                created_at: datetime()
            })
            CREATE (s)-[:HAS_ACHIEVEMENT {posted_at: datetime()}]->(a)
            """,
            achievements=payload["achievements"],
        ).consume()

        session.run(
            """
            CREATE (:Analyst {
                id: $id,
                email: $email,
                password_hash: $password_hash,
                role: $role,
                name: $name,
                wallet_balance: $wallet_balance,
                created_at: datetime()
            })
            """,
            **payload["analyst"],
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
    cache_set(f"profile:analyst:{payload['analyst']['id']}", payload["analyst"], ttl=600)
    achievement_map = defaultdict(list)
    for achievement in payload["achievements"]:
        achievement_map[achievement["startup_id"]].append(achievement)
    for startup_id, items in achievement_map.items():
        cache_set(f"achievements:{startup_id}", items, ttl=600)

    for investment in payload["investments"]:
        leaderboard_scores[investment["investor_id"]] += 1

    if leaderboard_scores:
        r.zadd("leaderboard:investors", leaderboard_scores)

    relationships = (
        len(payload["founders"])
        + len(payload["investments"])
        + len(payload["competes_with"])
        + len(payload["achievements"])
        + len(payload["interested_in"])
    )
    print(f"Created {len(payload['achievements'])} achievements")
    return {
        "startups": len(payload["startups"]),
        "investors": len(payload["investors"]),
        "founders": len(payload["founders"]),
        "analysts": 1,
        "achievements": len(payload["achievements"]),
        "relationships": relationships,
    }


if __name__ == "__main__":
    print(run_seed())
