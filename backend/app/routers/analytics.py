from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import schemas, models, timeline
from ..database import get_db
from ..auth import require_roles
from ..models import ADVANCE_ROLES

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/bottlenecks", response_model=schemas.BottleneckReport)
def bottlenecks(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(ADVANCE_ROLES)),
):
    """Which proposals are stuck, and in which stage. Computed from the audit log:
    time spent in the current stage versus the planning target and versus the average
    time other proposals actually took in that stage."""
    return timeline.build_report(db)
