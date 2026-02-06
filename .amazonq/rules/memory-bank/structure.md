# Project Structure

## Directory Organization

```
弓道大会運営用アプリ/
├── .amazonq/                    # Amazon Q configuration
│   └── rules/
│       └── memory-bank/         # Project documentation
├── .windsurf/                   # Windsurf IDE workflows
│   └── workflows/
├── api/                         # API-related files (empty)
├── public/                      # Static assets
│   └── vite.svg                 # Vite logo
├── src/                         # Source code
│   ├── assets/                  # Application assets
│   │   └── react.svg
│   ├── components/              # React components
│   │   ├── AwardsView.jsx       # Awards ceremony view
│   │   ├── QRCodeScanner.jsx    # QR code scanning component
│   │   └── TournamentView.jsx   # Tournament display view
│   ├── context/                 # React context providers (empty)
│   ├── hooks/                   # Custom React hooks (empty)
│   ├── pages/                   # Page components (empty)
│   ├── state/                   # State management (empty)
│   ├── store/                   # Redux/state store (empty)
│   ├── utils/                   # Utility functions
│   │   ├── api.js               # API client functions
│   │   ├── competition.js       # Competition logic utilities
│   │   └── tournament.js        # Tournament utilities
│   ├── views/                   # View components (empty)
│   ├── App.jsx                  # Main application component
│   ├── App.css                  # Application styles
│   ├── index.css                # Global styles
│   ├── main.jsx                 # Application entry point
│   └── QualifiersView.jsx       # Qualifiers display view
├── .env                         # Environment variables
├── .gitignore                   # Git ignore rules
├── eslint.config.js             # ESLint configuration
├── index.html                   # HTML entry point
├── package.json                 # Project dependencies
├── package-lock.json            # Dependency lock file
├── postcss.config.js            # PostCSS configuration
├── railway.json                 # Railway deployment config
├── README.md                    # Project documentation
├── server.js                    # Express backend server
├── tailwind.config.js           # Tailwind CSS configuration
├── tournaments.json             # Tournament data storage
├── vercel.json                  # Vercel deployment config
└── vite.config.js               # Vite build configuration
```

## Core Components

### Application Entry
- **main.jsx**: React application bootstrap with StrictMode
- **App.jsx**: Main application component with routing and state management
- **index.html**: HTML template with root div

### Component Architecture

#### Main Views (in App.jsx)
- **TournamentView**: Real-time tournament progress display
- **CheckInView**: Participant check-in interface with QR scanning
- **AdminView**: Administrative interface with multiple sub-views
- **AdminLoginView**: Password-protected admin access
- **RankingView**: Final rankings and competition results
- **RecordingView**: Score entry interface for staff
- **SettingsView**: Tournament configuration
- **AwardsView**: Awards ceremony display
- **ProgramView**: Printable tournament program

#### Standalone Components
- **QRCodeScanner**: Camera-based QR code reader
- **QualifiersView**: Qualification results display

### State Management
- **useReducer**: Tournament state management with actions:
  - UPDATE_TOURNAMENT_INFO
  - SET_LOADING
  - SET_ERROR
  - SET_TOURNAMENTS
  - SET_ARCHERS
  - SAVE_TOURNAMENT_TEMPLATE
  - DELETE_TOURNAMENT_TEMPLATE
  - RESET_ALL

### Backend Server (server.js)
- **Express.js** REST API server
- **MongoDB** database integration
- **CORS** enabled for cross-origin requests
- **Static file serving** for production build

## Architectural Patterns

### Client-Side Architecture
- **Component-based**: React functional components with hooks
- **State management**: useReducer for complex state, useState for local state
- **Real-time sync**: Polling-based updates (3-second intervals)
- **Optimistic UI**: Immediate local updates with background API sync
- **Responsive design**: Mobile-first with Tailwind CSS

### Backend Architecture
- **RESTful API**: Standard HTTP methods (GET, POST, PATCH, DELETE)
- **Database caching**: Connection pooling with cached client
- **Error handling**: Try-catch with appropriate HTTP status codes
- **Data validation**: Request body validation before processing

### Data Flow
1. **User Action** → Component event handler
2. **Optimistic Update** → Local state update
3. **API Call** → Background request to server
4. **Database Operation** → MongoDB update/query
5. **Response Handling** → Sync local state with server response
6. **Auto-refresh** → Periodic polling for multi-device sync

### Key Design Decisions
- **Monolithic App.jsx**: All views in single file for simplicity
- **Inline components**: RecordingView, CheckInView, etc. defined within App.jsx
- **Local storage**: Persistent session data (tournament selection, verification)
- **QR code format**: JSON-encoded participant data
- **Stand-based scoring**: 6 stands with configurable arrow counts
- **Division system**: Rank-based grouping with automatic assignment

## Database Schema

### Collections
- **tournaments**: Tournament configurations and metadata
- **applicants**: Participant registrations and scores
- **shichuma_results**: Shoot-off competition results
- **enkin_results**: Distance competition results

### Key Relationships
- Tournament (1) → Applicants (N)
- Tournament (1) → Shichuma Results (1)
- Tournament (1) → Enkin Results (1)
- Applicant → Results (embedded array per stand)
