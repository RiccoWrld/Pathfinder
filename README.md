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
- [Troubleshooting](#troubleshooting)
- [Security Notes](#security-notes)

## Project Overview

Pathfinder is designed for academic advising workflows where students need help interpreting their degree audit and advisors need a faster way to identify students who need attention. The application combines a React frontend, an Express API, PostgreSQL persistence, PDF parsing, and Google Gemini-powered advising responses.

Core goals:

- Help students understand academic standing, DegreeWorks Requirements progress, in-progress courses, and missing requirements.
- Generate alerts from DegreeWorks audits so students and advisors can act quickly.
- Give advisors a dashboard for active cases, student progress, and advising notes.
- Keep audit-derived responses grounded in uploaded audit text instead of guessed degree rules.

## Features

### Authentication and Account Setup

- Student and advisor signup.
- Login with university email and password.
- Password hashing with `bcryptjs`.
- JWT-based session token generation.
- University selection during account creation.
- Role-aware dashboards for students and advisors.

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
- Audit summary extraction for:
  - Overall or cumulative GPA.
  - Academic standing.
  - DegreeWorks Requirements percentage, such as the `98% Requirements` value shown in the DegreeWorks Degree Progress area.
  - University name.
  - Advisor name and email.
  - In-progress requirements.
  - Unmet or missing requirements.
- Google Gemini integration for academic advising responses.
- Prompt rules that keep audit-specific answers grounded in the uploaded audit.
- Chat history support for follow-up questions.

### Alert System

- Database-backed academic alerts.
- Alerts include category, priority, title, message, recommended action, source, status, acknowledgement timestamp, and resolution timestamp.
- Student alert feed.
- Advisor alert feed.
- Alert acknowledgement and resolution endpoints.
- Audit-based alert generation for:
  - Academic standing or GPA concerns.
  - Degree progress review.
  - Missing course requirements.
  - In-progress or unmet requirements.
- Duplicate prevention for previously acknowledged or resolved audit alerts.

### Advisor Dashboard

- Advisor workspace with assigned student roster.
- Prioritized active alerts.
- High-priority alert counts.
- Student detail view.
- GPA, status, completion rate, and last audit upload display.
- Alert acknowledgement and resolution actions.
- Advisor notes for each assigned student.
- Add and delete advisor notes.

### University Support

- University list endpoint for signup.
- University-aware student and advisor profiles.
- Advisor matching from audit data where available.
- University domain and branding fields supported by the backend.

### UI and UX

- Modern login and signup experience.
- Responsive student dashboard.
- Advisor dashboard optimized for scanning and triage.
- Alert cards with priority and status styling.
- DegreeWorks Requirements progress-bar visualization.

## Tech Stack

### Frontend

- React 19
- Vite
- Component-scoped CSS files
- Browser `fetch` API
- Local storage for session persistence

### Backend

- Node.js
- Express 5
- PostgreSQL
- `pg` connection pool
- `dotenv`
- `cors`
- `bcryptjs`
- `jsonwebtoken`
- `multer`
- `pdf-parse-fork`
- `@google/generative-ai`

### Database

- PostgreSQL
- SQL schema/bootstrap script in `setup.sql`

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
|   |   |-- App.css
|   |   |-- App.jsx
|   |   |-- index.css
|   |   `-- main.jsx
|   |-- package.json
|   `-- vite.config.js
|-- server/
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
|   `-- package.json
|-- setup.sql
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

Create a `.env` file inside the `server` directory. This file is intentionally not committed to the repository because it contains private secrets and machine-specific database credentials.

```env
PORT=5000
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/pathfinder
JWT_SECRET=replace_with_a_long_random_secret
GEMINI_API_KEY=replace_with_your_gemini_api_key
```

### How to Create `DATABASE_URL`

Each developer needs their own PostgreSQL connection string. Do not share your personal database password or commit a real `DATABASE_URL` to GitHub.

Connection string format:

```text
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME
```

Local PostgreSQL example:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/pathfinder
```

If your PostgreSQL username is `postgres`, your password is `admin123`, and your database is named `pathfinder`, then use:

```env
DATABASE_URL=postgresql://postgres:admin123@localhost:5432/pathfinder
```

If PostgreSQL was installed without a password for your local user, the connection string may look more like:

```env
DATABASE_URL=postgresql://localhost:5432/pathfinder
```

For a hosted PostgreSQL database such as Render, Supabase, Neon, Railway, or another cloud provider, copy the provider's PostgreSQL connection URL and paste it as `DATABASE_URL`. Hosted URLs usually include a remote host name and often require SSL. The backend automatically uses non-SSL for `localhost` and SSL for hosted database URLs.

Variable details:

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Backend port. Defaults to `5000`. |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by the backend. Each computer or cloud environment needs its own value. |
| `JWT_SECRET` | Recommended | Secret used to sign JWT tokens. The app has a fallback, but production should always set this. |
| `GEMINI_API_KEY` | Yes for AI chat | Google Gemini API key used by the AI advisor route. |

Generate a stronger `JWT_SECRET` with one of these commands:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Windows PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Database Setup

Start PostgreSQL, then create a local database named `pathfinder`:

```bash
createdb pathfinder
```

Run the schema/bootstrap script:

```bash
psql -d pathfinder -f setup.sql
```

If your database requires a username:

```bash
psql -U postgres -d pathfinder -f setup.sql
```

If your database uses a password, PostgreSQL will prompt for it. You can also connect with the full connection string:

```bash
psql "postgresql://postgres:your_password@localhost:5432/pathfinder" -f setup.sql
```

Windows PowerShell:

```powershell
psql "postgresql://postgres:your_password@localhost:5432/pathfinder" -f setup.sql
```

If you are using a hosted database, run the same setup script against the hosted URL:

```bash
psql "$DATABASE_URL" -f setup.sql
```

Windows PowerShell:

```powershell
psql $env:DATABASE_URL -f setup.sql
```

The backend expects tables for:

- `users`
- `universities`
- `advisors`
- `students`
- `alerts`
- `advisor_notes`

It also expects student/advisor university fields and audit progress fields used by the dashboard and alert sync. If your local database was created before those fields existed, update the schema before running the newest backend.

Important student progress columns:

- `completion_rate`: stores the DegreeWorks Requirements percentage displayed in the student dashboard progress bar.
- `requirement_completed_count`
- `requirement_in_progress_count`
- `requirement_missing_count`
- `requirement_total_count`

The backend includes a small schema guard that can automatically add the requirement count columns if an older local database is missing them. Running `setup.sql` is still the recommended way to keep the whole schema current.

### Blank Database vs Demo Data

`setup.sql` creates the schema and may include demo university, advisor, student, user, alert, and note records for testing. For a clean classroom or production-style setup, remove or skip the demo `INSERT INTO users`, `INSERT INTO advisors`, `INSERT INTO students`, `INSERT INTO alerts`, and `INSERT INTO advisor_notes` statements before running it, or clear those tables after setup:

```sql
TRUNCATE TABLE advisor_notes, alerts, students, advisors, users RESTART IDENTITY CASCADE;
```

Keep the `universities` rows unless you want users to create accounts without preloaded university options.

### Common Local PostgreSQL Credential Cases

If you know your PostgreSQL password, use it in `DATABASE_URL`.

If you do not know the `postgres` password, you can set one:

```bash
psql -U postgres
```

Then inside the PostgreSQL prompt:

```sql
ALTER USER postgres WITH PASSWORD 'your_password';
\q
```

On Linux, you may need to run the prompt as the `postgres` system user:

```bash
sudo -u postgres psql
```

If your local PostgreSQL setup uses your computer username instead of `postgres`, create the database under that user and use a URL like:

```env
DATABASE_URL=postgresql://localhost:5432/pathfinder
```

## Installation

Clone the repository:

```bash
git clone <repository-url>
cd Pathfinder
```

Install backend dependencies:

```bash
cd server
npm install
```

Install frontend dependencies:

```bash
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

If the backend starts correctly, you should see a message that the server is running on port `5000`.

Start the frontend in a second terminal:

```bash
cd client
npm run dev
```

Open the app:

```text
http://localhost:5173
```

First-run checklist:

1. Confirm PostgreSQL is running.
2. Confirm `server/.env` exists.
3. Confirm `DATABASE_URL` points to a database that exists.
4. Run `setup.sql`.
5. Start the backend.
6. Start the frontend.
7. Create an advisor account.
8. Create a student account at the same university.
9. Upload a DegreeWorks PDF from the student dashboard.
10. Confirm alerts and progress appear on both dashboards.

For production-style frontend testing:

```bash
cd client
npm run build
npm run preview
```

## Running with Docker

Pathfinder can run as a Docker Compose stack, which starts the database, backend API, and frontend app together.

Make sure Docker Desktop is installed and the Docker engine is running before using these commands.

The Docker stack exposes:

- PostgreSQL database: `localhost:5432`
- Backend API: `http://localhost:5000`
- Frontend app: `http://localhost:5173`

From the project root, create a local `.env` file from the example:

```bash
cp .env.example .env
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
```

Update `.env` with your local secrets:

```env
JWT_SECRET=replace_with_a_long_random_secret
GEMINI_API_KEY=replace_with_your_gemini_api_key
```

`JWT_SECRET` can be any long random private string. `GEMINI_API_KEY` must be a real Google Gemini API key for the AI advisor to answer audit questions.

Start the full stack from the project root:

```bash
docker compose up --build
```

Open the app at:

```text
http://localhost:5173
```

The first startup can take a little longer because Docker builds the client and server images and initializes PostgreSQL.

To stop the app, press `Ctrl+C` in the terminal running Docker Compose. You can also stop and remove the containers with:

```bash
docker compose down
```

The database container automatically runs `setup.sql` the first time the Docker volume is created. If you need to reset the Docker database and seed it again, remove the volume:

```bash
docker compose down -v
docker compose up --build
```

Useful demo credentials seeded by `setup.sql`:

```text
Advisor: sarah.path@university.edu / password123
Student: alice.johnson@university.edu / password123
Student: jordan.smith@university.edu / password123
```

If login works but the AI advisor says the Gemini key is missing or invalid, update `GEMINI_API_KEY` in `.env`, then restart the stack:

```bash
docker compose down
docker compose up --build
```

## Operating System Instructions

### Windows PowerShell

```powershell
git clone <repository-url>
cd Pathfinder

cd server
npm install
```

Create `server\.env`:

```powershell
New-Item -ItemType File -Path .env
notepad .env
```

Add your values:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/pathfinder
JWT_SECRET=replace_with_a_long_random_secret
GEMINI_API_KEY=replace_with_your_gemini_api_key
```

Create and initialize the database from the project root:

```powershell
cd ..
createdb pathfinder
psql "postgresql://postgres:your_password@localhost:5432/pathfinder" -f setup.sql
```

Start the backend:

```powershell
cd server
npm run dev
```

In another PowerShell window, start the frontend:

```powershell
cd Pathfinder\client
npm install
npm run dev
```

If `createdb` or `psql` is not recognized, add the PostgreSQL `bin` folder to your PATH. A common location is:

```text
C:\Program Files\PostgreSQL\<version>\bin
```

### macOS

Install dependencies with Homebrew if needed:

```bash
brew install node postgresql git
brew services start postgresql
```

Run the project:

```bash
git clone <repository-url>
cd Pathfinder

cd server
npm install
cat > .env <<'EOF'
PORT=5000
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/pathfinder
JWT_SECRET=replace_with_a_long_random_secret
GEMINI_API_KEY=replace_with_your_gemini_api_key
EOF
cd ..

createdb pathfinder
psql "postgresql://postgres:your_password@localhost:5432/pathfinder" -f setup.sql

cd server
npm run dev
```

In another terminal:

```bash
cd Pathfinder/client
npm install
npm run dev
```

### Linux

Install system dependencies on Debian or Ubuntu:

```bash
sudo apt update
sudo apt install -y nodejs npm postgresql postgresql-contrib git
sudo systemctl enable --now postgresql
```

Create the database:

```bash
sudo -u postgres createdb pathfinder
```

Create `server/.env`:

```bash
git clone <repository-url>
cd Pathfinder/server
npm install
cat > .env <<'EOF'
PORT=5000
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/pathfinder
JWT_SECRET=replace_with_a_long_random_secret
GEMINI_API_KEY=replace_with_your_gemini_api_key
EOF
```

Initialize the database from the project root:

```bash
cd ..
psql "postgresql://postgres:your_password@localhost:5432/pathfinder" -f setup.sql
```

Run the backend:

```bash
cd server
npm run dev
```

Run the frontend in another terminal:

```bash
cd Pathfinder/client
npm install
npm run dev
```

## Available Scripts

### Backend Scripts

Run from `server/`.

| Script | Description |
| --- | --- |
| `npm start` | Starts the Express server with Node. |
| `npm run dev` | Starts the Express server with Nodemon for development. |
| `npm test` | Placeholder test script. |

### Frontend Scripts

Run from `client/`.

| Script | Description |
| --- | --- |
| `npm run dev` | Starts the Vite development server. |
| `npm run build` | Builds the React app for production. |
| `npm run preview` | Serves the production build locally. |
| `npm run lint` | Runs ESLint against the frontend source. |

## API Overview

All backend routes are mounted under `/api`.

### Authentication

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | Creates a student or advisor account. |
| `POST` | `/api/auth/login` | Logs in a user and returns a JWT plus profile data. |

### Universities

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/universities` | Returns available universities for signup. |

### AI Advisor

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/ai/advisor` | Accepts chat input and optional DegreeWorks PDF upload, extracts audit context, syncs alerts, and returns an AI advisor response. |

The AI advisor route also parses the DegreeWorks Degree Progress section. When the audit text contains a value such as `98% Requirements`, that value is returned as `auditSummary.completion_rate`, saved on the student profile, and displayed in the student dashboard progress bar.

### Alerts

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/system/check-alerts` | Generates system alerts for students below GPA threshold. |
| `GET` | `/api/students/:studentId/alerts` | Returns active alerts for a student. |
| `POST` | `/api/alerts` | Creates a manual alert. |
| `PATCH` | `/api/alerts/:alertId/acknowledge` | Marks an active alert as acknowledged. |
| `PATCH` | `/api/alerts/:alertId/resolve` | Resolves an alert. |

### Advisors

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/advisors/:advisorId/alerts` | Returns active alerts for an advisor's students. |
| `GET` | `/api/advisors/:advisorId/students` | Returns assigned students and alert counts. |

### Advisor Notes

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/students/:studentId/notes` | Returns advisor notes for a student. |
| `POST` | `/api/students/:studentId/notes` | Adds a note for an assigned student. |
| `DELETE` | `/api/notes/:noteId` | Deletes an advisor note. |

## Development Workflow

Recommended workflow:

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
cd client
npm run build
npm run lint
```

Backend syntax check examples:

```bash
cd ..
node --check server/index.js
node --check server/routes/aiAdvisor.js
node --check server/services/alertSync.js
```

## Troubleshooting

### Frontend cannot connect to backend

Confirm the backend is running on port `5000`:

```bash
cd server
npm run dev
```

The frontend currently calls API routes at `http://localhost:5000`.

### Database connection errors

Check `server/.env` and confirm `DATABASE_URL` points to an existing PostgreSQL database.

```bash
psql "$DATABASE_URL"
```

On Windows PowerShell:

```powershell
psql $env:DATABASE_URL
```

### Signup fails because universities do not load

Confirm the `universities` table exists and has at least one row. The signup form depends on:

```sql
SELECT id, name, domain, branding_color FROM universities ORDER BY name ASC;
```

### AI advisor returns an error

Check that `GEMINI_API_KEY` is set in `server/.env`, then restart the backend. Also confirm the uploaded file is a PDF.

### Alerts reappear after refresh

Audit-generated alerts are keyed by category, title, and message. If an identical audit alert was previously acknowledged or resolved, the sync should skip recreating it. If the audit text changes and generates a different alert message, Pathfinder treats it as a new alert.

### Port already in use

Backend:

```bash
PORT=5001 npm run dev
```

Windows PowerShell:

```powershell
$env:PORT=5001
npm run dev
```

Frontend:

```bash
npm run dev -- --port 5174
```

## Security Notes

- Do not commit `.env` files.
- Use a strong `JWT_SECRET` in production.
- Keep `GEMINI_API_KEY` private.
- Use HTTPS and secure cookies/session handling for production deployments.
- Restrict CORS origins before deploying publicly.
- Store production databases with SSL enabled and regular backups.
- Review authentication and authorization rules before using Pathfinder with real student records.

## Production Considerations

Before deploying Pathfinder beyond local development:

- Move hard-coded frontend API URLs into environment variables.
- Add database migrations instead of relying only on a bootstrap SQL file.
- Add automated backend tests for auth, alerts, audit parsing, and advisor routes.
- Add frontend tests for login, signup, dashboards, and alert actions.
- Add request validation and rate limiting.
- Add structured logging and monitoring.
- Review FERPA or institutional privacy requirements before storing real academic data.

## License

This project currently uses the license defined in the package metadata. Update this section with the final license selected by the project team.
