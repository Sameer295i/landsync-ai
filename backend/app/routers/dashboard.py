from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from .. import schemas, models
from ..database import get_db
from ..models import STAGE_LABELS

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=schemas.DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db)):
    proposals = db.query(models.Proposal).all()

    area_notified = sum(p.area_total_ha for p in proposals)
    area_acquired = sum(p.area_acquired_ha for p in proposals)
    families = sum(p.families_affected for p in proposals)

    comp_assessed = db.query(func.sum(models.Compensation.total_compensation)).scalar() or 0.0
    comp_disbursed = db.query(func.sum(models.Compensation.amount_disbursed)).scalar() or 0.0

    stage_breakdown = {STAGE_LABELS[i]: 0 for i in range(7)}
    for p in proposals:
        stage_breakdown[STAGE_LABELS[p.stage]] += 1

    return schemas.DashboardSummary(
        area_notified_ha=area_notified,
        area_acquired_ha=area_acquired,
        families_affected=families,
        compensation_assessed=comp_assessed,
        compensation_disbursed=comp_disbursed,
        proposal_count=len(proposals),
        stage_breakdown=stage_breakdown,
    )
