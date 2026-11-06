import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, Enum as SAEnum, Text
)
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from .database import Base


class UserRole(str, enum.Enum):
    citizen = "citizen"
    district_officer = "district_officer"
    state_official = "state_official"
    central_ministry = "central_ministry"


# Order here defines the legal lifecycle sequence (RFCTLARR Act, 2013)
class Stage(int, enum.Enum):
    proposed = 0
    notified = 1
    declared = 2
    surveyed = 3
    awarded = 4
    possession = 5
    rr_complete = 6


STAGE_LABELS = {
    0: "Proposed", 1: "Notified", 2: "Declared", 3: "Surveyed",
    4: "Awarded", 5: "Possession", 6: "R&R complete",
}

# Roles allowed to advance a proposal's stage (citizens cannot approve their own proposals)
ADVANCE_ROLES = {UserRole.district_officer, UserRole.state_official, UserRole.central_ministry}


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(SAEnum(UserRole), nullable=False, default=UserRole.citizen)
    created_at = Column(DateTime, default=datetime.utcnow)

    proposals = relationship("Proposal", back_populates="owner")


class Proposal(Base):
    __tablename__ = "proposals"

    id = Column(Integer, primary_key=True, index=True)
    project_name = Column(String, nullable=False)
    state = Column(String, nullable=False)
    district = Column(String, nullable=False)
    area_total_ha = Column(Float, nullable=False)
    area_acquired_ha = Column(Float, default=0.0)
    families_affected = Column(Integer, default=0)
    stage = Column(Integer, default=Stage.proposed.value)

    # Real PostGIS spatial column — SRID 4326 is standard WGS84 lat/lng.
    # Nullable so proposals can still be created before their parcel is geo-tagged.
    location = Column(Geometry(geometry_type="POINT", srid=4326), nullable=True)

    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="proposals")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    audit_logs = relationship("AuditLog", back_populates="proposal", cascade="all, delete-orphan")
    compensation = relationship("Compensation", back_populates="proposal", uselist=False, cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="proposal", cascade="all, delete-orphan")
    rr = relationship("RRRecord", back_populates="proposal", uselist=False, cascade="all, delete-orphan")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    proposal_id = Column(Integer, ForeignKey("proposals.id"))
    from_stage = Column(Integer, nullable=True)
    to_stage = Column(Integer, nullable=False)
    actor_id = Column(Integer, ForeignKey("users.id"))
    actor_role = Column(String, nullable=False)
    note = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    proposal = relationship("Proposal", back_populates="audit_logs")


class Compensation(Base):
    __tablename__ = "compensation"

    id = Column(Integer, primary_key=True, index=True)
    proposal_id = Column(Integer, ForeignKey("proposals.id"), unique=True)

    # Inputs — Section 26 market value determination
    market_value_per_ha = Column(Float, nullable=False)
    multiplication_factor = Column(Float, nullable=False)  # 1.0 urban -> 2.0 rural, Section First Schedule
    asset_value = Column(Float, default=0.0)                # Section 27 — structures, trees, wells etc
    delay_months = Column(Float, default=0.0)                # for Section 30(3) 12% p.a. interest

    # Computed outputs
    base_market_value = Column(Float, default=0.0)
    solatium_amount = Column(Float, default=0.0)             # Section 30(1) — 100% of base
    interest_amount = Column(Float, default=0.0)             # Section 30(3) — 12% p.a. on market value
    total_compensation = Column(Float, default=0.0)
    amount_disbursed = Column(Float, default=0.0)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    proposal = relationship("Proposal", back_populates="compensation")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    proposal_id = Column(Integer, ForeignKey("proposals.id"))
    filename = Column(String, nullable=False)
    stored_path = Column(String, nullable=False)
    version = Column(Integer, default=1)
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    proposal = relationship("Proposal", back_populates="documents")


class RRRecord(Base):
    """Rehabilitation & Resettlement progress. Kept in its own table so it can be added
    to an existing database without altering the proposals table."""
    __tablename__ = "rr_records"

    id = Column(Integer, primary_key=True, index=True)
    proposal_id = Column(Integer, ForeignKey("proposals.id"), unique=True)
    families_rehabilitated = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    proposal = relationship("Proposal", back_populates="rr")
