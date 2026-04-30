CREATE TABLE IF NOT EXISTS advisors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    advisor_id INT REFERENCES advisors(id),
    gpa DECIMAL(3,2) DEFAULT 4.0,
    status VARCHAR(20) DEFAULT 'on-track'
);


CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id),
    advisor_id INT REFERENCES advisors(id),
    message TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO advisors (name, email) VALUES
('Dr. Sarah Path', 'sarah.path@university.edu');

INSERT INTO students (name, email, advisor_id, gpa, status) VALUES
('Alice Johnson', 'alice.johnson@university.edu', 1, 3.8, 'on-track'),
('Jordan Smith', 'jordan.smith@university.edu', 1, 1.9, 'at-risk');

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS title VARCHAR(150);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS recommended_action TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'system';

INSERT INTO alerts (
    student_id,
    advisor_id,
    category,
    priority,
    title,
    message,
    recommended_action,
    source
) VALUES
(2, 1, 'academic', 'high', 'GPA Below Good Standing',
 'Your current GPA is 1.9, which may place you at academic risk.',
 'Schedule a meeting with your advisor this week to review your course load.',
 'system'),
(1, 1, 'registration', 'medium', 'Registration Reminder',
 'Registration for next semester is approaching.',
 'Review your degree plan and confirm your course selections with your advisor.',
 'system'),
(1, 1, 'degree_requirement', 'medium', 'Degree Requirement Check',
 'You may still need to complete a required course for your major.',
 'Review your audit and ask your advisor to confirm remaining requirements.',
 'system')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS advisor_notes (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    advisor_id INT REFERENCES advisors(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
