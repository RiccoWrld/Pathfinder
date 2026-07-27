# Pathfinder

Pathfinder is a full-stack academic advising platform that helps students and advisors turn DegreeWorks audit data into clear, actionable academic guidance. Students can upload an audit PDF, ask an AI advisor questions about their progress, view the DegreeWorks Requirements percentage in a progress bar, and receive alerts about academic standing or missing requirements. Advisors can review their assigned students, prioritize alerts, acknowledge or resolve cases, and maintain follow-up notes.

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Installation](#installation)
- [Running the Project](#running-the-project)
- [Running with Docker](#running-with-docker)
- [Operating System Instructions](#operating-system-instructions)
- [Available Scripts](#available-scripts)
- [API Overview](#api-overview)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Database Migrations](#database-migrations)
- [Troubleshooting](#troubleshooting)
- [Security Notes](#security-notes)
- [License](#license)

## Project Overview

Pathfinder is designed for academic advising workflows where students need help interpreting their degree audit and advisors need a faster way to identify students who need attention. The application combines a React frontend, an Express API, PostgreSQL persistence, PDF parsing, and Google Gemini-powered advising responses.

Core goals:

- Help students understand academic standing, DegreeWorks Requirements progress, in-progress courses, and missing requirements.
- Generate alerts from DegreeWorks audits so students and advisors can act quickly.
- Give advisors a dashboard for active cases, student progress, and advising notes.
- Keep audit-derived responses grounded in uploaded audit text instead of guessed degree rules.

## Features

### Authentication and Account Setup

- Student and advisor signup with email/password validation.
- Login with university email and password.
- Password hashing with `bcryptjs`, minimum 6-character policy.
- JWT-based session token generation (24h expiry).
- University selection during account creation.
- Role-aware dashboards for students and advisors.
- Rate limiting: 20 auth requests per 15 minutes.

### Student Dashboard

- Personalized student landing page.
- DegreeWorks Requirements percentage progress display.
- DegreeWorks PDF upload.
- AI advisor chat for audit-specific questions.
- Student alert center for active academic notifications.
- Alert acknowledgement workflow.
- Profile updates from parsed audit data, including GPA, academic standing, completion rate, university name, and advisor assignment.

### AI Advisor

- PDF upload support through `multer`.
- DegreeWorks text extraction with `pdf-parse-fork`.
- Audit summary extraction for GPA, academic standing, DegreeWorks Requirements percentage, university name, advisor name/email, in-progress and missing requirements.
- Google Gemini integration (`gemini-2.5-flash`) for academic advising responses.
- Prompt rules that keep audit-specific answers grounded in the uploaded audit.
- Chat history support for follow-up questions (max 12 messages).
- Rate limited to 30 requests per 15 minutes.

### Alert System

- Database-backed academic alerts with category, priority, title, message, recommended action, source, status, acknowledgement, and resolution timestamps.
- Student alert feed and advisor alert feed.
- Alert acknowledgement and resolution endpoints.
- Audit-based alert generation for academic standing/GPA concerns, degree progress review, and missing course requirements.
- Duplicate prevention for previously acknowledged or resolved audit alerts.

### Advisor Dashboard

- Advisor workspace with searchable/filterable student roster.
- Prioritized active alerts with high-priority counts.
- Student detail view with GPA, status, completion rate, and last audit upload.
- Alert acknowledgement and resolution actions.
- Advisor notes for each assigned student (add/delete).
- Role-based access control (advisor-only routes).

### University Support

- University list endpoint for signup.
- University-aware student and advisor profiles.
- Advisor matching from audit data where available.
- University domain and branding fields supported by the backend.

### UI and Navigation

- React Router for client-side navigation (`/login`, `/signup`, `/advisor`, `/student`).
- Modern login and signup experience with shared brand panel.
- Responsive student and advisor dashboards.
- Alert cards with priority and status styling.
- DegreeWorks Requirements progress-bar visualization.

## Tech Stack

### Frontend

- React 19
- Vite
- React Router v7
- Component-scoped CSS files
- Browser `fetch` API
- Local storage for session persistence

### Backend

- Node.js
- Express 5
- PostgreSQL
- `pg` connection pool
- `dotenv` / `cors`
- `bcryptjs` / `jsonwebtoken`
- `multer` / `pdf-parse-fork`
- `@google/generative-ai`
- `express-rate-limit`
- `postgrator` (migrations)
- `jest` (testing)

### Database

- PostgreSQL
- SQL schema/bootstrap script in `setup.sql`
- Programmatic migrations in `server/migrations/`

## Project Structure

```text
Pathfinder/
|-- client/
|   |-- public/
|   |   `-- PathfinderLogo.png
|   |-- src/
|   |   |-- components/
|   |   |   |-- AdvisorDashboard.jsx
|   |   |   |-- AdvisorDashboard.css
|   |   |   |-- AIChat.jsx
|   |   |   |-- AIChat.css
|   |   |   |-- Login.jsx
|   |   |   |-- Login.css
|   |   |   |-- NotificationArea.jsx
|   |   |   |-- NotificationArea.css
|   |   |   |-- SignUp.jsx
|   |   |   |-- SignUp.css
|   |   |   |-- StudentDashboard.jsx
|   |   |   `-- StudentDashboard.css
|   |   |-- api.js
|   |   |-- App.css
|   |   |-- App.jsx
|   |   |-- index.css
|   |   `-- main.jsx
|   |-- package.json
|   `-- vite.config.js
|-- server/
|   |-- __tests__/
|   |   |-- auth.test.js
|   |   |-- auditParser.test.js
|   |   `-- chatHistory.test.js
|   |-- middleware/
|   |   |-- auth.js
|   |   `-- rateLimiter.js
|   |-- migrations/
|   |   `-- 001.initial-schema.sql
|   |-- routes/
|   |   |-- advisors.js
|   |   |-- aiAdvisor.js
|   |   |-- alerts.js
|   |   |-- auth.js
|   |   |-- notes.js
|   |   `-- universities.js
|   |-- services/
|   |   |-- advisorMatcher.js
|   |   |-- alertSync.js
|   |   |-- auditParser.js
|   |   `-- schemaGuards.js
|   |-- utils/
|   |   `-- chatHistory.js
|   |-- db.js
|   |-- index.js
|   |-- migrate.js
|   `-- package.json
|-- .env.example
|-- docker-compose.yml
|-- setup.sql
|-- ROADMAP.md
`-- README.md
```

## Prerequisites

Install these before running Pathfinder locally:

- Node.js 20 or newer recommended.
- npm, included with Node.js.
- PostgreSQL 14 or newer.
- A Google Gemini API key.
- Git.

Check your versions:

```bash
node --version
npm --version
psql --version
git --version
```

## Environment Variables

Create a `.env` file inside the `server` directory:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/pathfinder
JWT_SECRET=replace_with_a_long_random_secret
GEMINI_API_KEY=replace_with_your_gemini_api_key
```

For the client (optional, defaults to `http://localhost:5000/api`), create `client/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

### Connection String Format

```text
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME
```

Local examples:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/pathfinder
DATABASE_URL=postgresql://localhost:5432/pathfinder
```

The backend automatically uses non-SSL for `localhost` and SSL for hosted database URLs.

### Environment Variable Reference

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Backend port. Defaults to `5000`. |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `JWT_SECRET` | Recommended | Secret used to sign JWT tokens. The app has a fallback, but production should always set this. |
| `GEMINI_API_KEY` | Yes for AI chat | Google Gemini API key used by the AI advisor route. |
| `VITE_API_URL` | No (client) | Backend URL for the frontend. Defaults to `http://localhost:5000/api`. |

Generate a strong `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Database Setup

### Option A: Bootstrap Script (Quick Start)

```bash
createdb pathfinder
psql -d pathfinder -f setup.sql
```

### Option B: Programmatic Migrations (Recommended)

```bash
createdb pathfinder
cd server
npm run migrate
```

Migrations track which scripts have been applied in a `migrations` table, making it safer for ongoing schema changes.

The `setup.sql` script includes demo data for testing:

```text
Advisor: sarah.path@university.edu / password123
Student: alice.johnson@university.edu / password123
Student: jordan.smith@university.edu / password123
```

For a clean instance, remove the `INSERT INTO` statements from `setup.sql` before running it, or truncate those tables after setup.

## Installation

```bash
git clone <repository-url>
cd Pathfinder

cd server
npm install

cd ../client
npm install
```

## Running the Project

Pathfinder runs as two separate processes:

- Backend API: `http://localhost:5000`
- Frontend app: `http://localhost:5173`

Start the backend:

```bash
cd server
npm run dev
```

Start the frontend in a second terminal:

```bash
cd client
npm run dev
```

Open the app at `http://localhost:5173`.

First-run checklist:

1. Confirm PostgreSQL is running.
2. Confirm `server/.env` exists with `DATABASE_URL`.
3. Create the database and run migrations (`npm run migrate` from `server/`).
4. Start the backend.
5. Start the frontend.
6. Create an advisor account, then a student account at the same university.
7. Upload a DegreeWorks PDF from the student dashboard.
8. Confirm alerts and progress appear on both dashboards.

## Running with Docker

Pathfinder can run as a Docker Compose stack, which starts the database, backend API, and frontend app together.

From the project root, create `.env`:

```bash
cp .env.example .env
```

Update `.env` with your secrets:

```env
JWT_SECRET=replace_with_a_long_random_secret
GEMINI_API_KEY=replace_with_your_gemini_api_key
```

Start the full stack:

```bash
docker compose up --build
```

Open the app at `http://localhost:5173`.

The database container automatically runs `setup.sql` on first start. To reset:

```bash
docker compose down -v
docker compose up --build
```

## Operating System Instructions

### Windows PowerShell

```powershell
cd server
npm install
New-Item -ItemType File -Path .env
notepad .env
# Add PORT, DATABASE_URL, JWT_SECRET, GEMINI_API_KEY

cd ../client
npm install

# Start backend
cd ../server
npm run dev

# Start frontend (new terminal)
cd Pathfinder\client
npm run dev
```

### macOS

```bash
brew install node postgresql git
brew services start postgresql

cd server
npm install
cat > .env <<'EOF'
PORT=5000
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/pathfinder
JWT_SECRET=replace_with_a_long_random_secret
GEMINI_API_KEY=replace_with_your_gemini_api_key
EOF

cd ../client
npm install

# Start backend
cd ../server
npm run dev

# Start frontend (new terminal)
cd ../client
npm run dev
```

### Linux (Debian/Ubuntu)

```bash
sudo apt update
sudo apt install -y nodejs npm postgresql postgresql-contrib git
sudo systemctl enable --now postgresql

sudo -u postgres createdb pathfinder

cd server
npm install
cat > .env <<'EOF'
PORT=5000
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/pathfinder
JWT_SECRET=replace_with_a_long_random_secret
GEMINI_API_KEY=replace_with_your_gemini_api_key
EOF
npm run migrate

cd ../client
npm install
```

## Available Scripts

### Backend Scripts (from `server/`)

| Script | Description |
| --- | --- |
| `npm start` | Starts the Express server with Node. |
| `npm run dev` | Starts the Express server with Nodemon for development. |
| `npm test` | Runs Jest test suite (21 tests). |
| `npm run test:watch` | Runs tests in watch mode. |
| `npm run migrate` | Applies pending database migrations with postgrator. |
| `npm run migrate:create <name>` | Creates a new migration SQL file. |

### Frontend Scripts (from `client/`)

| Script | Description |
| --- | --- |
| `npm run dev` | Starts the Vite development server. |
| `npm run build` | Builds the React app for production. |
| `npm run preview` | Serves the production build locally. |
| `npm run lint` | Runs ESLint against the frontend source. |

## API Overview

All backend routes are mounted under `/api`. Rate limits apply per route group.

### Authentication (rate limit: 20/15min)

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | Creates a student or advisor account. Requires valid email format, password 6+ characters. |
| `POST` | `/api/auth/login` | Logs in a user and returns a JWT plus profile data. |

### Universities (rate limit: 200/15min)

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/universities` | Returns available universities for signup. |

### AI Advisor (rate limit: 30/15min, authenticated)

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/ai/advisor` | Accepts chat input and optional DegreeWorks PDF upload, extracts audit context, syncs alerts, and returns an AI advisor response. |

### Alerts (rate limit: 200/15min, authenticated)

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/system/check-alerts` | Generates system alerts for students below GPA threshold. |
| `GET` | `/api/students/:studentId/alerts` | Returns active alerts for a student. |
| `POST` | `/api/alerts` | Creates a manual alert. |
| `PATCH` | `/api/alerts/:alertId/acknowledge` | Marks an active alert as acknowledged. |
| `PATCH` | `/api/alerts/:alertId/resolve` | Resolves an alert. |

### Advisors (rate limit: 200/15min, authenticated, advisor role required)

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/advisors/:advisorId/alerts` | Returns active alerts for an advisor's students. |
| `GET` | `/api/advisors/:advisorId/students` | Returns assigned students and alert counts. |

### Advisor Notes (rate limit: 200/15min, authenticated)

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/students/:studentId/notes` | Returns advisor notes for a student. |
| `POST` | `/api/students/:studentId/notes` | Adds a note for an assigned student (max 2000 chars). |
| `DELETE` | `/api/notes/:noteId` | Deletes an advisor note. |

## Development Workflow

1. Start PostgreSQL.
2. Start the backend in `server`.
3. Start the frontend in `client`.
4. Sign up as an advisor for a university.
5. Sign up as a student for the same university.
6. Log in as the student and upload a DegreeWorks PDF.
7. Review generated alerts on the student dashboard.
8. Log in as the advisor and review the advisor dashboard.

Before submitting changes:

```bash
cd client && npm run build && npm run lint
cd ../server && npm test
```

## Testing

The server includes a Jest test suite with 21 tests across 3 files:

```bash
cd server
npm test
```

Test coverage includes:

- **Auth middleware**: Missing/invalid tokens, role-based authorization.
- **Chat history parsing**: Empty history, role filtering, deduplication, message limits.
- **Audit parser**: Text normalization, university/GPA/standing extraction.

## Database Migrations

Migrations use `postgrator` and live in `server/migrations/` as sequential SQL files.

```bash
# Apply all pending migrations
cd server
npm run migrate

# Create a new migration
npm run migrate:create 002.add-some-column
```

The migration runner tracks applied files in a `migrations` table. Migrations are idempotent (use `IF NOT EXISTS` / `IF EXISTS` where appropriate).

## Troubleshooting

### Frontend cannot connect to backend

Confirm the backend is running on port `5000`. The frontend reads `VITE_API_URL` from `client/.env` or defaults to `http://localhost:5000/api`.

### Database connection errors

Check `server/.env` and confirm `DATABASE_URL`:

```bash
psql "$DATABASE_URL"
```

### Signup fails because universities do not load

Confirm the `universities` table exists and has at least one row:

```sql
SELECT id, name FROM universities ORDER BY name;
```

### AI advisor returns an error

Check `GEMINI_API_KEY` is set in `server/.env`, then restart the backend. Verify the uploaded file is a PDF.

### Port already in use

```bash
PORT=5001 npm run dev        # Backend
npm run dev -- --port 5174   # Frontend
```

## Security Notes

- Do not commit `.env` files.
- Use a strong `JWT_SECRET` in production.
- Keep `GEMINI_API_KEY` private.
- Use HTTPS and secure cookies/session handling for production deployments.
- Restrict CORS origins before deploying publicly.
- Rate limiting is configured for auth (20/15min), AI (30/15min), and general API (200/15min).
- Role-based authorization restricts advisor routes to users with `role: "advisor"` in their JWT.
- Store production databases with SSL enabled and regular backups.
- Review FERPA or institutional privacy requirements before storing real academic data.

## License

This project currently uses the license defined in the package metadata. Update this section with the final license selected by the project team.
