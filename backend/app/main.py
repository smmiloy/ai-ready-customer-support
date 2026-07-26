from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import auth
from app.db.client import prisma


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Connecting to database...")

    await prisma.connect()

    print("Database connected successfully!")

    # Create default USER role if it does not exist
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

        print("Default USER role created!")

    yield

    print("Disconnecting from database...")

    await prisma.disconnect()

    print("Database disconnected!")


app = FastAPI(
    title="AI-Ready Customer Support API",
    version="1.0.0",
    lifespan=lifespan,
)


app.include_router(
    auth.router,
)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
    }