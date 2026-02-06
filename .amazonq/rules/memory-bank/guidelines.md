# Development Guidelines

## Code Quality Standards

### JavaScript/JSX Conventions
- **ES6+ syntax**: Use modern JavaScript features (arrow functions, destructuring, spread operators)
- **Module system**: ES modules with `import/export` statements
- **Strict mode**: React.StrictMode enabled in main.jsx
- **File extensions**: `.jsx` for React components, `.js` for utilities
- **Naming conventions**:
  - Components: PascalCase (e.g., `TournamentView`, `QRCodeScanner`)
  - Functions/variables: camelCase (e.g., `handleCheckIn`, `selectedTournamentId`)
  - Constants: UPPER_SNAKE_CASE for action types (e.g., `UPDATE_TOURNAMENT_INFO`)

### ESLint Configuration
- **Base config**: `@eslint/js` recommended rules
- **React-specific**: 
  - `eslint-plugin-react-hooks` for hooks rules
  - `eslint-plugin-react-refresh` for Vite HMR
- **Custom rules**:
  - `no-unused-vars`: Error with exception for uppercase variables (constants)
- **ECMAScript version**: 2020 with latest parser options
- **Ignored paths**: `dist/` directory

### Code Formatting
- **Indentation**: 2 spaces (inferred from existing code)
- **Quotes**: Single quotes for strings
- **Semicolons**: Not consistently used (optional)
- **Line breaks**: CRLF (Windows style)

## React Development Patterns

### Component Structure
```jsx
// Functional components with hooks
function ComponentName({ prop1, prop2 }) {
  const [state, setState] = useState(initialValue);
  
  useEffect(() => {
    // Side effects
  }, [dependencies]);
  
  const handleEvent = () => {
    // Event handler
  };
  
  return (
    <div className="tailwind-classes">
      {/* JSX content */}
    </div>
  );
}
```

### State Management Patterns
1. **useState**: For simple local state
2. **useReducer**: For complex state with multiple actions
3. **localStorage**: For persistent session data
4. **Reducer pattern**:
```javascript
function reducer(state, action) {
  switch (action.type) {
    case 'ACTION_TYPE':
      return { ...state, field: action.payload };
    default:
      return state;
  }
}
```

### Common Hooks Usage
- **useEffect**: Side effects, data fetching, subscriptions
- **useCallback**: Memoize callbacks (used sparingly)
- **useMemo**: Memoize expensive computations
- **useRef**: DOM references, mutable values

### Event Handling
- Inline arrow functions for simple handlers
- Named functions for complex logic
- Optimistic UI updates before API calls

## Styling Conventions

### Tailwind CSS Usage
- **Utility-first**: Prefer Tailwind utilities over custom CSS
- **Responsive design**: Mobile-first approach
- **Common patterns**:
  - Flexbox: `flex items-center justify-between`
  - Grid: `grid grid-cols-2 gap-4`
  - Spacing: `px-4 py-2 mb-4`
  - Colors: `bg-blue-500 text-white`
  - Borders: `border border-gray-200 rounded`

### Custom CSS Classes
- Defined in `index.css` and `App.css`
- Used for complex components not easily expressed with utilities
- Semantic class names (e.g., `.card`, `.btn-primary`)

## API Integration Patterns

### API Client Structure
```javascript
// Centralized API functions in utils/api.js
export const resourceApi = {
  getAll: () => fetch(`${API_URL}/resource`).then(r => r.json()),
  create: (data) => fetch(`${API_URL}/resource`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json())
};
```

### Error Handling
- Try-catch blocks for async operations
- User-friendly error messages
- Console logging for debugging
- Fallback UI for error states

### Real-time Synchronization
- Polling with `setInterval` (3-second intervals)
- Background updates with `isSyncing` flag
- Cleanup with `clearInterval` in useEffect return

## Backend Development Patterns

### Express Route Structure
```javascript
app.method('/api/endpoint', async (req, res) => {
  try {
    const db = await connectToDatabase();
    // Validation
    if (!requiredField) {
      return res.status(400).json({ success: false, message: 'Error' });
    }
    // Database operation
    const result = await db.collection('name').operation();
    // Response
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
```

### Database Patterns
- **Connection caching**: Reuse MongoDB client
- **Collection naming**: Lowercase with underscores
- **Update operations**: `updateOne` with `upsert: true`
- **Query patterns**: Find with filters, sort, limit

### Response Format
```javascript
// Success
{ success: true, data: result, message: 'Optional message' }

// Error
{ success: false, message: 'Error description' }
```

## Build & Deployment

### Vite Configuration
- **Dev server**: Port 5174
- **API proxy**: `/api` → `http://localhost:3001`
- **Build output**: `dist/` directory
- **Code splitting**: Manual chunks for react and vendor libraries
- **Source maps**: Enabled for debugging

### Environment Variables
- Stored in `.env` file
- Accessed via `process.env.VARIABLE_NAME`
- Required: `MONGODB_URI`
- Optional: `PORT` (defaults to 3001)

### Deployment Scripts
```json
{
  "dev": "concurrently \"npm run server\" \"vite\"",
  "build": "vite build",
  "start": "set NODE_ENV=production && node server.js"
}
```

## Testing & Debugging

### Console Logging
- Emoji prefixes for visibility (🎯, ✅, ❌, ⚠️)
- Structured logs with context
- Debug mode for detailed output

### Development Workflow
1. Start dev server: `npm run dev`
2. Make changes with HMR
3. Test in browser
4. Build for production: `npm run build`
5. Test production build: `npm start`

## Best Practices

### Performance
- Minimize re-renders with proper dependency arrays
- Use code splitting for large bundles
- Optimize images and assets
- Implement pagination for large lists

### Security
- Validate all user inputs
- Sanitize data before database operations
- Use environment variables for secrets
- Implement CORS properly

### Accessibility
- Semantic HTML elements
- ARIA labels where needed
- Keyboard navigation support
- Screen reader compatibility

### Code Organization
- Group related functionality
- Extract reusable logic to utilities
- Keep components focused and small
- Use meaningful variable names

### Japanese Language Support
- UTF-8 encoding for all files
- Japanese text in UI strings
- Proper handling of Japanese characters in database
- Console messages in Japanese for user-facing logs
