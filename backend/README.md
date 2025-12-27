# AuthJet Backend API

JWT Authentication as a Service - Backend API server built with Node.js, Express, and PostgreSQL.

## Features

- 🔐 Multi-tenant JWT authentication with per-application RSA-2048 keys
- 🔑 RSA private keys encrypted at rest with AES-256-GCM
- 👥 Multi-tenant client and application management
- �️ Robust JWKS (JSON Web Key Set) endpoints for public key discovery
- �🔄 Refresh token rotation with HTTP-only cookie support
- 📧 Email verification and password reset (Admin/Client/User)
- 🪝 Webhook integration for custom user claims
- 🚦 Rate limiting and audit logging
- 🔗 OAuth support (Google, GitHub)

## Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 13
- Redis (optional, for distributed rate limiting)
- npm >= 9.0.0

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp ../.env.example .env
   ```
   Edit `.env` and configure your database, JWT keys, and other settings.

3. **Set up the database:**
   ```bash
   # Create PostgreSQL database
   createdb authjet
   
   # Run migrations
   npm run migrate:up
   ```

4. **Generate JWT keys (if not provided in .env):**
   ```bash
   # The application will auto-generate keys on first run
   # For production, generate your own keys:
   openssl genrsa -out private.pem 2048
   openssl rsa -in private.pem -pubout -out public.pem
   ```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration
```

## API Endpoints

### User Auth (End-Users of Applications)
- `POST /api/user/register` - Register new application user
- `POST /api/user/login` - User login
- `POST /api/user/refresh-token` - Refresh access token (Cookie-based)
- `POST /api/user/logout` - Logout user
- `GET /api/user/profile` - Get current user info

### Client Auth (Application Owners)
- `POST /api/client/register` - Register as a client
- `POST /api/client/login` - Client login
- `POST /api/client/refresh-token` - Refresh client session (Cookie-based)
- `POST /api/client/logout` - Client logout
- `GET /api/client/profile` - Get client profile
- `GET /api/client/applications` - List applications
- `POST /api/client/applications` - Create application
- `GET /api/client/applications/:id/jwks` - Get application JWKS

### Admin Auth (SaaS Platform Admins)
- `POST /api/admin/login` - Admin login
- `POST /api/admin/refresh-token` - Refresh admin session (Cookie-based)
- `GET /api/admin/clients` - List all clients
- `GET /api/admin/dashboard/stats` - Platform statistics

### OAuth (User)
- `GET /api/auth/social/:provider` - Initiate OAuth (google/github)
- `GET /api/auth/social/:provider/callback` - OAuth callback

## Database Migrations

```bash
# Create a new migration
npm run migrate:create <migration-name>

# Run migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Reset all migrations
npm run migrate:reset
```

## Environment Variables

See `.env.example` for all available configuration options.

### Required Variables
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - Database connection
- `PORT` - Server port (default: 8000)
- `NODE_ENV` - Environment (development/production/test)
- `KEY_ENCRYPTION_KEY` - 32-byte key for AES-256-GCM encryption of private keys
- `JWT_SECRET` - Secret for session signatures (legacy tokens)
- `SESSION_SECRET` - Secret for express sessions
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth credentials
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` - GitHub OAuth credentials
- `SMTP_*` - Email configuration for notifications
- `REDIS_URL` - Redis connection for rate limiting (optional)

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Express middleware
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic services
│   ├── utils/           # Utility functions
│   └── app.js           # Express app setup
├── migrations/          # Database migrations
├── tests/               # Test files
├── index.js             # Server entry point
└── package.json         # Dependencies and scripts
```

## Security Considerations

- Always use HTTPS in production
- Set strong `SESSION_SECRET` and `JWT_PRIVATE_KEY`
- Configure `ALLOWED_ORIGINS` for CORS
- Enable Redis for distributed rate limiting in production
- Regularly rotate JWT keys
- Monitor audit logs for suspicious activity

## Docker Support

```bash
# Build Docker image
npm run docker:build

# Run Docker container
npm run docker:run
```

## License

MIT License - see LICENSE file for details
