from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import schemas, models
from ..database import get_db
from ..auth import require_roles
from ..models import ADVANCE_ROLES

router = APIRouter(prefix="/proposals/{proposal_id}/compensation", tags=["compensation"])


def _calculate(inp: schemas.CompensationInput, area_ha: float) -> dict:
    """Implements RFCTLARR Act, 2013, Sections 26-30:
    - Section 26: market value of the land
    - First Schedule: multiplication factor (1.0 urban -> up to 2.0 rural)
    - Section 27: value of assets attached to the land
    - Section 30(1): solatium = 100% of (market value x factor + asset value)
    - Section 30(3): 12% p.a. interest on market value for delay between SIA and award
    """
    base_market_value = inp.market_value_per_ha * area_ha * inp.multiplication_factor
    pre_solatium_total = base_market_value + inp.asset_value
    solatium_amount = pre_solatium_total * 1.0  # 100% solatium under Section 30(1)
    interest_amount = (inp.market_value_per_ha * area_ha) * 0.12 * (inp.delay_months / 12.0)
    total = pre_solatium_total + solatium_amount + interest_amount

    return {
        "base_market_value": round(base_market_value, 2),
        "solatium_amount": round(solatium_amount, 2),
        "interest_amount": round(interest_amount, 2),
        "total_compensation": round(total, 2),
    }


@router.post("", response_model=schemas.CompensationOut)
def calculate_compensation(
    proposal_id: int,
    payload: schemas.CompensationInput,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(ADVANCE_ROLES)),
):
    proposal = db.query(models.Proposal).filter(models.Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if not (1.0 <= payload.multiplication_factor <= 2.0):
        raise HTTPException(status_code=400, detail="Multiplication factor must be between 1.0 (urban) and 2.0 (rural) per the First Schedule")

    computed = _calculate(payload, proposal.area_acquired_ha or proposal.area_total_ha)

    comp = db.query(models.Compensation).filter(models.Compensation.proposal_id == proposal_id).first()
    if not comp:
        comp = models.Compensation(proposal_id=proposal_id)

    comp.market_value_per_ha = payload.market_value_per_ha
    comp.multiplication_factor = payload.multiplication_factor
    comp.asset_value = payload.asset_value
    comp.delay_months = payload.delay_months
    comp.base_market_value = computed["base_market_value"]
    comp.solatium_amount = computed["solatium_amount"]
    comp.interest_amount = computed["interest_amount"]
    comp.total_compensation = computed["total_compensation"]

    db.add(comp)
    db.commit()
    db.refresh(comp)
    return comp


@router.get("", response_model=schemas.CompensationOut)
def get_compensation(proposal_id: int, db: Session = Depends(get_db)):
    comp = db.query(models.Compensation).filter(models.Compensation.proposal_id == proposal_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Compensation has not been calculated for this proposal yet")
    return comp


@router.post("/disburse", response_model=schemas.CompensationOut)
def disburse(
    proposal_id: int,
    payload: schemas.DisbursementRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(ADVANCE_ROLES)),
):
    comp = db.query(models.Compensation).filter(models.Compensation.proposal_id == proposal_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Compensation has not been calculated for this proposal yet")
    if comp.amount_disbursed + payload.amount > comp.total_compensation:
        raise HTTPException(status_code=400, detail="Disbursement would exceed total assessed compensation")

    comp.amount_disbursed += payload.amount
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return comp
