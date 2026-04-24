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
('Jordan Smith', 'jordan.smith@university.edu', 1, 1.9, 'at-risk');;