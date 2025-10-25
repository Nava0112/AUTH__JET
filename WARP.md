# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**AuthJet** is a JWT Authentication as a Service platform with a multi-tenant SaaS architecture. The system consists of three user types:
1. **Admins** - Platform administrators who manage the SaaS
2. **Clients** - Organizations that use AuthJet for authentication (each can have multiple applications)
3. **Users** - End users of client applications

The codebase is split into:
- **Backend** (Node.js/Express/PostgreSQL) - API server with JWT authentication services
- **Frontend** (React) - Dashboard for managing authentication
- **Database** - PostgreSQL with migration-based schema management

## Development Commands

### Initial Setup

```powershell
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ..\frontend
npm install

# Setup database (from root or backend)
# First create PostgreSQL database: createdb authjet
# Then run migrations
cd backend
npm run migrate:up

# For multi-tenant setup
npm run setup:multi-tenant
```

### Backend Commands

```powershell
cd backend

# Development
npm run dev          # Start with nodemon (auto-reload)
npm start            # Start production server (port 8000)

# Testing
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run test:integration  # Integration tests only

# Database Migrations
npm run migrate:create <name>  # Create new migration
npm run migrate:up            # Run pending migrations
npm run migrate:down          # Rollback last migration
npm run migrate:reset         # Reset all migrations
npm run migrate:multi-tenant  # Run multi-tenant migration

# Code Quality
npm run lint         # Lint code
npm run lint:fix     # Lint and auto-fix
npm run format       # Format with Prettier

# Docker
npm run docker:build  # Build Docker image
npm run docker:run    # Run in Docker
```

### Frontend Commands

```powershell
cd frontend

# Development
npm start            # Start dev server (port 3000)
npm run dev          # Same as start (with PORT=3000 explicitly)

# Production
npm run build        # Build for production

# Testing
npm test             # Run tests
```

## Architecture & Key Concepts

### Multi-Tenant Architecture

The system follows a hierarchical structure:
- **Admins** create and manage **Clients**
- **Clients** (organizations) can create multiple **Applications**
- **Users** belong to a specific **Application** and **Client**
- Each **Client** gets unique RSA key pairs for JWT signing (per application if needed)

**Database Schema Highlights:**
- `admins` - Platform administrators
- `clients` - Organizations using AuthJet (have api_key, secret_key_hash)
- `client_applications` - Apps within a client (have client_id_key, client_secret_hash)
- `users` - End users (email unique per application, not globally)
- `client_keys` - RSA key pairs for JWT signing (encrypted private keys)
- `sessions` - Tracks sessions for admins, clients, and users
- `user_sessions` - Additional user session tracking with refresh tokens

### JWT System

**Two JWT Implementations:**
1. **Platform-level JWT** (`userJwt.service.js`) - RS256 signing using keys from environment or files (`keys/private.key`, `keys/public.key`)
2. **Client-specific JWT** (`clientKey.service.js`) - Each client gets their own RSA key pair stored in `client_keys` table with encrypted private keys

**Key Points:**
- RS256 (asymmetric) algorithm used throughout
- Access tokens: 15 minutes (dev), 1 hour (production)
- Refresh tokens: 7 days
- Private keys encrypted with AES-256-CBC before storage
- JWKS endpoints available at `/.well-known/jwks.json`

### Route Structure

**Backend Routes:**
- `/health` - Health check
- `/api/auth/*` - Legacy authentication endpoints
- `/api/admin/*` - Admin management (login, registration)
- `/api/client/*` - Client management and authentication
- `/api/user/*` - User authentication and management
- `/api/clients/*` - Client CRUD operations
- `/api/users/:client_id/users/*` - User management per client
- `/api/webhooks/*` - Webhook configuration and testing
- `/api/analytics/*` - Analytics endpoints
- `/api/dashboard/*` - Dashboard data
- `/oauth/*` & `/auth/*` - OAuth 2.0 flows
- `/api/auth/oauth/google` & `/api/auth/oauth/github` - Social OAuth

