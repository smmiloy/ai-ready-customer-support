import pytest
import pytest_asyncio
from httpx import AsyncClient
from app.main import app
from app.db.client import prisma


@pytest_asyncio.fixture(scope="session")
async def event_loop():
    import asyncio

    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def client():
    await prisma.connect()
    yield AsyncClient(app=app, base_url="http://test")
    await prisma.disconnect()