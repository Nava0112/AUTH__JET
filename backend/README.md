# AuthJet Backend API

JWT Authentication as a Service - Backend API server built with Node.js, Express, and PostgreSQL.

## Features

- 🔐 JWT-based authentication with RS256 signing
- 👥 Multi-tenant client management
- 🔄 Refresh token rotation
- 📧 Email verification and password reset
- 🪝 Webhook integration for custom claims
- 🚦 Rate limiting with Redis support
- 📊 Session management and audit logging
- 🔗 OAuth support (Google, GitHub)
- 🛡️ Security best practices (helmet, CORS, etc.)

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

### Health Check
- `GET /health` - Server health status

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/verify` - Verify JWT token
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### OAuth
- `GET /api/auth/oauth/google` - Initiate Google OAuth
- `GET /api/auth/oauth/google/callback` - Google OAuth callback
- `GET /api/auth/oauth/github` - Initiate GitHub OAuth
- `GET /api/auth/oauth/github/callback` - GitHub OAuth callback

### Client Management (Admin)
- `POST /api/clients` - Create new client
- `GET /api/clients` - List clients
- `GET /api/clients/:id` - Get client details
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client
- `POST /api/clients/:id/regenerate-key` - Regenerate API key

### User Management
- `GET /api/users/:client_id/users` - List users
- `GET /api/users/:client_id/users/:user_id` - Get user details
- `PUT /api/users/:client_id/users/:user_id` - Update user
- `GET /api/users/:client_id/users/:user_id/sessions` - Get user sessions
- `DELETE /api/users/:client_id/users/:user_id/sessions/:session_id` - Revoke session

### Webhooks
- `POST /api/webhooks/:client_id/test` - Test webhook
- `GET /api/webhooks/:client_id/logs` - Get webhook logs
- `GET /api/webhooks/:client_id/stats` - Get webhook statistics

### JWKS
- `GET /.well-known/jwks.json` - Public key for JWT verification

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
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production/test)

### Optional Variables
- `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` - JWT signing keys (auto-generated if not provided)
- `REDIS_URL` - Redis connection for distributed rate limiting
- `SMTP_*` - Email configuration for notifications
- `GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_ID` - OAuth configuration

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
