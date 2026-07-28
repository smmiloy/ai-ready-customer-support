# Engineering Report

## Assumptions

- Basic chat system with login,logout functionality
- Rotation of refresh tokens
- Authentication layer for user sessions
- file Model and a proper file mode for migration like s3 to r2

## Data Modeling

- **User → Chats**: One-to-many relation (one user can have many chats)
- **Chat → Messages**: One-to-many relation (one chat can have many messages)
- **File model**: Designed with file migration in mind ( S3 to R2)

## Implementation Overview

A basic chat system with login/logout, refresh token rotation, and authentication. The system provides user registration, session management, and real-time messaging between users.

## Architecture & Project Structure

- **Backend**: Node.js with Express
- **Frontend**: Separate frontend application
- **Authentication**: JWT-based auth with refresh token rotation
- **Database**: Relational database with normalized schema
- **File Storage**: Abstracted file model to support migration between providers (S3 → R2)

## Three Important Technical Decisions

### 1. Signup Before Login

I chose to implement signup before login because without a registration endpoint, there would be no way for users to create accounts, making the login flow impossible to test and unfriendly to implement. Building signup first ensured a complete auth pipeline from the start.

### 2. Login System Design

The login system was designed early in the process as the core of the authentication flow. It handles credential validation, JWT issuance, and refresh token generation. A well-designed login system forms the foundation for all subsequent features.

### 3. One-to-Many Data Relationships

The one-to-many relationship between users and chats, and chats and messages, was chosen to naturally model real-world chat dynamics. A user participates in many chats, and each chat contains many messages. This structure keeps the schema normalized and queries efficient.

## AI Collaboration

As a Node.js developer, I used AI to translate code concepts into implementation. I reviewed AI-generated code carefully and tested all endpoints using a Postman collection. This workflow accelerated development while maintaining quality through manual verification.

## What Did You Learn?

- Explored a new technology stack under time pressure
- Learned that continuously trying a new stack can be grasped quickly with persistence
- Gained experience handling pressure with a short development period

## If You Had One Additional Day

I would improve error handling and add more comprehensive test coverage for the authentication flow and edge cases in the chat messaging system.

## What Part Took the Longest

The authentication system — particularly the refresh token rotation logic and ensuring secure session management — took the longest to implement and test.
