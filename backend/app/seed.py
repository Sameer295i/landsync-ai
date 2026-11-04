"""
Wipes and repopulates the database with realistic demo data, including real
lat/lng coordinates stored as PostGIS geometry — not mock frontend data.

Run inside Docker:
    docker exec -it landsync-backend python -m app.seed

Run locally (without Docker, against whatever DATABASE_URL is set):
    python -m app.seed
"""
from datetime import datetime, timedelta

from .database import SessionLocal, engine, Base
from . import models
from .auth import hash_password
from geoalchemy2.elements import WKTElement

# (district, state, lat, lng)
LOCATIONS = [
    ("Jaipur", "Rajasthan", 26.9124, 75.7873),
    ("Jodhpur", "Rajasthan", 26.2389, 73.0243),
    ("Vadodara", "Gujarat", 22.3072, 73.1812),
    ("Kanpur", "Uttar Pradesh", 26.4499, 80.3319),
    ("Lucknow", "Uttar Pradesh", 26.8467, 80.9462),
    ("Bengaluru Urban", "Karnataka", 12.9716, 77.5946),
]

DEMO_PROPOSALS = [
    {"project_name": "NH-48 widening", "loc": 0, "area_total_ha": 120, "area_acquired_ha": 96, "families": 42, "stage": 4},
    {"project_name": "Solar park phase 2", "loc": 1, "area_total_ha": 500, "area_acquired_ha": 40, "families": 15, "stage": 1},
    {"project_name": "Delhi-Mumbai corridor", "loc": 2, "area_total_ha": 340, "area_acquired_ha": 110, "families": 128, "stage": 2},
    {"project_name": "Eastern DFC extension", "loc": 3, "area_total_ha": 85, "area_acquired_ha": 85, "families": 30, "stage": 6},
    {"project_name": "Irrigation canal link", "loc": 4, "area_total_ha": 60, "area_acquired_ha": 58, "families": 64, "stage": 5},
    {"project_name": "Metro line 3 extension", "loc": 5, "area_total_ha": 22, "area_acquired_ha": 18, "families": 210, "stage": 3},
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        print("Clearing existing data...")
        db.query(models.AuditLog).delete()
        db.query(models.Document).delete()
        db.query(models.Compensation).delete()
        db.query(models.Proposal).delete()
        db.query(models.User).delete()
        db.commit()

        print("Creating demo users...")
        officer = models.User(
            username="officer1", full_name="D. Sharma",
            hashed_password=hash_password("pass1234"), role=models.UserRole.district_officer,
        )
        citizen = models.User(
            username="citizen1", full_name="R. Kumar",
            hashed_password=hash_password("pass1234"), role=models.UserRole.citizen,
        )
        state_official = models.User(
            username="state1", full_name="A. Verma",
            hashed_password=hash_password("pass1234"), role=models.UserRole.state_official,
        )
        db.add_all([officer, citizen, state_official])
        db.commit()
        db.refresh(officer)
        db.refresh(citizen)

        print("Creating demo proposals with real PostGIS coordinates...")
        for i, item in enumerate(DEMO_PROPOSALS):
            district, state, lat, lng = LOCATIONS[item["loc"]]
            proposal = models.Proposal(
                project_name=item["project_name"],
                state=state,
                district=district,
                area_total_ha=item["area_total_ha"],
                area_acquired_ha=item["area_acquired_ha"],
                families_affected=item["families"],
                stage=item["stage"],
                owner_id=citizen.id,
                location=WKTElement(f"POINT({lng} {lat})", srid=4326),
                created_at=datetime.utcnow() - timedelta(days=30 - i * 4),
            )
            db.add(proposal)
            db.commit()
            db.refresh(proposal)

            # Audit trail entry for creation
            db.add(models.AuditLog(
                proposal_id=proposal.id, from_stage=None, to_stage=0,
                actor_id=citizen.id, actor_role="citizen", note="Proposal submitted",
                timestamp=proposal.created_at,
            ))

            # For proposals that have progressed, add a compensation record
            if item["stage"] >= 4:
                market_value = 400000 + i * 50000
                factor = 1.5
                asset_value = 150000
                base = market_value * item["area_acquired_ha"] * factor
                solatium = (base + asset_value)
                total = base + asset_value + solatium
                db.add(models.Compensation(
                    proposal_id=proposal.id,
                    market_value_per_ha=market_value,
                    multiplication_factor=factor,
                    asset_value=asset_value,
                    delay_months=3,
                    base_market_value=round(base, 2),
                    solatium_amount=round(solatium, 2),
                    interest_amount=round(market_value * item["area_acquired_ha"] * 0.12 * 0.25, 2),
                    total_compensation=round(total, 2),
                    amount_disbursed=round(total * 0.6, 2) if item["stage"] >= 5 else 0,
                ))
            db.commit()

        print(f"\nSeed complete: {len(DEMO_PROPOSALS)} proposals, 3 users.")
        print("Login with: officer1 / pass1234  |  citizen1 / pass1234  |  state1 / pass1234")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
