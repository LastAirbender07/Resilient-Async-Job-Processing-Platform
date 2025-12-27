import time
from app.core.logging import setup_logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.jobs import router as jobs_router

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

# --- Include API Routes ---
app.include_router(jobs_router) 

@app.get("/health")
def health():
    logger.info("Health check endpoint called.")
    return {"status": "ok", "timestamp": time.time()}

@app.get("/")
def root():
    logger.info("Root endpoint called.")
    return {"message": "Welcome to the Resilient Async Job Processing Platform!"}