**Frontend Routes:**
- Landing pages for different user types (admin, client, user)
- Dashboard with client and user management
- Settings and configuration pages

### Project Structure

#### Backend (`backend/src/`)
- `config/` - Configuration files (database, jwt, server settings)
- `controllers/` - Request handlers for routes
- `middleware/` - Express middleware (auth, rate limiting, error handling)
- `models/` - Database models (Admin, Client, User, etc.)
- `routes/` - Route definitions for all API endpoints
- `services/` - Business logic (JWT, OAuth, webhooks, client keys)
- `utils/` - Utility functions (database, logger, validators)
- `app.js` - Express app setup with middleware and routes
- `migrations/` - Database migration files (outside src/)

#### Frontend (`frontend/src/`)
- `components/` - Reusable React components
- `context/` - React Context (Auth context)
- `hooks/` - Custom React hooks
- `pages/` - Page-level components
- `services/` - API service layer for backend communication
- `utils/` - Utility functions
- `App.jsx` - Main application component with routing

### Security Features

- **Helmet** for security headers with CSP
- **CORS** with dynamic origin validation
- **Rate limiting** (global: 100 req/15min, auth: 5 attempts/hour in prod)
- **bcrypt** for password hashing (12 rounds)
- **Session security** with httpOnly cookies
- **Private key encryption** using AES-256-CBC
- **OAuth support** for Google and GitHub

### Environment Configuration

**Critical Environment Variables:**
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - PostgreSQL connection
- `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` - Platform JWT keys (can be in files or env vars)
- `KEY_ENCRYPTION_KEY` - For encrypting client private keys (uses dev key if not set)
- `SESSION_SECRET` - For session management
- `PORT` - Backend port (default: 8000)
- `NODE_ENV` - Environment (development/production/test)
- `ALLOWED_ORIGINS` - CORS origins (comma-separated)

See `.env.example` for complete list.

### Database Migrations

**Important:** This project uses `node-pg-migrate` for schema changes.

**Key Migration:**
- `002-multi-tenant-restructure.js` - Major migration that restructures tables for multi-tenant architecture. Backs up existing `clients` and `users` tables before recreating.

## Common Workflows

### Adding a New API Endpoint
1. Create route handler in `backend/src/routes/`
2. Implement controller logic in `backend/src/controllers/`
3. Add business logic in `backend/src/services/` if needed
4. Add model if new database table in `backend/src/models/`
5. Register route in `backend/src/app.js`

### Creating a Database Migration
```powershell
cd backend
npm run migrate:create <descriptive-name>
# Edit the generated file in migrations/
npm run migrate:up
```

### Testing JWT System
Run existing test files to verify JWT functionality:
```powershell
cd backend
node test-final-jwt.js          # Test complete JWT flow
node test-client-keys-final.js  # Test client key generation
```

### Running as Multi-Tenant
```powershell
# From root directory
node setup-multi-tenant.js

# Or from backend
npm run setup:multi-tenant
```

## Important Notes

- **Windows Development:** This project is being developed on Windows with PowerShell
- **Node.js Version:** Requires Node.js >= 18.0.0, npm >= 9.0.0
- **PostgreSQL Version:** Requires PostgreSQL >= 13
- **Redis:** Optional, for distributed rate limiting in production
- **JWKS Support:** Public keys available at `/.well-known/jwks.json` endpoint
- **OAuth Flows:** Use session middleware; sessions expire after 10 minutes
- **Key Rotation:** Clients can have multiple keys, but only one active at a time
- **Logging:** Winston logger used throughout; logs written to `backend/logs/`
- **Email:** Nodemailer configured for email verification and password reset
- **Testing:** Jest configured; tests in `backend/test/` directory

## Integration Fixes

The project has undergone significant integration fixes. See:
- `backend/FINAL_STATUS.md` - Complete status of backend fixes
- `backend/INTEGRATION_FIXES.md` - Detailed integration fixes
- `frontend/INTEGRATION_FIXES.md` - Frontend integration fixes

All major integration issues have been resolved and the application is production-ready after dependency installation and database setup.

