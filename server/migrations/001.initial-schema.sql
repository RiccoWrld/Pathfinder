CREATE TABLE IF NOT EXISTS universities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  branding_color VARCHAR(7) DEFAULT '#0f766e',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'advisor')),
  university_id INT REFERENCES universities(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS advisors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  university_id INT REFERENCES universities(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  gpa DECIMAL(3,2),
  status VARCHAR(50),
  completion_rate INT,
  academic_standing VARCHAR(255),
  last_audit_uploaded_at TIMESTAMP,
  audit_university_name VARCHAR(255),
  advisor_id INT REFERENCES advisors(id),
  university_id INT REFERENCES universities(id),
  requirement_completed_count INT DEFAULT 0,
  requirement_in_progress_count INT DEFAULT 0,
  requirement_missing_count INT DEFAULT 0,
  requirement_total_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  advisor_id INT REFERENCES advisors(id),
  category VARCHAR(50) DEFAULT 'general',
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  title VARCHAR(255),
  message TEXT NOT NULL,
  recommended_action TEXT,
  source VARCHAR(50) DEFAULT 'manual',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS advisor_notes (
  id SERIAL PRIMARY KEY,
  student_id INT REFERENCES students(id) ON DELETE CASCADE,
  advisor_id INT REFERENCES advisors(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_students_advisor_id ON students(advisor_id);
CREATE INDEX IF NOT EXISTS idx_alerts_student_id ON alerts(student_id);
CREATE INDEX IF NOT EXISTS idx_alerts_advisor_id ON alerts(advisor_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_resolved ON alerts(is_resolved);
