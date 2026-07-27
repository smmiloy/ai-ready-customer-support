.PHONY: install run test lint typecheck migrate dev

install:
	pip install -r requirements.txt

dev:
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

run:
	uvicorn app.main:app --host 0.0.0.0 --port 8000

test:
	pytest

lint:
	ruff check .

typecheck:
	mypy app

migrate:
	prisma generate
	prisma migrate dev

prisma-generate:
	prisma generate