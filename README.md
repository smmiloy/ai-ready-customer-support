# AI-Ready Customer Support

A production-style FastAPI + Next.js application with JWT authentication, soft-deleted chats, file uploads via Cloudinary, and AI-generated system responses.

## Architecture

```
Client (Next.js)
    │
    ├── /auth/*        → Registration, login, refresh, logout
    ├── /chats/*       → Chat CRUD
    ├── /chats/{id}/messages → Send message, list messages
    └── /files/upload  → Upload file (Cloudinary)
           │
           ▼
FastAPI Backend (PostgreSQL + Prisma ORM)
```

## Database Schema

| Model | Description |
|-------|-------------|
| `users` | Authenticated users |
| `roles` | RBAC role catalog (`USER`) |
| `refresh_tokens` | Persistent refresh-token store |
| `chats` | User chats, soft-deletable |
| `messages` | Chat messages (user + system) |
| `uploaded_files` | Cloudinary file registry |
| `message_files` | Many-to-many join table |

### Entity Details

#### users
| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `Int` (PK) | auto-increment |
| `name` | `VarChar(200)` | NOT NULL |
| `email` | `VarChar(255)` | UNIQUE, NOT NULL |
| `password_hash` | `VarChar(255)` | NOT NULL |
| `role_id` | `Int` (FK → roles.id) | INDEXED |
| `created_at` | `Timestamptz(6)` | DEFAULT now() |
| `updated_at` | `Timestamptz(6)` | DEFAULT now(), updatedAt |

#### roles
| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `Int` (PK) | auto-increment |
| `name` | `VarChar(50)` | UNIQUE, NOT NULL |

#### refresh_tokens
| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `Int` (PK) | auto-increment |
| `user_id` | `Int` (FK → users.id) | CASCADE delete |
| `token_hash` | `VarChar(64)` | UNIQUE, SHA-256 hashed |
| `expires_at` | `Timestamptz(6)` | NOT NULL |
| `created_at` | `Timestamptz(6)` | DEFAULT now() |

#### chats
| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `UUID` (PK) | gen_random_uuid() |
| `user_id` | `Int` (FK → users.id) | CASCADE delete, INDEXED |
| `title` | `VarChar(200)` | NULLABLE |
| `status` | `ChatStatus` | DEFAULT `ACTIVE`, INDEXED |
| `created_at` | `Timestamptz(6)` | DEFAULT now() |

#### messages
| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `UUID` (PK) | gen_random_uuid() |
| `chat_id` | `UUID` (FK → chats.id) | CASCADE delete, INDEXED |
| `sender` | `VarChar(10)` | NOT NULL (`user` or `system`) |
| `content` | `Text` | NOT NULL |
| `created_at` | `Timestamptz(6)` | DEFAULT now() |

#### uploaded_files
| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `UUID` (PK) | gen_random_uuid() |
| `public_id` | `VarChar(255)` | UNIQUE, Cloudinary ID |
| `secure_url` | `Text` | NOT NULL |
| `resource_type` | `VarChar(50)` | NOT NULL |
| `file_name` | `VarChar(255)` | NOT NULL |
| `file_type` | `VarChar(100)` | NOT NULL |
| `file_size` | `Int` | NOT NULL |
| `uploaded_by` | `Int` (FK → users.id) | CASCADE delete, INDEXED |
| `created_at` | `Timestamptz(6)` | DEFAULT now() |

#### message_files
| Field | Type | Constraints |
|-------|------|-------------|
| `message_id` | `UUID` | FK → messages.id, PK composite, CASCADE delete |
| `file_id` | `UUID` | FK → uploaded_files.id, PK composite, CASCADE delete |

#### ChatStatus Enum
| Value | Meaning |
|-------|---------|
| `ACTIVE` | Visible in lists; chat is usable |
| `DELETED` | Soft-deleted; excluded from default list queries |

## Authentication

### Security Stack
- **Password hashing:** Argon2 via `pwdlib`
- **Access token:** JWT, HS256, 15-minute expiry, contains `sub`, `type: "access"`, `iat`, `exp`, `jti`
- **Refresh token:** JWT, HS256, 30-day expiry, contains `sub`, `type: "refresh"`, `iat`, `exp`, `jti`
- **Storage:** Refresh tokens are stored DB-side with SHA-256 hashes (`SHA256(token).hexdigest()`)

