from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import schemas, models
from ..database import get_db
from ..auth import get_current_user, require_roles
from ..models import ADVANCE_ROLES, UserRole

router = APIRouter(prefix="/proposals/{proposal_id}/rr", tags=["rehabilitation"])


def _out(p: models.Proposal) -> schemas.RROut:
    done = p.rr.families_rehabilitated if p.rr else 0
    total = p.families_affected or 0
    return schemas.RROut(
        proposal_id=p.id, families_affected=total, families_rehabilitated=done,
        progress_pct=round(100 * done / total, 1) if total else 0.0,
    )


def _get(db, proposal_id, user):
    p = db.query(models.Proposal).filter(models.Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if user.role == UserRole.citizen and p.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this proposal")
    return p


@router.get("", response_model=schemas.RROut)
def get_rr(proposal_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return _out(_get(db, proposal_id, current_user))


@router.post("", response_model=schemas.RROut)
def update_rr(
    proposal_id: int,
    payload: schemas.RRUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(ADVANCE_ROLES)),
):
    p = _get(db, proposal_id, current_user)
    if payload.families_rehabilitated < 0 or payload.families_rehabilitated > (p.families_affected or 0):
        raise HTTPException(status_code=400, detail="Rehabilitated families must be between 0 and the number of affected families")
    if not p.rr:
        p.rr = models.RRRecord(proposal_id=p.id)
    p.rr.families_rehabilitated = payload.families_rehabilitated
    db.add(p)
    db.commit()
    db.refresh(p)
    return _out(p)
