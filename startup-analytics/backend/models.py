from typing import List, Optional

from pydantic import BaseModel

class StartupCreate(BaseModel):
    email: str | None = None
    password: str | None = None
    name: str
    sector: str
    stage: str
    funding_ask: float
    equity_offered: float
    pitch: Optional[str]
    team_size: Optional[int]
    revenue: Optional[float]
    founded: Optional[int]

class InvestorCreate(BaseModel):
    email: str | None = None
    password: str | None = None
    name: str
    firm: Optional[str]
    type: Optional[str]
    ticket_min: float
    ticket_max: float
    preferred_sectors: List[str]
    stage_focus: List[str]
    bio: Optional[str]


class FounderCreate(BaseModel):
    name: str
    background: Optional[str]
    startup_id: str


class InterestRequest(BaseModel):
    investor_id: str
    startup_id: str
    message: Optional[str] = None
    proposed_amount: float


class ConnectionDecision(BaseModel):
    investor_id: str
    startup_id: str
