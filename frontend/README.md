# AuthJet Frontend

React-based dashboard for managing JWT authentication services.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env and set REACT_APP_API_URL to your backend URL
```

### 3. Start Development Server
```bash
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

## Available Scripts

- `npm start` - Start development server
- `npm build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App

## Project Structure

```
frontend/
├── public/           # Static files
├── src/
│   ├── components/   # React components
│   ├── context/      # React context (Auth)
│   ├── hooks/        # Custom hooks
│   ├── pages/        # Page components
│   ├── services/     # API services
│   ├── utils/        # Utility functions
│   ├── App.jsx       # Main app component
│   ├── index.js      # Entry point
│   └── index.css     # Global styles
└── package.json      # Dependencies

## Features

- 🔐 User authentication (login/logout)
- 👥 Client management
- 📊 Dashboard with analytics
- ⚙️ Settings and configuration
- 🔗 OAuth integration
- 🎨 Modern UI with TailwindCSS

## Environment Variables

- `REACT_APP_API_URL` - Backend API URL (required)

## Integration Issues Fixed

All integration issues have been fixed! See `INTEGRATION_FIXES.md` for details.

## Building for Production

```bash
npm run build
```

This creates an optimized production build in the `build/` folder.

## License

MIT
