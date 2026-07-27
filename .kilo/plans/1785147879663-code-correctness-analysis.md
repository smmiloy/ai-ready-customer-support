# Code Correctness Analysis — ai-ready-customer-support

## Summary

The project is a FastAPI + Prisma + PostgreSQL auth backend. Core flow (register/login/refresh/logout) is structurally sound, but there are **several correctness and security bugs** that must be fixed before the code is production-ready or even reliably testable.

---

## Critical Issues

### 1. Dockerfile COPY paths are wrong
**Files:** `backend/Dockerfile:5`, `backend/Dockerfile:8`

The build context is `backend/` (via `docker-compose.yml` `build: .`). The Dockerfile tries to copy `backend/requirements.txt` and `backend/`, which do not exist relative to that context.

**Current:**
```dockerfile
COPY backend/requirements.txt .
COPY backend/ .
```

**Fix:**
```dockerfile
COPY requirements.txt .
COPY . .
```

---

### 2. Password validation never enforced
**Files:** `backend/app/schemas/auth.py:34`, `backend/app/api/routes/auth.py:33-55`

`RegisterRequest.validate_password()` exists but is **never called** anywhere. Users can register with weak passwords like `"password"`.

**Fix:** Call `request.validate_password()` in the `/register` route handler before passing to the service layer.

---

### 3. CORS misconfiguration
**Files:** `backend/app/main.py:52-58`

`allow_origins=["*"]` combined with `allow_credentials=True` violates the CORS spec. Browsers will block credentialed requests (cookies, Authorization headers) when the origin is `*`.

**Fix:** Either:
- Remove `allow_credentials=True` (if no cookies/sessions), or
- Replace `["*"]` with an explicit allowlist of trusted origins.

---

### 4. `users.updated_at` never auto-updates
**Files:** `backend/prisma/schema.prisma:49`

`updated_at` has `@default(now())` but lacks `@updatedAt`. It will remain the creation timestamp forever.

**Fix:** Add `@updatedAt` to the field:
```
updated_at DateTime @default(now()) @updatedAt @db.Timestamptz(6)
```

---

### 5. `users` table missing `roles` relation field
**Files:** `backend/prisma/schema.prisma:42-55`

`roles` model has `users users[]`, but `users` model references `roles` via `role_id` and has `roles roles @relation(...)`. However, the `users` model also has `roles` as a relation field name, which **conflicts** with the `role_id` scalar field if Prisma tries to generate the back-relation. Actually, Prisma handles this via explicit relation fields, but the `users` model has both:
- `role_id Int` (scalar)
- `roles roles @relation(...)` (relation)

This is valid in Prisma, but the field name `roles` on a single user is confusing (should be `role`). Not a runtime bug, but a schema clarity issue.

---

### 6. Hardcoded JWT secret in docker-compose
**Files:** `backend/docker-compose.yml:19`

`JWT_SECRET_KEY: change-me-in-production` is hardcoded. If deployed as-is, all tokens are signed with a known key.

**Fix:** Use an environment variable or secret management.

---

## Medium Issues

### 7. Missing `@iss` and `@sub` type safety in JWT
**Files:** `backend/app/core/security.py:35-88`

- `sub` is cast to `str` and back to `int`. This is fine.
- No `iss` (issuer) or `aud` (audience) claims. Not a bug, but reduces token hardening.

### 8. No actual test cases
**Files:** `backend/tests/`

Only `conftest.py` exists. There are zero test files covering register, login, refresh, or logout. The `client` fixture is session-scoped and shares a single DB connection, which makes test isolation fragile.

---

## Dependency Risk

### 9. `starlette==1.3.1` likely incompatible with `fastapi==0.140.0`
**Files:** `backend/requirements.txt:12`, `backend/requirements.txt:43`

FastAPI pins a specific Starlette version range. Starlette `1.3.1` is a major-version jump that almost certainly breaks FastAPI `0.140.0`.

**Fix:** Align Starlette to the version required by the installed FastAPI release.

---

## Validation Steps

1. Fix Dockerfile paths and run `docker compose build` in `backend/`.
2. Add `request.validate_password()` to `auth.py` register route.
3. Update CORS origins to explicit list or remove `allow_credentials`.
4. Add `@updatedAt` to `users.updated_at` in schema, run `prisma migrate dev`.
5. Run `pytest` after adding actual test cases.
6. Run `pip check` to verify dependency compatibility.
