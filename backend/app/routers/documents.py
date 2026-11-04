import os
import shutil
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from .. import schemas, models
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(prefix="/proposals/{proposal_id}/documents", tags=["documents"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")


@router.post("")
def upload_document(
    proposal_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    proposal = db.query(models.Proposal).filter(models.Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    proposal_dir = os.path.join(UPLOAD_DIR, str(proposal_id))
    os.makedirs(proposal_dir, exist_ok=True)

    # Version control: if a file with this name already exists for this proposal,
    # increment the version rather than overwriting it — keeps prior versions on disk.
    existing_count = (
        db.query(models.Document)
        .filter(models.Document.proposal_id == proposal_id, models.Document.filename == file.filename)
        .count()
    )
    version = existing_count + 1
    stored_name = f"v{version}__{file.filename}"
    stored_path = os.path.join(proposal_dir, stored_name)

    with open(stored_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    doc = models.Document(
        proposal_id=proposal_id, filename=file.filename, stored_path=stored_path,
        version=version, uploaded_by=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "filename": doc.filename, "version": doc.version, "uploaded_at": doc.uploaded_at}


@router.get("")
def list_documents(
    proposal_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    docs = db.query(models.Document).filter(models.Document.proposal_id == proposal_id).all()
    return [
        {"id": d.id, "filename": d.filename, "version": d.version, "uploaded_at": d.uploaded_at, "uploaded_by": d.uploaded_by}
        for d in docs
    ]
