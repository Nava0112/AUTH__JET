# 🔐 AuthJet

> **JWT Authentication as a Service** - A comprehensive authentication and authorization solution built with modern web technologies.

[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

## 📖 Overview

AuthJet is a full-stack JWT-based authentication and authorization application that provides secure, scalable user management with multi-tenant support. It features a modern React dashboard, robust Node.js backend, and comprehensive security features including OAuth integration, rate limiting, and session management.

## ✨ Key Features

### 🔐 Authentication & Authorization
- **JWT-based authentication** with RS256 signing algorithm
- **Refresh token rotation** for enhanced security
- **Multi-tenant client management** for isolated user spaces
- **Session management** with audit logging
- **Email verification** and password reset flows
- **Token validation** and verification endpoints

### 🔗 OAuth Integration
- Google OAuth 2.0 support
- GitHub OAuth integration
- Seamless third-party authentication flows

### 🛡️ Security
- Industry-standard security practices (Helmet, CORS)
- Rate limiting with Redis support
- Bcrypt password hashing
- Environment-based configuration
- HTTPS enforcement for production
- Webhook integration for custom claims

### 📊 Management Dashboard
- Modern React-based UI with TailwindCSS
- Client management interface
- User management and monitoring
- Analytics and statistics
- Settings and configuration panel

### 🚀 Developer-Friendly
- RESTful API design
- Comprehensive API documentation
- Database migrations support
- Docker support
- Extensive test coverage
- JWKS endpoint for external verification

## 🏗️ Architecture

```
AUTH__JET/
├── backend/              # Node.js + Express API Server
│   ├── src/
│   │   ├── config/       # Configuration files
│   │   ├── controllers/  # Route controllers
│   │   ├── middleware/   # Custom middleware
│   │   ├── models/       # Database models
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   └── utils/        # Helper functions
│   ├── migrations/       # Database migrations
│   └── tests/            # Test suites
│
├── frontend/             # React Dashboard
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── context/      # Context providers
│   │   ├── hooks/        # Custom React hooks
│   │   ├── pages/        # Page components
│   │   ├── services/     # API service layer
│   │   └── utils/        # Utility functions
│   └── public/           # Static assets
│
└── database/             # Database schemas and seeds
    ├── schema.sql        # PostgreSQL schema
    └── seeds.sql         # Sample data
```

## 🚀 Quick Start

### Prerequisites

Ensure you have the following installed: 
- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **PostgreSQL** >= 13
- **Redis** (optional, for distributed rate limiting)

### Installation

#### 1. Clone the repository
```bash
git clone https://github.com/Nava0112/AUTH__JET.git
cd AUTH__JET
```

#### 2. Set up the Backend

```bash
cd backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your configuration

# Set up PostgreSQL database
createdb authjet_db

# Run database migrations
npm run migrate: up

# Start the backend server
npm run dev
```

The backend API will be available at `http://localhost:5001`

#### 3. Set up the Frontend

```bash
cd ../frontend

# Install dependencies
npm install

# Configure environment variables
cp . env.example .env
# Edit .env and set REACT_APP_API_URL=http://localhost:5001

# Start the development server
npm start
```

The frontend dashboard will open at `http://localhost:3000`

#### 4. Set up the Database (Optional)

```bash
# Load sample data
psql -U postgres -d authjet_db -f database/seeds.sql
```

## 🔧 Configuration

### Environment Variables

#### Backend Configuration (. env)
```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/authjet_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=authjet_db
DB_USER=username
DB_PASSWORD=password

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-refresh-secret-key
SESSION_SECRET=your-session-secret

# OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Server
PORT=5001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Redis (Optional)
REDIS_URL=redis://localhost:6379
```

#### Frontend Configuration (.env)
```env
REACT_APP_API_URL=http://localhost:5001
NODE_ENV=development
```

### Generate JWT Keys

For production environments, generate your own RSA key pairs:

```bash
# Generate private key
openssl genrsa -out private.pem 2048

# Generate public key
openssl rsa -in private.pem -pubout -out public.pem
```

## 📚 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout user |
| POST | `/api/auth/verify` | Verify JWT token |
| GET | `/api/auth/me` | Get current user info |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |

### OAuth Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/oauth/google` | Initiate Google OAuth |
| GET | `/api/auth/oauth/google/callback` | Google OAuth callback |
| GET | `/api/auth/oauth/github` | Initiate GitHub OAuth |
| GET | `/api/auth/oauth/github/callback` | GitHub OAuth callback |

### Client Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/clients` | Create new client |
| GET | `/api/clients` | List all clients |
| GET | `/api/clients/:id` | Get client details |
| PUT | `/api/clients/:id` | Update client |
| DELETE | `/api/clients/:id` | Delete client |
| POST | `/api/clients/:id/regenerate-key` | Regenerate API key |

### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/: client_id/users` | List users |
| GET | `/api/users/:client_id/users/:user_id` | Get user details |
| PUT | `/api/users/:client_id/users/:user_id` | Update user |
| GET | `/api/users/:client_id/users/:user_id/sessions` | Get user sessions |
| DELETE | `/api/users/:client_id/users/:user_id/sessions/: session_id` | Revoke session |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/: client_id/test` | Test webhook |
| GET | `/api/webhooks/:client_id/logs` | Get webhook logs |
| GET | `/api/webhooks/:client_id/stats` | Get webhook stats |

### JWKS

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/.well-known/jwks. json` | Public keys for JWT verification |

## 🧪 Testing

```bash
# Backend tests
cd backend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration
```

```bash
# Frontend tests
cd frontend

# Run tests
npm test
```

## 🐳 Docker Support

```bash
# Build backend Docker image
cd backend
npm run docker:build

# Run backend container
npm run docker:run
```

## 📊 Database Migrations

```bash
# Create a new migration
npm run migrate:create <migration-name>

# Run pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Reset all migrations
npm run migrate:reset
```

## 🛡️ Security Best Practices

- ✅ Always use HTTPS in production
- ✅ Set strong `SESSION_SECRET` and `JWT_PRIVATE_KEY`
- ✅ Configure `ALLOWED_ORIGINS` for CORS properly
- ✅ Enable Redis for distributed rate limiting in production
- ✅ Regularly rotate JWT keys
- ✅ Monitor audit logs for suspicious activity
- ✅ Keep dependencies up to date
- ✅ Use environment variables for sensitive data
- ✅ Implement proper input validation

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**Nava0112**
- GitHub: [@Nava0112](https://github.com/Nava0112)

## 🙏 Acknowledgments

- Built with [Node.js](https://nodejs.org/) and [Express](https://expressjs.com/)
- Frontend powered by [React](https://reactjs.org/)
- Database:  [PostgreSQL](https://www.postgresql.org/)
- Styled with [TailwindCSS](https://tailwindcss.com/)

## 📞 Support

If you have any questions or need help, please open an issue in the [GitHub repository](https://github.com/Nava0112/AUTH__JET/issues).

---

⭐ **Star this repository** if you find it helpful!

Built with ❤️ by [Nava0112](https://github.com/Nava0112)
