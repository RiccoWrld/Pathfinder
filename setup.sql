-- Pathfinder database bootstrap script.
-- Run from the repo root with:
--   psql -d pathfinder -f setup.sql
--
-- This script is intentionally idempotent: it can be run more than once
-- without recreating existing tables or duplicating seeded rows.

BEGIN;

CREATE TABLE IF NOT EXISTS universities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    domain VARCHAR(120) UNIQUE,
    branding_color VARCHAR(20) DEFAULT '#0f766e',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(150) UNIQUE,
    username VARCHAR(100) UNIQUE,
    password_hash TEXT,
    password TEXT,
    role VARCHAR(20) DEFAULT 'student',
    university_id INT REFERENCES universities(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT users_role_check CHECK (role IN ('student', 'advisor', 'admin'))
);

CREATE TABLE IF NOT EXISTS advisors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    university_id INT REFERENCES universities(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    advisor_id INT REFERENCES advisors(id) ON DELETE SET NULL,
    university_id INT REFERENCES universities(id) ON DELETE SET NULL,
    gpa DECIMAL(4,3) DEFAULT 4.000,
    status VARCHAR(30) DEFAULT 'on-track',
    completion_rate INT,
    requirement_completed_count INT,
    requirement_in_progress_count INT,
    requirement_missing_count INT,
    requirement_total_count INT,
    academic_standing VARCHAR(100),
    audit_university_name VARCHAR(150),
    last_audit_uploaded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    advisor_id INT REFERENCES advisors(id) ON DELETE SET NULL,
    category VARCHAR(50) DEFAULT 'general',
    priority VARCHAR(20) DEFAULT 'medium',
    title VARCHAR(150),
    message TEXT NOT NULL,
    recommended_action TEXT,
    status VARCHAR(20) DEFAULT 'active',
    is_resolved BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    source VARCHAR(50) DEFAULT 'system',
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT alerts_priority_check CHECK (priority IN ('low', 'medium', 'high')),
    CONSTRAINT alerts_status_check CHECK (status IN ('active', 'acknowledged', 'resolved'))
);

