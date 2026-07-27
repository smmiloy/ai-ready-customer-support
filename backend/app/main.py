import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, chat, file, message
from app.db.client import prisma

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Connecting to database...")

    await prisma.connect()

    logger.info("Database connected successfully!")

    user_role = await prisma.roles.find_unique(
        where={
            "name": "USER",
        }
    )

    if not user_role:
        await prisma.roles.create(
            data={
                "name": "USER",
            }
        )

        logger.info("Default USER role created!")

    yield

    logger.info("Disconnecting from database...")

    await prisma.disconnect()

    logger.info("Database disconnected!")


app = FastAPI(
    title="AI-Ready Customer Support API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(
    auth.router,
)

app.include_router(
    chat.router,
)

app.include_router(
    message.router,
)

app.include_router(
    file.router,
)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
    }