### Refresh Token Rotation
On every successful `POST /auth/refresh` the backend:
1. Validates the presented refresh token signature, expiry, and DB presence
2. Issues a **new access token** and a **new refresh token**
3. Updates the existing DB row's `token_hash` + `expires_at` in-place
4. Returns both new tokens

This means reuse of a previously issued refresh token fails, mitigating replay attacks. The client must persist the new refresh token and replace it on every rotation.

### Register
```http
POST /auth/register
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "SecureP@ssw0rd!"
}
```

Password policy:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 digit
- At least 1 special character (`!@#$%^&*(),.?":{}|<>`)

Response:
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "name": "Jane Doe",
    "email": "jane@example.com"
  }
}
```

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "jane@example.com",
  "password": "SecureP@ssw0rd!"
}
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

The access token is a short-lived bearer token used in the `Authorization` header. The refresh token is a long-lived token stored both client-side (localStorage) and server-side (hashed in DB).

### Refresh
```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "<current_refresh_token>"
}
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

If the refresh token is expired, revoked, or invalid, returns `401 Unauthorized`.

### Logout
```http
POST /auth/logout
Content-Type: application/json

{
  "refresh_token": "<current_refresh_token>"
}
```

Response:
```json
{
  "message": "Logged out successfully"
}
```

The backend deletes the `refresh_tokens` row, immediately invalidating that refresh token. The client must also clear `access_token`, `refresh_token`, and `user` from localStorage.

### Get Current User
```http
GET /auth/me
Authorization: Bearer <access_token>
```

Response:
```json
{
  "id": 1,
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```

## Chats API

All endpoints require a valid Bearer access token. Chats are soft-deleted.

### List Chats
```http
GET /chats/
Authorization: Bearer <access_token>
```

Query parameters:
| Param | Type | Default | Constraints |
|-------|------|---------|-------------|
| `skip` | int | 0 | ≥ 0 |
| `limit` | int | 20 | 1 – 100 |

Response:
```json
{
  "chats": [
    {
      "id": "a1b2c3d4-...",
      "user_id": 1,
      "title": "Support Inquiry",
      "status": "ACTIVE",
      "created_at": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 1
}
```

### Get Single Chat
```http
GET /chats/{chat_id}
Authorization: Bearer <access_token>
```

### Create Chat
```http
POST /chats/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "New Support Chat"
}
```

Response:
```json
{
  "id": "a1b2c3d4-...",
  "user_id": 1,
  "title": "New Support Chat",
  "status": "ACTIVE",
  "created_at": "2025-01-15T10:00:00Z"
}
```

### Update Chat (Rename)
```http
PATCH /chats/{chat_id}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "Renamed Chat"
}
```

`title` is optional. Passing `null` or omitting it leaves the title unchanged. Passing an empty string is treated as `null` by the backend schema (`str | None`).

Response:
```json
{
  "id": "a1b2c3d4-...",
  "user_id": 1,
  "title": "Renamed Chat",
  "status": "ACTIVE",
  "created_at": "2025-01-15T10:00:00Z"
}
```

### Delete Chat (Soft Delete)
```http
DELETE /chats/{chat_id}
Authorization: Bearer <access_token>
```

Response:
```json
{
  "message": "Chat deleted successfully"
}
```

Soft delete sets `status = "DELETED"`. After deletion, the chat no longer appears in `GET /chats/` and cannot be retrieved via `GET /chats/{chat_id}`.

## Messages API

### Send Message
```http
POST /chats/{chat_id}/messages
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "content": "I need help with my order."
}
```

Constraints:
- `content` length: 1 – 2000 characters

Behavior:
1. Validates the chat exists, belongs to the current user, and is `ACTIVE`
2. Creates a `user` message
3. Creates a `system` message with a randomly chosen response

System response pool:
- "Thank you for your message. Our team will get back to you shortly."
- "We have received your query and will respond as soon as possible."
- "Thanks for reaching out! A support agent will be with you soon."
- "Your message has been received. Please allow us some time to assist you."
- "Hello! Thanks for contacting us. We appreciate your patience."

Response:
```json
{
  "id": "msg-uuid-here",
  "chat_id": "a1b2c3d4-...",
  "sender": "user",
  "content": "I need help with my order.",
  "created_at": "2025-01-15T10:05:00Z"
}
```

### List Messages
```http
GET /chats/{chat_id}/messages?skip=0&limit=50
Authorization: Bearer <access_token>
```

Query parameters:
| Param | Type | Default | Constraints |
|-------|------|---------|-------------|
| `skip` | int | 0 | ≥ 0 |
| `limit` | int | 50 | 1 – 100 |

