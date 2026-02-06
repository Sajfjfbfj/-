# Technology Stack

## Programming Languages
- **JavaScript (ES6+)**: Primary language for both frontend and backend
- **JSX**: React component syntax
- **CSS**: Styling with Tailwind utility classes

## Frontend Technologies

### Core Framework
- **React 19.2.0**: UI library with functional components and hooks
- **React DOM 19.2.0**: React rendering for web

### Build Tools
- **Vite 7.2.4**: Fast build tool and dev server
- **@vitejs/plugin-react 5.1.1**: React plugin for Vite

### Styling
- **Tailwind CSS 4.1.18**: Utility-first CSS framework
- **PostCSS 8.5.6**: CSS processing
- **Autoprefixer 10.4.23**: CSS vendor prefixing

### UI Components & Libraries
- **lucide-react 0.562.0**: Icon library
- **qrcode.react 4.2.0**: QR code generation
- **html5-qrcode 2.3.8**: QR code scanning
- **uuid 13.0.0**: Unique ID generation

## Backend Technologies

### Server Framework
- **Express 5.2.1**: Web application framework
- **express-session 1.18.2**: Session middleware

### Database
- **MongoDB 7.0.0**: NoSQL database
- **Connection pooling**: Cached client with min/max pool sizes

### Middleware
- **cors 2.8.5**: Cross-origin resource sharing
- **dotenv 17.2.3**: Environment variable management

## Development Tools

### Code Quality
- **ESLint 9.39.1**: JavaScript linting
- **@eslint/js 9.39.1**: ESLint JavaScript config
- **eslint-plugin-react-hooks 7.0.1**: React hooks linting
- **eslint-plugin-react-refresh 0.4.24**: React refresh linting
- **globals 16.5.0**: Global variables definitions

### Development Utilities
- **concurrently 9.2.1**: Run multiple commands simultaneously
- **@types/react 19.2.5**: TypeScript definitions for React
- **@types/react-dom 19.2.3**: TypeScript definitions for React DOM

## Deployment Platforms
- **Railway**: Primary deployment platform (railway.json)
- **Vercel**: Alternative deployment option (vercel.json)
- **Heroku**: Supported via heroku-postbuild script

## Environment Configuration

### Required Environment Variables
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
PORT=3001 (optional, defaults to 3001)
NODE_ENV=production (for production builds)
```

### Development Setup
```bash
npm install          # Install dependencies
npm run dev          # Start dev server (client + server)
npm run dev:client   # Start only Vite dev server
npm run server       # Start only Express server
```

### Production Build
```bash
npm run build        # Build for production
npm start            # Start production server
```

## API Architecture

### REST Endpoints
- `GET /api/health` - Health check
- `GET /api/tournaments` - List tournaments
- `POST /api/tournaments` - Create/update tournament
- `DELETE /api/tournaments/:id` - Delete tournament
- `GET /api/applicants/:tournamentId` - Get participants
- `POST /api/applicants` - Register participant
- `POST /api/checkin` - Check-in participant
- `POST /api/results` - Record score
- `POST /api/ranking/shichuma` - Save shoot-off result
- `POST /api/ranking/enkin` - Save distance result
- `POST /api/ranking/shichuma/final` - Save final shoot-off results
- `GET /api/ranking/shichuma/:tournamentId` - Get shoot-off results
- `DELETE /api/ranking/shichuma/:tournamentId` - Delete shoot-off results
- `POST /api/ranking/enkin/final` - Save final distance results
- `GET /api/ranking/enkin/:tournamentId` - Get distance results
- `DELETE /api/ranking/enkin/:tournamentId` - Delete distance results
- `GET /api/ranking/shootoff/:tournamentId` - Get all competition results
- `PATCH /api/applicants/:archerId/gender` - Update gender
- `POST /api/ranking/clear/:tournamentId` - Clear competition fields

## Browser Compatibility
- Modern browsers with ES6+ support
- Camera API support for QR scanning
- LocalStorage support for session persistence

## Performance Optimizations
- Code splitting with manual chunks (react, vendor)
- Source maps enabled for debugging
- Connection pooling for database
- Optimistic UI updates
- Polling-based real-time sync (3s intervals)
