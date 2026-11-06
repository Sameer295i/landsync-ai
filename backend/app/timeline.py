"""Timeline monitoring and bottleneck detection.

Everything here is computed from the audit log (who moved which proposal into which
stage, and when), so it reflects real recorded activity rather than hard-coded numbers.

TARGET_DAYS are configurable *planning* targets for how long a proposal should spend in
each stage before moving on. They are not statutory deadlines.
"""
from collections import defaultdict
from datetime import datetime
from typing import Dict, List

from sqlalchemy.orm import Session

from . import models, schemas
from .models import STAGE_LABELS

TARGET_DAYS = {0: 30, 1: 45, 2: 45, 3: 60, 4: 60, 5: 90}  # stage 6 (R&R complete) is terminal
AT_RISK_FRACTION = 0.8  # flag as "at risk" once 80% of the target has elapsed


def _logs_by_proposal(db: Session) -> Dict[int, List[models.AuditLog]]:
    grouped = defaultdict(list)
    for log in db.query(models.AuditLog).order_by(models.AuditLog.timestamp.asc()).all():
        grouped[log.proposal_id].append(log)
    return grouped


def _stage_averages(logs_by_proposal) -> Dict[int, float]:
    """Average days actually spent in each stage, from completed transitions."""
    durations = defaultdict(list)
    for logs in logs_by_proposal.values():
        for current, nxt in zip(logs, logs[1:]):
            durations[current.to_stage].append((nxt.timestamp - current.timestamp).total_seconds() / 86400)
    return {stage: sum(v) / len(v) for stage, v in durations.items() if v}


def build_report(db: Session) -> schemas.BottleneckReport:
    now = datetime.utcnow()
    proposals = db.query(models.Proposal).all()
    logs_by_proposal = _logs_by_proposal(db)
    averages = _stage_averages(logs_by_proposal)

    items, delayed_by_stage = [], defaultdict(int)
    for p in proposals:
        if p.stage >= models.Stage.rr_complete.value:
            continue  # finished proposals are not "in progress"
        entered = next((l.timestamp for l in reversed(logs_by_proposal.get(p.id, [])) if l.to_stage == p.stage), p.created_at)
        days = max(0, int((now - entered).total_seconds() // 86400))
        target = TARGET_DAYS[p.stage]
        if days > target:
            status = "delayed"
            delayed_by_stage[p.stage] += 1
        elif days > target * AT_RISK_FRACTION:
            status = "at_risk"
        else:
            status = "on_track"
        items.append(schemas.BottleneckItem(
            proposal_id=p.id, project_name=p.project_name, state=p.state, district=p.district,
            stage=p.stage, stage_label=STAGE_LABELS[p.stage], days_in_stage=days,
            target_days=target, avg_days_for_stage=round(averages[p.stage], 1) if p.stage in averages else None,
            status=status, over_by_days=max(0, days - target),
        ))

    order = {"delayed": 0, "at_risk": 1, "on_track": 2}
    items.sort(key=lambda i: (order[i.status], -i.days_in_stage))

    stage_stats = [
        schemas.StageStat(
            stage=s, stage_label=STAGE_LABELS[s], target_days=TARGET_DAYS[s],
            avg_days=round(averages[s], 1) if s in averages else None,
            delayed_count=delayed_by_stage.get(s, 0),
        )
        for s in range(6)
    ]
    within = sum(1 for i in items if i.status != "delayed")
    bottleneck = max(delayed_by_stage, key=lambda s: delayed_by_stage[s]) if delayed_by_stage else None

    return schemas.BottleneckReport(
        items=items, stage_stats=stage_stats,
        adherence_pct=round(100 * within / len(items), 1) if items else 100.0,
        delayed_count=sum(1 for i in items if i.status == "delayed"),
        at_risk_count=sum(1 for i in items if i.status == "at_risk"),
        bottleneck_stage=STAGE_LABELS[bottleneck] if bottleneck is not None else None,
    )
