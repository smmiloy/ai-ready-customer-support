# ai-ready-customer-support

AI-Ready Customer Support API — a FastAPI backend with JWT-based authentication, Prisma ORM, and PostgreSQL.

## Features

- User registration and login
- JWT access & refresh token authentication
- Token refresh and rotation
- Token revocation (logout)
- Password hashing with Argon2

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI application entry point
│   ├── core/                # Core utilities (config, security)
│   ├── api/routes/          # API route definitions
│   ├── services/            # Business logic
│   ├── schemas/             # Pydantic models
│   └── db/                  # Database client
├── prisma/                  # Prisma schema & migrations
├── tests/                   # Test suite
├── docker-compose.yml       # Docker Compose for dev
├── Dockerfile               # Docker image
├── Makefile                 # Common task shortcuts
├── pyproject.toml           # Project metadata & dependencies
└── requirements.txt         # Runtime dependencies
```

## Setup

```bash
cp .env.example .env
pip install -r requirements.txt
prisma generate
prisma migrate dev
```

## Running

```bash
make dev
```
