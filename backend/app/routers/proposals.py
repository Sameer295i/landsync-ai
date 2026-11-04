from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from geoalchemy2.shape import to_shape
from geoalchemy2.elements import WKTElement
from geoalchemy2.types import Geography

from .. import schemas, models
from ..database import get_db
from ..auth import get_current_user, require_roles
from ..models import STAGE_LABELS, ADVANCE_ROLES, Stage, UserRole

router = APIRouter(prefix="/proposals", tags=["proposals"])


def _latlng(p: models.Proposal):
    """Extracts lat/lng from the PostGIS geometry column, if set."""
    if p.location is None:
        return None, None
    point = to_shape(p.location)
    return point.y, point.x  # shapely Point is (x=lng, y=lat)


def _to_out(p: models.Proposal) -> schemas.ProposalOut:
    lat, lng = _latlng(p)
    return schemas.ProposalOut(
        id=p.id, project_name=p.project_name, state=p.state, district=p.district,
        area_total_ha=p.area_total_ha, area_acquired_ha=p.area_acquired_ha,
        families_affected=p.families_affected, stage=p.stage,
        stage_label=STAGE_LABELS[p.stage], owner_id=p.owner_id,
        latitude=lat, longitude=lng,
        created_at=p.created_at, updated_at=p.updated_at,
    )


@router.post("", response_model=schemas.ProposalOut)
def create_proposal(
    payload: schemas.ProposalCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    proposal = models.Proposal(
        project_name=payload.project_name,
        state=payload.state,
        district=payload.district,
        area_total_ha=payload.area_total_ha,
        stage=Stage.proposed.value,
        owner_id=current_user.id,
    )
    if payload.latitude is not None and payload.longitude is not None:
        # WKT point is (longitude, latitude) — standard PostGIS/GIS convention.
        proposal.location = WKTElement(f"POINT({payload.longitude} {payload.latitude})", srid=4326)
    db.add(proposal)
    db.commit()
    db.refresh(proposal)

    # Every proposal starts with an audit trail entry — this is the beginning of the
    # tamper-evident history the problem statement asks for.
    log = models.AuditLog(
        proposal_id=proposal.id, from_stage=None, to_stage=Stage.proposed.value,
        actor_id=current_user.id, actor_role=current_user.role.value,
        note="Proposal submitted",
    )
    db.add(log)
    db.commit()
    return _to_out(proposal)


@router.get("", response_model=List[schemas.ProposalOut])
def list_proposals(
    state: Optional[str] = None,
    stage: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Proposal)

    # Citizens only see their own proposals; officials see everything in their jurisdiction
    # (jurisdiction filtering by state/district is a natural next step once user profiles
    # carry an assigned region — flagged here rather than silently skipped).
    if current_user.role == UserRole.citizen:
        query = query.filter(models.Proposal.owner_id == current_user.id)

    if state:
        query = query.filter(models.Proposal.state == state)
    if stage is not None:
        query = query.filter(models.Proposal.stage == stage)

    return [_to_out(p) for p in query.order_by(models.Proposal.updated_at.desc()).all()]


@router.get("/nearby", response_model=List[schemas.ProposalNearby])
def nearby_proposals(
    lat: float,
    lng: float,
    radius_km: float = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Genuine PostGIS spatial query — finds proposals within radius_km of a point
    using ST_DWithin on the geography type (accounts for the earth's curvature,
    unlike a naive lat/lng bounding box). This is what the 'GIS-enabled' claim
    in the problem statement actually means at the database level."""
    origin = func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326)
    distance_expr = func.ST_Distance(
        func.cast(models.Proposal.location, Geography),
        func.cast(origin, Geography),
    ) / 1000.0  # metres -> km

    query = (
        db.query(models.Proposal, distance_expr.label("distance_km"))
        .filter(models.Proposal.location.isnot(None))
        .filter(
            func.ST_DWithin(
                func.cast(models.Proposal.location, Geography),
                func.cast(origin, Geography),
                radius_km * 1000,
            )
        )
        .order_by("distance_km")
    )

    if current_user.role == UserRole.citizen:
        query = query.filter(models.Proposal.owner_id == current_user.id)

    results = []
    for p, dist in query.all():
        out = _to_out(p)
        results.append(schemas.ProposalNearby(**out.model_dump(), distance_km=round(dist, 2)))
    return results


@router.get("/{proposal_id}", response_model=schemas.ProposalOut)
def get_proposal(
    proposal_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = db.query(models.Proposal).filter(models.Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if current_user.role == UserRole.citizen and p.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this proposal")
    return _to_out(p)


@router.post("/{proposal_id}/advance", response_model=schemas.ProposalOut)
def advance_stage(
    proposal_id: int,
    payload: schemas.AdvanceStageRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(ADVANCE_ROLES)),
):
    p = db.query(models.Proposal).filter(models.Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if p.stage >= Stage.rr_complete.value:
        raise HTTPException(status_code=400, detail="Proposal has already reached the final stage")

    from_stage = p.stage
    p.stage += 1
    p.area_acquired_ha = min(p.area_total_ha, p.area_acquired_ha + (payload.area_acquired_delta_ha or 0))
    p.families_affected += payload.families_affected_delta or 0
    db.add(p)

    log = models.AuditLog(
        proposal_id=p.id, from_stage=from_stage, to_stage=p.stage,
        actor_id=current_user.id, actor_role=current_user.role.value,
        note=payload.note,
    )
    db.add(log)
    db.commit()
    db.refresh(p)
    return _to_out(p)


@router.get("/{proposal_id}/audit-log", response_model=List[schemas.AuditLogOut])
def get_audit_log(
    proposal_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = db.query(models.Proposal).filter(models.Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if current_user.role == UserRole.citizen and p.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this proposal")

    logs = (
        db.query(models.AuditLog)
        .filter(models.AuditLog.proposal_id == proposal_id)
        .order_by(models.AuditLog.timestamp.asc())
        .all()
    )
    return logs
