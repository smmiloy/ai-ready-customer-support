from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(
    title="AI-Ready Customer Support API",
    description="Backend API for the AI-ready customer support dashboard",
    version="1.0.0",
)



app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "message": "AI-Ready Customer Support API is running"
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy"
    }