import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from backend.db.neo4j_client import get_session, get_user_by_email
from backend.db.redis_client import blacklist_token, cache_set, is_blacklisted, r
from backend.models import InvestorCreate, StartupCreate

SECRET_KEY = "startup-ecosystem-secret-256bit"
ALGORITHM = "HS256"
bearer = HTTPBearer(auto_error=False)
router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


def _auth_response(user_id: str, role: str, name: str) -> dict:
    return {
        "token": create_token(user_id, role, name),
        "role": role,
        "name": name,
        "id": user_id,
    }


def _validate_signup_email(email: str) -> str:
    normalized = email.strip().lower()
    if not normalized:
        raise HTTPException(status_code=422, detail="Email is required")
    if get_user_by_email(normalized):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    return normalized


def _validate_signup_password(password: str | None) -> str:
    if not password or len(password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters long")
    return password


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("ascii"))


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, role: str, name: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "name": name,
        "jti": str(uuid4())[:16],
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=8)).timestamp()),
    }
    header = {"alg": ALGORITHM, "typ": "JWT"}
    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64url_encode(signature)}"


def verify_token(token: str) -> dict:
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
        signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
        expected = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
        provided = _b64url_decode(signature_b64)
        if not hmac.compare_digest(expected, provided):
            raise ValueError("bad signature")
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc

    if int(payload.get("exp", 0)) <= int(datetime.now(timezone.utc).timestamp()):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


def get_current_user(token: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if token is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(token.credentials)
    jti = payload.get("jti", "")
    if is_blacklisted(jti):
        raise HTTPException(status_code=401, detail="Token has been revoked")
    try:
        r.sadd("active:users", payload["sub"])
        r.expire("active:users", 30)
    except Exception:
        # Keep auth working even when Redis is unavailable in lightweight test/dev setups.
        pass
    return {
        "id": payload["sub"],
        "role": payload["role"],
        "name": payload["name"],
        "jti": jti,
        "exp": payload["exp"],
    }


def require_role(*roles):
    def checker(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail=f"Role {user['role']} cannot access this endpoint")
        return user

    return checker


@router.post("/login")
async def login(payload: LoginRequest):
    email = payload.email.strip().lower()
    user = get_user_by_email(email)
    if not user or not verify_password(payload.password, user["pw"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return _auth_response(user["id"], user["role"], user["name"])


@router.post("/signup/startup")
async def signup_startup(payload: StartupCreate):
    email = _validate_signup_email(payload.email or "")
    password = _validate_signup_password(payload.password)
    startup_id = str(uuid4())
    startup = payload.model_dump(exclude={"password"})
    startup.update(
        {
            "id": startup_id,
            "email": email,
            "password_hash": hash_password(password),
            "role": "STARTUP",
            "wallet_balance": 0.0,
            "received_funding": 0.0,
        }
    )

    query = """
    CREATE (:Startup {
      id: $id,
      email: $email,
      password_hash: $password_hash,
      role: $role,
      name: $name,
      sector: $sector,
      stage: $stage,
      funding_ask: $funding_ask,
      equity_offered: $equity_offered,
      pitch: $pitch,
      team_size: $team_size,
      revenue: $revenue,
      founded: $founded,
      wallet_balance: $wallet_balance,
      received_funding: $received_funding,
      created_at: datetime()
    })
    """
    with get_session() as session:
        session.run(query, **startup).consume()

    cache_set(
        f"profile:startup:{startup_id}",
        {
            "id": startup_id,
            "name": startup["name"],
            "sector": startup["sector"],
            "stage": startup["stage"],
            "funding_ask": startup["funding_ask"],
            "equity_offered": startup["equity_offered"],
            "pitch": startup["pitch"],
            "team_size": startup["team_size"],
            "revenue": startup["revenue"],
            "founded": startup["founded"],
            "received_funding": startup["received_funding"],
        },
        ttl=600,
    )
    return _auth_response(startup_id, "STARTUP", startup["name"])


@router.post("/signup/investor")
async def signup_investor(payload: InvestorCreate):
    email = _validate_signup_email(payload.email or "")
    password = _validate_signup_password(payload.password)
    investor_id = str(uuid4())
    investor = payload.model_dump(exclude={"password"})
    investor.update(
        {
            "id": investor_id,
            "email": email,
            "password_hash": hash_password(password),
            "role": "INVESTOR",
            "wallet_balance": 500000.0,
        }
    )

    query = """
    CREATE (:Investor {
      id: $id,
      email: $email,
      password_hash: $password_hash,
      role: $role,
      name: $name,
      firm: $firm,
      type: $type,
      ticket_min: $ticket_min,
      ticket_max: $ticket_max,
      preferred_sectors: $preferred_sectors,
      stage_focus: $stage_focus,
      bio: $bio,
      wallet_balance: $wallet_balance,
      created_at: datetime()
    })
    """
    with get_session() as session:
        session.run(query, **investor).consume()

    cache_set(
        f"profile:investor:{investor_id}",
        {
            "id": investor_id,
            "name": investor["name"],
            "firm": investor["firm"],
            "type": investor["type"],
            "ticket_min": investor["ticket_min"],
            "ticket_max": investor["ticket_max"],
            "preferred_sectors": investor["preferred_sectors"],
            "stage_focus": investor["stage_focus"],
            "bio": investor["bio"],
            "wallet_balance": investor["wallet_balance"],
        },
        ttl=600,
    )
    r.zadd("leaderboard:investors", {investor_id: 0})
    return _auth_response(investor_id, "INVESTOR", investor["name"])


@router.post("/logout")
async def logout(current_user=Depends(get_current_user)):
    ttl = max(int(current_user["exp"]) - int(datetime.now(timezone.utc).timestamp()), 1)
    blacklist_token(current_user["jti"], ttl)
    return {"message": "Logged out successfully"}


@router.get("/me")
async def me(current_user=Depends(get_current_user)):
    return current_user


@router.post("/refresh")
async def refresh(current_user=Depends(get_current_user)):
    return {
        "token": create_token(current_user["id"], current_user["role"], current_user["name"]),
        "role": current_user["role"],
        "name": current_user["name"],
        "id": current_user["id"],
    }
