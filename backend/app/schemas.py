from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from .models import UserRole


# ---------- Auth ----------
class UserCreate(BaseModel):
    username: str
    full_name: str
    password: str
    role: UserRole = UserRole.citizen


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    full_name: str
    role: UserRole


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Proposals ----------
class ProposalCreate(BaseModel):
    project_name: str
    state: str
    district: str
    area_total_ha: float
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ProposalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_name: str
    state: str
    district: str
    area_total_ha: float
    area_acquired_ha: float
    families_affected: int
    stage: int
    stage_label: str
    owner_id: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime
    updated_at: datetime


class AdvanceStageRequest(BaseModel):
    note: Optional[str] = None
    area_acquired_delta_ha: Optional[float] = 0.0
    families_affected_delta: Optional[int] = 0


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    from_stage: Optional[int]
    to_stage: int
    actor_role: str
    note: Optional[str]
    timestamp: datetime


class ProposalNearby(ProposalOut):
    distance_km: float


# ---------- Compensation ----------
class CompensationInput(BaseModel):
    market_value_per_ha: float
    multiplication_factor: float  # 1.0–2.0 per First Schedule
    asset_value: float = 0.0
    delay_months: float = 0.0


class CompensationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    proposal_id: int
    market_value_per_ha: float
    multiplication_factor: float
    asset_value: float
    delay_months: float
    base_market_value: float
    solatium_amount: float
    interest_amount: float
    total_compensation: float
    amount_disbursed: float


class DisbursementRequest(BaseModel):
    amount: float


# ---------- Dashboard ----------
class DashboardSummary(BaseModel):
    area_notified_ha: float
    area_acquired_ha: float
    families_affected: int
    compensation_assessed: float
    compensation_disbursed: float
    proposal_count: int
    stage_breakdown: dict
