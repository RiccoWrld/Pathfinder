# Pathfinder — Roadmap Implementation Changes

All commits pushed to `main` on `git@github.com:RiccoWrld/Pathfinder.git`.

---

## P1: Auth Middleware Enhancement

### What was added
Role-based authorization using the existing `authorize()` middleware factory on advisor-specific routes.

### Files changed
- **`server/index.js`** — Imported `authorize` (line 5), added `authorize("advisor")` to the advisor route middleware chain (line 24)
- **`server/routes/advisors.js`** — No runtime change (removed unused `authorize` import later in P3 cleanup)

### How
The `authenticate` middleware was already applied to protected routes. Added `authorize("advisor")` as an additional middleware in the chain so that only JWT tokens with `role: "advisor"` can access `/api/advisors/*` endpoints.

---

## P1: Move Hardcoded API URLs to Env/Config

### What was verified
No changes needed — this was already implemented.

### Existing setup
- **`client/src/api.js:1`** — Uses `import.meta.env.VITE_API_URL` with fallback to `http://localhost:5000/api`
- **`client/.env.example`** — Contains `VITE_API_URL=http://localhost:5000/api`
- **`server/db.js`** — Uses `DATABASE_URL` from environment for PostgreSQL connection
- **`server/index.js:28`** — Uses `process.env.PORT` with fallback to 5000
- **`server/middleware/auth.js:11`** — Uses `process.env.JWT_SECRET` with fallback

---

## P2: Tests (Unit + Integration)

### What was added
Jest testing framework with 21 tests across 3 test suites.

### Files added/changed
- **`server/package.json`** — Added `jest` as devDependency, updated `test` script to `jest --forceExit --detectOpenHandles`, added `test:watch` script
- **`server/__tests__/auth.test.js`** — 7 tests covering:
  - `authenticate`: missing header, non-Bearer token, invalid token → 401
  - `authorize`: wrong role → 403, correct role → calls next, missing req.user → 403
- **`server/__tests__/chatHistory.test.js`** — 6 tests covering:
  - null/empty history, role filtering, message deduplication, length limit (12 max), empty content filtering
- **`server/__tests__/auditParser.test.js`** — 8 tests covering:
  - `normalizeAuditText`: line endings, whitespace trim, 90k char cap
  - `extractAuditSummary`: empty/null input, university extraction, good standing detection, probation detection, progress defaults

### How
1. Installed `jest` with `npm install --save-dev jest`
2. Created `server/__tests__/` directory
3. Wrote test files using `describe`/`it`/`expect` patterns
4. Tests validate function behavior without database or network dependencies (pure unit tests)

---

## P2: DB Migration Tooling

### What was added
`postgrator`-based SQL migration system with initial schema migration.

### Files added/changed
- **`server/migrations/001.initial-schema.sql`** — Creates all 6 tables (`universities`, `users`, `advisors`, `students`, `alerts`, `advisor_notes`) with constraints, defaults, and indexes (all `IF NOT EXISTS` for idempotency)
- **`server/migrate.js`** — Migration runner that:
  - Reads `DATABASE_URL` from env (with fallback)
  - Uses `postgrator` to apply pending migrations from `migrations/` directory
  - Tracks applied migrations in a `migrations` table
- **`server/package.json`** — Added `migrate` and `migrate:create` scripts

### How
1. Installed `postgrator` with `npm install postgrator`
2. Created `server/migrations/` directory with initial SQL migration
3. Created `server/migrate.js` runner script
4. Extracted schema from `setup.sql` into the migration file
5. Run with: `npm run migrate` (from `server/` directory)

---

## P2: Request Validation & Rate Limiting

### What was added
Tiered rate limiting and input validation on auth endpoints.

### Files added/changed
- **`server/middleware/rateLimiter.js`** — Three rate limiters:
  - `authLimiter`: 20 requests per 15 min window (login/signup)
  - `apiLimiter`: 200 requests per 15 min window (general API)
  - `aiLimiter`: 30 requests per 15 min window (AI advisor endpoint)
- **`server/index.js`** — Applied rate limiters to each route group (lines 21-26)
- **`server/routes/auth.js`** — Added:
  - Email regex validation (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
  - Password minimum length check (6 chars)
  - Login presence validation for email/password

### How
1. Installed `express-rate-limit` with `npm install express-rate-limit`
2. Created `server/middleware/rateLimiter.js` with three pre-configured rate limiters
3. Applied them in `index.js` before route handlers
4. Added validation with early returns in `routes/auth.js`

---

## P3: React Router for Navigation

### What was added
React Router v7 for client-side navigation, replacing state-based view switching.

### Files changed
- **`client/package.json`** — Added `react-router-dom` dependency
- **`client/src/main.jsx`** — Wrapped `<App />` in `<BrowserRouter>`
- **`client/src/App.jsx`** — Full refactor:
  - Replaced `view` state with `<Routes>`/`<Route>` components
  - Routes: `/login`, `/signup`, `/advisor`, `/student`, `/*` → redirect
  - Extracted auth brand panel into `AuthPage` layout component
  - Replaced toggle button with `<Link>` component
  - Used `useNavigate()` for programmatic navigation after login/logout
  - Logged-in users see only dashboard routes with catch-all redirect

### How
1. Installed `react-router-dom` with `npm install react-router-dom`
2. Wrapped app in `<BrowserRouter>` in `main.jsx`
3. Refactored `App.jsx` to use declarative routing instead of `useState` for `view`

---

## P3: Clean Up Unused Deps & Dead Code

### What was removed
Two unused npm packages and one unused import.

### Files changed
- **`server/package.json`** — Removed `pdf-lib` and `pdf-parse` from dependencies
- **`server/routes/advisors.js`** — Removed unused `const { authorize } = require(...)` import

### How
1. Ran `npm uninstall pdf-lib pdf-parse` to remove packages and update lockfile
2. Manually removed the dead import from `advisors.js` that was left over from the P1 auth change

---

## P3: TypeScript Migration Consideration

### What was decided
TypeScript migration is feasible and recommended to start with the client.

### Supporting facts
- `@types/react` and `@types/react-dom` are already installed in `client/package.json`
- Vite natively supports `.ts` and `.tsx` files with zero config
- No breaking changes needed for the server (can stay JS or migrate independently)
- The project is small enough (~24 source files) for a gradual migration

### Recommended approach
1. Rename files to `.tsx` one component at a time
2. Add type annotations incrementally
3. Use `any` as an escape hatch during transition
4. Server migration is lower priority and can remain in JS

---

## Verification

All changes have been verified:
- **Server tests**: `npm test` — 21 tests passing, 3 suites
- **Client build**: `npm run build` — builds successfully (38 modules)
- **Git**: All commits pushed to `main`
