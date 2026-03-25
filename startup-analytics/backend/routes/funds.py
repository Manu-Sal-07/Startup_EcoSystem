from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth import require_role
from backend.db import acquire_fund_lock, cache_delete, get_driver, get_session, r, release_fund_lock

router = APIRouter(tags=["funds"])


class TransferIn(BaseModel):
    startup_id: str
    amount: float


class WalletTopUpIn(BaseModel):
    investor_id: str
    amount: float


def _record_to_dict(record):
    return record.data() if hasattr(record, "data") else record


@router.post("/funds/transfer")
async def transfer_funds(
    payload: TransferIn,
    current_user: dict = Depends(require_role("INVESTOR")),
):
    investor_id = current_user["id"]
    if payload.amount <= 0:
        raise HTTPException(status_code=422, detail="Amount must be positive")

    lock_token = acquire_fund_lock(payload.startup_id)
    if not lock_token:
        raise HTTPException(status_code=423, detail="Funding round is locked by another transfer. Retry shortly.")

    transfer_committed = False

    try:
        with get_driver().session() as session:
            with session.begin_transaction() as tx:
                investor = tx.run(
                    "MATCH (i:Investor {id: $id}) RETURN i.wallet_balance AS bal",
                    id=investor_id,
                ).single()
                if not investor:
                    tx.rollback()
                    raise HTTPException(status_code=404, detail="Investor not found")
                investor_data = _record_to_dict(investor)
                if investor_data["bal"] < payload.amount:
                    tx.rollback()
                    raise HTTPException(status_code=402, detail="Insufficient wallet balance")

                startup = tx.run(
                    "MATCH (s:Startup {id: $id}) RETURN s.funding_ask AS ask, s.received_funding AS recv",
                    id=payload.startup_id,
                ).single()
                if not startup:
                    tx.rollback()
                    raise HTTPException(status_code=404, detail="Startup not found")

                startup_data = _record_to_dict(startup)
                ask = float(startup_data["ask"] or 0)
                received = float(startup_data["recv"] or 0)
                if received + payload.amount > ask:
                    tx.rollback()
                    raise HTTPException(status_code=409, detail="Transfer would oversubscribe this funding round")

                tx.run(
                    "MATCH (i:Investor {id: $id}) SET i.wallet_balance = coalesce(i.wallet_balance, 0) - $amt",
                    id=investor_id,
                    amt=payload.amount,
                )
                tx.run(
                    "MATCH (s:Startup {id: $id}) SET s.received_funding = coalesce(s.received_funding, 0) + $amt",
                    id=payload.startup_id,
                    amt=payload.amount,
                )
                tx.run(
                    """
                    MATCH (i:Investor {id: $inv}), (s:Startup {id: $startup})
                    CREATE (i)-[:FUNDED {
                      amount: $amt,
                      round: 'direct-transfer',
                      transferred_at: datetime(),
                      status: 'completed'
                    }]->(s)
                    """,
                    inv=investor_id,
                    startup=payload.startup_id,
                    amt=payload.amount,
                )
                tx.commit()
                transfer_committed = True
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Transfer failed: {exc}") from exc
    finally:
        release_fund_lock(payload.startup_id, lock_token)
        if transfer_committed:
            cache_delete(f"profile:startup:{payload.startup_id}", f"profile:investor:{investor_id}")
            r.zincrby("leaderboard:investors", payload.amount, investor_id)

    return {
        "status": "transferred",
        "amount": payload.amount,
        "investor_id": investor_id,
        "startup_id": payload.startup_id,
    }


@router.get("/funds/history/{investor_id}")
async def get_funding_history(
    investor_id: str,
    current_user: dict = Depends(require_role("INVESTOR")),
):
    if current_user["id"] != investor_id:
        raise HTTPException(status_code=403, detail="Investors can only view their own funding history")
    query = """
    MATCH (i:Investor {id: $id})-[f:FUNDED]->(s:Startup)
    RETURN s.name AS startup, s.sector AS sector, f.amount AS amount,
           f.round AS round, toString(f.transferred_at) AS transferred_at, f.status AS status
    ORDER BY f.transferred_at DESC
    """
    with get_session() as session:
        items = [record.data() for record in session.run(query, id=investor_id)]
    return {"investor_id": investor_id, "items": items}


@router.get("/startups/{startup_id}/funding-progress")
async def get_funding_progress(
    startup_id: str,
    _: dict = Depends(require_role("INVESTOR", "ANALYST", "STARTUP")),
):
    query = """
    MATCH (s:Startup {id: $id})
    RETURN s.name AS name, s.funding_ask AS funding_ask, s.received_funding AS received_funding
    """
    with get_session() as session:
        record = session.run(query, id=startup_id).single()

    if record is None:
        raise HTTPException(status_code=404, detail="Startup not found")

    payload = record.data() if hasattr(record, "data") else record
    funding_ask = float(payload["funding_ask"] or 0)
    received_funding = float(payload["received_funding"] or 0)
    percentage = round((received_funding / funding_ask) * 100, 1) if funding_ask > 0 else 0
    is_locked = bool(r.get(f"fund_lock:startup:{startup_id}"))

    return {
        "startup_id": startup_id,
        "name": payload["name"],
        "funding_ask": funding_ask,
        "received_funding": received_funding,
        "percentage": percentage,
        "is_locked": is_locked,
    }


@router.get("/funds/lock-status/{startup_id}")
async def get_lock_status(
    startup_id: str,
    _: dict = Depends(require_role("INVESTOR")),
):
    return {"startup_id": startup_id, "is_locked": bool(r.get(f"fund_lock:startup:{startup_id}"))}


@router.post("/wallet/topup")
async def wallet_topup(
    payload: WalletTopUpIn,
    _: dict = Depends(require_role("ANALYST")),
):
    if payload.amount <= 0:
        raise HTTPException(status_code=422, detail="Amount must be positive")

    query = """
    MATCH (i:Investor {id: $investor_id})
    SET i.wallet_balance = coalesce(i.wallet_balance, 0) + $amount
    RETURN i.id AS investor_id, i.wallet_balance AS wallet_balance
    """
    with get_session() as session:
        record = session.run(query, investor_id=payload.investor_id, amount=payload.amount).single()

    if record is None:
        raise HTTPException(status_code=404, detail="Investor not found")

    result = _record_to_dict(record)
    cache_delete(f"profile:investor:{payload.investor_id}")
    return {
        "status": "topped_up",
        "investor_id": result["investor_id"],
        "amount": payload.amount,
        "wallet_balance": result["wallet_balance"],
    }
