from sqlalchemy import text
from app.db.database import engine, Base
from app.models import Camera, GPSPosition, DetectionEvent, VehicleDetection
from app.config import settings


def init_db():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")

    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print(f"Database connection test: {result.fetchone()}")
        
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
            conn.commit()
            print("PostGIS extension enabled")
        except Exception as e:
            print(f"PostGIS extension note: {e}")


if __name__ == "__main__":
    init_db()