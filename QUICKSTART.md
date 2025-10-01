# AuthJet SaaS - Quick Start Guide

Get your AuthJet authentication service running in minutes!

## Prerequisites

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 13
- **npm** >= 9.0.0
- **Redis** (optional, for distributed rate limiting)

## 1. Installation

```bash
# Clone or navigate to the project
cd authjet-saas

# Install backend dependencies
cd backend
npm install
```

## 2. Environment Configuration

```bash
# Copy the environment template
cp .env.example .env

# Edit .env with your configuration
nano .env  # or use your preferred editor
```

### Minimum Required Configuration

Edit `.env` and set:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=authjet
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# Server
PORT=5000
NODE_ENV=development

# Session (for OAuth)
SESSION_SECRET=your-random-secret-key-here
```

## 3. Database Setup

```bash
# Create the database
createdb authjet

# Or using psql
psql -U postgres -c "CREATE DATABASE authjet;"

# Run database migrations
npm run migrate:up
```

## 4. Validate Setup

```bash
# Run the setup validation script
npm run setup
```

This will check:
- ✅ Node.js version
- ✅ Required files
- ✅ Dependencies
- ✅ Environment variables
- ✅ Directory structure

## 5. Start the Server

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

## 6. Verify Installation

Test the health endpoint:

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2025-09-30T15:26:54.000Z",
  "uptime": 1.234,
  "environment": "development"
}
```

Test the JWKS endpoint:
```bash
curl http://localhost:5000/.well-known/jwks.json
```

## 7. Database Seeding (Optional)

If you have seed data:

```bash
psql -U postgres -d authjet -f ../database/seeds.sql
```

## Common Issues & Solutions

### Issue: "Cannot connect to database"

**Solution:**
1. Ensure PostgreSQL is running: `pg_isready`
2. Check database credentials in `.env`
3. Verify database exists: `psql -U postgres -l | grep authjet`

### Issue: "Port already in use"

**Solution:**
1. Change `PORT` in `.env` to another port (e.g., 3001)
2. Or kill the process using the port:
   ```bash
   # Windows
   netstat -ano | findstr :5000
   taskkill /PID <PID> /F
   
   # Linux/Mac
   lsof -ti:5000 | xargs kill
   ```

### Issue: "Missing dependencies"

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Session/OAuth errors"

**Solution:**
1. Ensure `express-session` is installed
2. Set `SESSION_SECRET` in `.env`
3. Run `npm install` to install missing packages

## Project Structure

```
authjet-saas/
├── backend/
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # Route controllers
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   └── utils/          # Utilities
│   ├── migrations/         # Database migrations
│   ├── tests/              # Test files
│   ├── logs/               # Log files (auto-created)
│   ├── index.js            # Entry point
│   └── package.json
├── database/               # Database scripts
├── frontend/               # Frontend application
└── .env                    # Environment variables
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Health & Monitoring
- `GET /health` - Server health check
- `GET /.well-known/jwks.json` - Public keys for JWT verification

### Client Management (Admin)
- `POST /api/clients` - Create client
- `GET /api/clients` - List clients
- `GET /api/clients/:id` - Get client details

See `backend/README.md` for complete API documentation.

## Next Steps

1. **Test the API** - Use Postman or curl to test endpoints
2. **Set up Frontend** - Configure the frontend to connect to your backend
3. **Configure OAuth** - Set up Google/GitHub OAuth if needed
4. **Set up Email** - Configure SMTP for email notifications
5. **Enable Redis** - Set up Redis for distributed rate limiting
6. **Production Deployment** - See deployment guide for production setup

## Development Workflow

```bash
# Run in development with auto-reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Check code style
npm run lint

# Fix code style issues
npm run lint:fix

# Format code
npm run format
```

## Useful Commands

```bash
# Database migrations
npm run migrate:up        # Run all pending migrations
npm run migrate:down      # Rollback last migration
npm run migrate:create    # Create new migration

# Testing
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm run test:integration  # Integration tests only

# Code quality
npm run lint              # Check for linting errors
npm run lint:fix          # Auto-fix linting errors
npm run format            # Format code with Prettier
```

## Configuration Checklist

Before deploying to production:

- [ ] Set strong `SESSION_SECRET`
- [ ] Generate and set `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY`
- [ ] Configure `ALLOWED_ORIGINS` for CORS
- [ ] Set up Redis with `REDIS_URL`
- [ ] Configure SMTP settings for emails
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS
- [ ] Set up database backups
- [ ] Configure monitoring and logging
- [ ] Set appropriate rate limits

## Support & Resources

- **Documentation**: See `backend/README.md` for detailed docs
- **Integration Fixes**: See `backend/INTEGRATION_FIXES.md` for setup details
- **Environment Variables**: See `.env.example` for all options

## Success Indicators

✅ Your setup is working correctly if:
- Health endpoint returns `200 OK`
- JWKS endpoint returns public key
- Logs are being written to `backend/logs/`
- Database connection is established
- No errors in console output

---

**Ready to build amazing authentication experiences! 🚀**