Response:
```json
{
  "messages": [
    {
      "id": "msg-uuid",
      "chat_id": "a1b2c3d4-...",
      "sender": "user",
      "content": "I need help with my order.",
      "created_at": "2025-01-15T10:05:00Z",
      "files": [
        {
          "id": "file-uuid",
          "public_id": "user_1/abc123",
          "secure_url": "https://res.cloudinary.com/...",
          "resource_type": "image",
          "file_name": "receipt.png",
          "file_type": "image/png",
          "file_size": 245678,
          "uploaded_by": 1,
          "created_at": "2025-01-15T10:05:01Z"
        }
      ]
    },
    {
      "id": "msg-uuid-2",
      "chat_id": "a1b2c3d4-...",
      "sender": "system",
      "content": "Thank you for your message. Our team will get back to you shortly.",
      "created_at": "2025-01-15T10:05:02Z",
      "files": []
    }
  ],
  "total": 2
}
```

### Attach File to Message
```http
POST /chats/{chat_id}/messages/{message_id}/files
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "file_id": "file-uuid"
}
```

Response:
```json
{
  "detail": "File attached to message"
}
```

## Files API

### Upload File
```http
POST /files/upload
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

file: <binary>
```

Constraints:
- Allowed types: `image/*`, `application/pdf`, `text/*`
- Max file size: 10 MB
- Empty files are rejected

Provider: Cloudinary (`resource_type=auto`).

Response:
```json
{
  "id": "file-uuid",
  "public_id": "user_1/abc123",
  "secure_url": "https://res.cloudinary.com/...",
  "resource_type": "image",
  "file_name": "receipt.png",
  "file_type": "image/png",
  "file_size": 245678,
  "uploaded_by": 1,
  "created_at": "2025-01-15T10:05:01Z"
}
```

The returned file ID can then be attached to a message via `POST /chats/{chat_id}/messages/{message_id}/files`.

## Frontend API Layer

The Next.js frontend consumes the backend through typed wrappers in `frontend/src/lib/api.ts`:

| Function | HTTP Method | Endpoint | Redirect Behavior |
|----------|-------------|----------|-------------------|
| `registerUser` | POST | `/auth/register` | Manual `router.push("/login")` |
| `loginUser` | POST | `/auth/login` | Manual `router.push("/chats")` |
| `logoutUser` | POST | `/auth/logout` | Clears localStorage |
| `fetchChats` | GET | `/chats/` | Auto 401 refresh via `apiRequest` |
| `createChat` | POST | `/chats/` | Auto 401 refresh via `apiRequest` |
| `fetchChat` | GET | `/chats/{chatId}` | Auto 401 refresh via `apiRequest` |
| `updateChat` | PATCH | `/chats/{chatId}` | Auto 401 refresh via `apiRequest` |
| `deleteChat` | DELETE | `/chats/{chatId}` | Auto 401 refresh via `apiRequest` |
| `uploadFile` | POST | `/files/upload` | Manual 401 refresh (multipart) |
| `attachFileToMessage` | POST | `/chats/{chatId}/messages/{messageId}/files` | Auto 401 refresh via `apiRequest` |

### Auth Context (`AuthContext.tsx`)
- State: `user`, `accessToken`, `refreshToken`, `loading`
- `login(tokens, user)` — hydrates context + localStorage
- `logout()` — clears state + localStorage; fires backend logout best-effort
- `updateTokens(tokens)` — rotates storage on 401 refresh; used by `apiRequest` callback
- `isAuthenticated` — derived from presence of `accessToken`

### 401 Auto-Refresh Pattern
`apiRequest()` wraps `fetch`. On a `401` response with a refresh token present, it:
1. Calls `POST /auth/refresh`
2. Persists new tokens via `onRefresh`
3. Retries the original request with the new access token
4. Returns the final `Response`

The chat list and detail pages poll every 3 seconds; `loadChats()` explicitly handles 401 for list endpoints.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `JWT_SECRET_KEY` | HS256 signing secret | — |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token TTL | `15` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token TTL | `30` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | — |
| `CLOUDINARY_API_KEY` | Cloudinary API key | — |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | — |

## Getting Started

### Backend
```bash
cd backend
cp .env.example .env
pip install -r requirements.txt
prisma generate
prisma migrate dev
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

### Build
```bash
cd frontend
npm run build
```

## API Documentation

When the backend is running, interactive OpenAPI docs are available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
