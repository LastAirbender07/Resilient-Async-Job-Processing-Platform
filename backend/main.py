import time
from app.core.logging import setup_logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.jobs import router as jobs_router
from prometheus_client import make_asgi_app
from app.core.metrics import PrometheusMiddleware
# from app.db.session import engine

logger = setup_logging()
app = FastAPI(title="Resilient Async Job Processing Platform", version="0.1.0")

# --- CORS ---
origins = ["*"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(PrometheusMiddleware)

# TEMPORARY – REMOVE AFTER ALEMBIC
# Base.metadata.create_all(bind=engine)

# --- Include API Routes ---
app.include_router(jobs_router) 

# --- Expose Metrics ---
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

@app.get("/health")
def health():
    logger.info("Health check endpoint called.")
    return {"status": "ok", "timestamp": time.time()}

@app.get("/")
def root():
    logger.info("Root endpoint called.")
    return {"message": "Welcome to the Resilient Async Job Processing Platform!"}