CREATE TABLE IF NOT EXISTS advisor_notes (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    advisor_id INT REFERENCES advisors(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Keep older local databases compatible with the current application code.
ALTER TABLE universities ADD COLUMN IF NOT EXISTS domain VARCHAR(120) UNIQUE;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS branding_color VARCHAR(20) DEFAULT '#0f766e';
ALTER TABLE universities ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(150) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'student';
ALTER TABLE users ADD COLUMN IF NOT EXISTS university_id INT REFERENCES universities(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE advisors ADD COLUMN IF NOT EXISTS university_id INT REFERENCES universities(id) ON DELETE SET NULL;
ALTER TABLE advisors ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

ALTER TABLE students ADD COLUMN IF NOT EXISTS university_id INT REFERENCES universities(id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS completion_rate INT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS requirement_completed_count INT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS requirement_in_progress_count INT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS requirement_missing_count INT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS requirement_total_count INT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS academic_standing VARCHAR(100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS audit_university_name VARCHAR(150);
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_audit_uploaded_at TIMESTAMP;
ALTER TABLE students ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE students ALTER COLUMN gpa TYPE DECIMAL(4,3);
ALTER TABLE students ALTER COLUMN status TYPE VARCHAR(30);

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS title VARCHAR(150);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS recommended_action TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'system';

INSERT INTO universities (name, domain, branding_color) VALUES
    ('Morgan State University', 'morgan.edu', '#0f766e'),
    ('Pathfinder Demo University', 'university.edu', '#1d4ed8')
ON CONFLICT (name) DO UPDATE
SET domain = EXCLUDED.domain,
    branding_color = EXCLUDED.branding_color;

INSERT INTO advisors (name, email, university_id)
SELECT 'Dr. Sarah Path', 'sarah.path@university.edu', universities.id
FROM universities
WHERE universities.domain = 'university.edu'
ON CONFLICT (email) DO UPDATE
SET name = EXCLUDED.name,
    university_id = EXCLUDED.university_id;

INSERT INTO advisors (name, email, university_id)
SELECT 'Dr. Morgan Advisor', 'advisor@morgan.edu', universities.id
FROM universities
WHERE universities.domain = 'morgan.edu'
ON CONFLICT (email) DO UPDATE
SET name = EXCLUDED.name,
    university_id = EXCLUDED.university_id;

INSERT INTO students (
    name,
    email,
    advisor_id,
    university_id,
    gpa,
    status,
    completion_rate,
    requirement_completed_count,
    requirement_in_progress_count,
    requirement_missing_count,
    requirement_total_count,
    academic_standing
)
SELECT
    'Alice Johnson',
    'alice.johnson@university.edu',
    advisors.id,
    universities.id,
    3.800,
    'on-track',
    82,
    14,
    2,
    3,
    19,
    'Good Standing'
FROM universities
JOIN advisors ON advisors.email = 'sarah.path@university.edu'
WHERE universities.domain = 'university.edu'
ON CONFLICT (email) DO UPDATE
SET advisor_id = EXCLUDED.advisor_id,
    university_id = EXCLUDED.university_id,
    gpa = EXCLUDED.gpa,
    status = EXCLUDED.status,
    completion_rate = EXCLUDED.completion_rate,
    requirement_completed_count = EXCLUDED.requirement_completed_count,
    requirement_in_progress_count = EXCLUDED.requirement_in_progress_count,
    requirement_missing_count = EXCLUDED.requirement_missing_count,
    requirement_total_count = EXCLUDED.requirement_total_count,
    academic_standing = EXCLUDED.academic_standing;

INSERT INTO students (
    name,
    email,
    advisor_id,
    university_id,
    gpa,
    status,
    completion_rate,
    requirement_completed_count,
    requirement_in_progress_count,
    requirement_missing_count,
    requirement_total_count,
    academic_standing
)
SELECT
    'Jordan Smith',
    'jordan.smith@university.edu',
    advisors.id,
    universities.id,
    1.900,
    'at-risk',
    54,
    8,
    1,
    8,
    17,
    'Academic Probation'
FROM universities
JOIN advisors ON advisors.email = 'sarah.path@university.edu'
WHERE universities.domain = 'university.edu'
ON CONFLICT (email) DO UPDATE
SET advisor_id = EXCLUDED.advisor_id,
    university_id = EXCLUDED.university_id,
    gpa = EXCLUDED.gpa,
    status = EXCLUDED.status,
    completion_rate = EXCLUDED.completion_rate,
    requirement_completed_count = EXCLUDED.requirement_completed_count,
    requirement_in_progress_count = EXCLUDED.requirement_in_progress_count,
    requirement_missing_count = EXCLUDED.requirement_missing_count,
    requirement_total_count = EXCLUDED.requirement_total_count,
    academic_standing = EXCLUDED.academic_standing;

INSERT INTO users (email, password_hash, role, university_id)
SELECT 'sarah.path@university.edu',
       '$2b$10$HEGAwPZcpLS0e/nixwbjF.B5S3Y61JYpAVjnak7.AwPiGStaMOpxe',
       'advisor',
       universities.id
FROM universities
WHERE universities.domain = 'university.edu'
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    university_id = EXCLUDED.university_id;

INSERT INTO users (email, password_hash, role, university_id)
SELECT 'alice.johnson@university.edu',
       '$2b$10$HEGAwPZcpLS0e/nixwbjF.B5S3Y61JYpAVjnak7.AwPiGStaMOpxe',
       'student',
       universities.id
FROM universities
WHERE universities.domain = 'university.edu'
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    university_id = EXCLUDED.university_id;

INSERT INTO users (email, password_hash, role, university_id)
SELECT 'jordan.smith@university.edu',
       '$2b$10$HEGAwPZcpLS0e/nixwbjF.B5S3Y61JYpAVjnak7.AwPiGStaMOpxe',
       'student',
       universities.id
FROM universities
WHERE universities.domain = 'university.edu'
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    university_id = EXCLUDED.university_id;

INSERT INTO alerts (
    student_id,
    advisor_id,
    category,
    priority,
    title,
    message,
    recommended_action,
    source
)
SELECT
    students.id,
    advisors.id,
    'academic',
    'high',
    'GPA Below Good Standing',
    'Your current GPA is 1.9, which may place you at academic risk.',
    'Schedule a meeting with your advisor this week to review your course load.',
    'system'
FROM students
JOIN advisors ON advisors.id = students.advisor_id
WHERE students.email = 'jordan.smith@university.edu'
  AND NOT EXISTS (
      SELECT 1
      FROM alerts
      WHERE alerts.student_id = students.id
        AND alerts.title = 'GPA Below Good Standing'
        AND alerts.source = 'system'
  );

INSERT INTO alerts (
    student_id,
    advisor_id,
    category,
    priority,
    title,
    message,
    recommended_action,
    source
)
SELECT
    students.id,
    advisors.id,
    'registration',
    'medium',
    'Registration Reminder',
    'Registration for next semester is approaching.',
    'Review your degree plan and confirm your course selections with your advisor.',
    'system'
FROM students
JOIN advisors ON advisors.id = students.advisor_id
WHERE students.email = 'alice.johnson@university.edu'
  AND NOT EXISTS (
      SELECT 1
      FROM alerts
      WHERE alerts.student_id = students.id
        AND alerts.title = 'Registration Reminder'
        AND alerts.source = 'system'
  );

INSERT INTO alerts (
    student_id,
    advisor_id,
    category,
    priority,
    title,
    message,
    recommended_action,
    source
)
SELECT
    students.id,
    advisors.id,
    'degree_requirement',
    'medium',
    'Degree Requirement Check',
    'You may still need to complete a required course for your major.',
    'Review your audit and ask your advisor to confirm remaining requirements.',
    'system'
FROM students
JOIN advisors ON advisors.id = students.advisor_id
WHERE students.email = 'alice.johnson@university.edu'
  AND NOT EXISTS (
      SELECT 1
      FROM alerts
      WHERE alerts.student_id = students.id
        AND alerts.title = 'Degree Requirement Check'
        AND alerts.source = 'system'
  );

INSERT INTO advisor_notes (student_id, advisor_id, note)
SELECT
    students.id,
    advisors.id,
    'Initial demo note: review next semester course planning with this student.'
FROM students
JOIN advisors ON advisors.id = students.advisor_id
WHERE students.email = 'alice.johnson@university.edu'
  AND NOT EXISTS (
      SELECT 1
      FROM advisor_notes
      WHERE advisor_notes.student_id = students.id
        AND advisor_notes.advisor_id = advisors.id
        AND advisor_notes.note = 'Initial demo note: review next semester course planning with this student.'
  );

CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_students_email ON students (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_students_advisor_id ON students (advisor_id);
CREATE INDEX IF NOT EXISTS idx_students_university_id ON students (university_id);
CREATE INDEX IF NOT EXISTS idx_advisors_email ON advisors (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_advisors_university_id ON advisors (university_id);
CREATE INDEX IF NOT EXISTS idx_alerts_student_active ON alerts (student_id, is_resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_advisor_active ON alerts (advisor_id, is_resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_source_status ON alerts (source, status);
CREATE INDEX IF NOT EXISTS idx_advisor_notes_student_advisor ON advisor_notes (student_id, advisor_id);

COMMIT;

-- Seed login credentials:
--   Advisor: sarah.path@university.edu / password123
--   Student: alice.johnson@university.edu / password123
--   Student: jordan.smith@university.edu / password123
