// Uses Node.js built-in sqlite (stable since Node 22.12.0)
// Zero npm packages, zero C++ compilation needed
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs   = require('fs');
const config = require('../config');

const DB_PATH = config.DB_PATH || './data/amitbodhit.db';
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(DB_PATH);

// WAL mode for better concurrent read performance; foreign keys enforced
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    skill_level TEXT DEFAULT 'beginner',
    role TEXT DEFAULT 'student',
    google_id TEXT,
    avatar TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS otp_requests (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    raw_goal TEXT,
    course_id TEXT REFERENCES courses(id),
    is_course INTEGER DEFAULT 0,
    course_version INTEGER,
    status TEXT DEFAULT 'active', -- active/completed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS milestones (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    ord INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    duration_days INTEGER,
    measurable_output TEXT,
    status TEXT DEFAULT 'locked',
    started_at TEXT,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    milestone_id TEXT NOT NULL REFERENCES milestones(id),
    ord INTEGER NOT NULL,
    day INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    estimated_hours REAL,
    commands TEXT DEFAULT '[]',
    folder_structure TEXT DEFAULT '{}',
    starter_template TEXT,
    concepts_taught TEXT DEFAULT '[]',
    status TEXT DEFAULT 'pending',
    submission_text TEXT,
    attempts INTEGER DEFAULT 0,
    started_at TEXT,
    submitted_at TEXT,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS qa_reviews (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    attempt_number INTEGER DEFAULT 1,
    verdict TEXT NOT NULL,
    score REAL DEFAULT 0,
    passed_checks TEXT DEFAULT '[]',
    failed_checks TEXT DEFAULT '[]',
    corrections TEXT DEFAULT '[]',
    feedback_text TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS automation_suggestions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    milestone_id TEXT REFERENCES milestones(id),
    tool TEXT,
    description TEXT,
    script_snippet TEXT,
    benefit TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conversation_turns (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    task_id TEXT REFERENCES tasks(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    context_type TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS workspace_files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    file_path TEXT NOT NULL,
    content TEXT,
    file_type TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS command_logs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    task_id TEXT REFERENCES tasks(id),
    command TEXT NOT NULL,
    exit_code INTEGER,
    stdout TEXT,
    stderr TEXT,
    executed_at TEXT DEFAULT (datetime('now')),
    duration_ms INTEGER
  );

  CREATE TABLE IF NOT EXISTS progress_snapshots (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    milestone_id TEXT REFERENCES milestones(id),
    task_id TEXT REFERENCES tasks(id),
    progress_pct REAL,
    total_tasks INTEGER,
    completed_tasks INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS otp_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- [V2 COURSE ENGINE SCHEMA]

  CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    difficulty TEXT,
    tech_stack TEXT,
    estimated_hours INTEGER,
    popularity INTEGER DEFAULT 0,
    completion_rate REAL DEFAULT 0,
    difficulty_score INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    version INTEGER DEFAULT 1,
    badge TEXT DEFAULT 'official',
    source TEXT DEFAULT 'official',
    creator_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS course_milestones (
    id TEXT PRIMARY KEY,
    course_id TEXT REFERENCES courses(id),
    title TEXT,
    position INTEGER
  );

  CREATE TABLE IF NOT EXISTS course_tasks (
    id TEXT PRIMARY KEY,
    course_id TEXT REFERENCES courses(id),
    milestone_id TEXT REFERENCES course_milestones(id),
    title TEXT,
    description TEXT,
    position INTEGER,
    validation_type TEXT, -- static / regex / custom
    validation_rules TEXT, -- JSON rules
    hints TEXT, -- JSON array
    starter_template TEXT,
    folder_structure TEXT,
    file_path TEXT,
    version INTEGER DEFAULT 1,
    estimated_minutes INTEGER
  );

  CREATE TABLE IF NOT EXISTS course_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    task_id TEXT REFERENCES course_tasks(id),
    status TEXT DEFAULT 'pending', -- pending / completed
    attempts INTEGER DEFAULT 0,
    last_scaffold_level INTEGER DEFAULT 1,
    last_hint_used INTEGER DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    help_requested INTEGER DEFAULT 0,
    active_mentor_id TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS behavior_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    task_id TEXT NOT NULL REFERENCES course_tasks(id),
    cheat_score INTEGER,
    paste_score INTEGER,
    typing_pattern INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_skills (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    fundamentals REAL DEFAULT 0,
    syntax REAL DEFAULT 0,
    problem_solving REAL DEFAULT 0,
    debugging REAL DEFAULT 0,
    system_design REAL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- [PHASE 9: MARKETPLACE + CONTROLLED EXECUTION]

  CREATE TABLE IF NOT EXISTS community_projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    tech_stack TEXT DEFAULT '[]',
    difficulty TEXT DEFAULT 'intermediate',
    final_outcome TEXT,
    estimated_hours REAL DEFAULT 10,
    status TEXT DEFAULT 'pending',
    structured_data TEXT,
    rejection_reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    reviewed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS hint_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    task_id TEXT NOT NULL,
    requested_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS project_memory (
    project_id TEXT PRIMARY KEY REFERENCES projects(id),
    task_id TEXT,
    last_code_snapshot TEXT,
    last_action TEXT,
    concepts_json TEXT DEFAULT '[]', -- [ "express-setup", "routing" ]
    failures_json TEXT DEFAULT '{}', -- { "TypeError": 4, "ECONNREFUSED": 2 }
    reflections_json TEXT DEFAULT '[]', -- [ { "task": "...", "text": "..." } ]
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

` + `
  CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES projects(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

`);

console.log('[DB] Ready (node:sqlite) →', config.DB_PATH);

// ─── Migrations ──────────────────────────────────────────────────────────────
// SQLite CREATE TABLE IF NOT EXISTS doesn't add columns to existing tables.
// We manually ensure new columns exist.
const tableInfo = db.prepare("PRAGMA table_info(users)").all();
const cols = tableInfo.map(c => c.name);

if (!cols.includes('role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'student'");
  console.log('[DB] Migrated: added role to users');
}
if (!cols.includes('google_id')) {
  db.exec("ALTER TABLE users ADD COLUMN google_id TEXT");
  console.log('[DB] Migrated: added google_id to users');
}
if (!cols.includes('avatar')) {
  db.exec("ALTER TABLE users ADD COLUMN avatar TEXT");
  console.log('[DB] Migrated: added avatar to users');
}
if (!cols.includes('active_project_id')) {
  db.exec("ALTER TABLE users ADD COLUMN active_project_id TEXT");
  console.log('[DB] Migrated: added active_project_id to users');
}

const projInfo = db.prepare("PRAGMA table_info(projects)").all().map(c => c.name);
if (!projInfo.includes('is_course')) {
  db.exec("ALTER TABLE projects ADD COLUMN is_course INTEGER DEFAULT 0");
  db.exec("ALTER TABLE projects ADD COLUMN course_id TEXT REFERENCES courses(id)");
  db.exec("ALTER TABLE projects ADD COLUMN course_version TEXT");
  console.log('[DB] Migrated: added V2 course metadata to projects');
}
if (!projInfo.includes('title'))          db.exec("ALTER TABLE projects ADD COLUMN title TEXT");
if (!projInfo.includes('tech_stack'))     db.exec("ALTER TABLE projects ADD COLUMN tech_stack TEXT DEFAULT '[]'");
if (!projInfo.includes('scope'))          db.exec("ALTER TABLE projects ADD COLUMN scope TEXT DEFAULT ''");
if (!projInfo.includes('deadline_days'))  db.exec("ALTER TABLE projects ADD COLUMN deadline_days INTEGER DEFAULT 7");
if (!projInfo.includes('skill_level'))    db.exec("ALTER TABLE projects ADD COLUMN skill_level TEXT DEFAULT 'beginner'");
if (!projInfo.includes('deliverables'))   db.exec("ALTER TABLE projects ADD COLUMN deliverables TEXT DEFAULT '[]'");
if (!projInfo.includes('clarification_history')) db.exec("ALTER TABLE projects ADD COLUMN clarification_history TEXT DEFAULT '[]'");
if (!projInfo.includes('clarification_round'))   db.exec("ALTER TABLE projects ADD COLUMN clarification_round INTEGER DEFAULT 0");
if (!projInfo.includes('current_milestone_id'))   db.exec("ALTER TABLE projects ADD COLUMN current_milestone_id TEXT");
if (!projInfo.includes('current_task_id'))         db.exec("ALTER TABLE projects ADD COLUMN current_task_id TEXT");
if (!projInfo.includes('total_tasks'))     db.exec("ALTER TABLE projects ADD COLUMN total_tasks INTEGER DEFAULT 0");
if (!projInfo.includes('completed_tasks')) db.exec("ALTER TABLE projects ADD COLUMN completed_tasks INTEGER DEFAULT 0");
if (!projInfo.includes('progress_pct'))    db.exec("ALTER TABLE projects ADD COLUMN progress_pct REAL DEFAULT 0");
if (!projInfo.includes('updated_at'))      db.exec("ALTER TABLE projects ADD COLUMN updated_at TEXT");

// [V2 COURSE ENGINE MIGRATIONS (PHASE 10)]
const cmInfo = db.prepare("PRAGMA table_info(course_milestones)").all().map(c => c.name);
if (cmInfo.includes('order_index') && !cmInfo.includes('position')) {
  db.exec("ALTER TABLE course_milestones RENAME COLUMN order_index TO position");
  console.log('[DB] Migrated: course_milestones (order_index -> position)');
}

const ctInfo = db.prepare("PRAGMA table_info(course_tasks)").all().map(c => c.name);
if (ctInfo.includes('order_index') && !ctInfo.includes('position')) {
  db.exec("ALTER TABLE course_tasks RENAME COLUMN order_index TO position");
  console.log('[DB] Migrated: course_tasks (order_index -> position)');
}
if (!ctInfo.includes('validation_rules')) db.exec("ALTER TABLE course_tasks ADD COLUMN validation_rules TEXT");
if (!ctInfo.includes('hints'))            db.exec("ALTER TABLE course_tasks ADD COLUMN hints TEXT");
if (!ctInfo.includes('starter_template')) db.exec("ALTER TABLE course_tasks ADD COLUMN starter_template TEXT");
if (!ctInfo.includes('folder_structure')) db.exec("ALTER TABLE course_tasks ADD COLUMN folder_structure TEXT");
if (!ctInfo.includes('file_path'))        db.exec("ALTER TABLE course_tasks ADD COLUMN file_path TEXT");
if (!ctInfo.includes('version'))          db.exec("ALTER TABLE course_tasks ADD COLUMN version INTEGER DEFAULT 1");
if (!ctInfo.includes('estimated_minutes')) db.exec("ALTER TABLE course_tasks ADD COLUMN estimated_minutes INTEGER");
if (!ctInfo.includes('course_id'))        db.exec("ALTER TABLE course_tasks ADD COLUMN course_id TEXT REFERENCES courses(id)");
if (ctInfo.includes('validation_pattern')) {
  // Optional: Rename or drop if not needed, but for now we leave it
}

const cInfo = db.prepare("PRAGMA table_info(courses)").all().map(c => c.name);
if (!cInfo.includes('is_active')) {
  if (cInfo.includes('active')) {
    db.exec("ALTER TABLE courses RENAME COLUMN active TO is_active");
  } else {
    db.exec("ALTER TABLE courses ADD COLUMN is_active INTEGER DEFAULT 1");
  }
}
if (!cInfo.includes('estimated_hours')) {
  db.exec("ALTER TABLE courses ADD COLUMN estimated_hours INTEGER");
}
if (!cInfo.includes('popularity')) {
  db.exec("ALTER TABLE courses ADD COLUMN popularity INTEGER DEFAULT 0");
  db.exec("ALTER TABLE courses ADD COLUMN completion_rate REAL DEFAULT 0");
  db.exec("ALTER TABLE courses ADD COLUMN difficulty_score INTEGER DEFAULT 0");
}
if (!cInfo.includes('version')) {
  db.exec("ALTER TABLE courses ADD COLUMN version INTEGER DEFAULT 1");
}

if (!cInfo.includes('badge')) db.exec("ALTER TABLE courses ADD COLUMN badge TEXT DEFAULT 'official'");
if (!cInfo.includes('source')) db.exec("ALTER TABLE courses ADD COLUMN source TEXT DEFAULT 'official'");
if (!cInfo.includes('creator_id')) db.exec("ALTER TABLE courses ADD COLUMN creator_id TEXT");

db.exec("UPDATE courses SET badge = 'official' WHERE badge IS NULL");
db.exec("UPDATE courses SET source = 'official' WHERE source IS NULL");

const cpInfo = db.prepare("PRAGMA table_info(course_progress)").all().map(c => c.name);
if (cpInfo.includes('course_task_id') && !cpInfo.includes('task_id')) {
  db.exec("ALTER TABLE course_progress RENAME COLUMN course_task_id TO task_id");
  console.log('[DB] Migrated: course_progress (course_task_id -> task_id)');
}
if (!cpInfo.includes('user_id')) {
  db.exec("ALTER TABLE course_progress ADD COLUMN user_id TEXT REFERENCES users(id)");
  db.exec("ALTER TABLE course_progress ADD COLUMN last_scaffold_level INTEGER DEFAULT 1");
  db.exec("ALTER TABLE course_progress ADD COLUMN last_hint_used INTEGER DEFAULT 0");
  db.exec("ALTER TABLE course_progress ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP");
}
if (!cpInfo.includes('completed_at')) {
  db.exec("ALTER TABLE course_progress ADD COLUMN completed_at DATETIME");
}
if (!cpInfo.includes('started_at')) {
  db.exec("ALTER TABLE course_progress ADD COLUMN started_at DATETIME DEFAULT CURRENT_TIMESTAMP");
}
if (!cpInfo.includes('help_requested')) {
  db.exec("ALTER TABLE course_progress ADD COLUMN help_requested INTEGER DEFAULT 0");
}
if (!cpInfo.includes('active_mentor_id')) {
  db.exec("ALTER TABLE course_progress ADD COLUMN active_mentor_id TEXT");
}
if (!cpInfo.includes('last_help_request')) {
  db.exec("ALTER TABLE course_progress ADD COLUMN last_help_request DATETIME");
  db.exec("ALTER TABLE course_progress ADD COLUMN failure_consistency INTEGER DEFAULT 0");
  db.exec("ALTER TABLE course_progress ADD COLUMN last_error_hash TEXT");
  db.exec("ALTER TABLE course_progress ADD COLUMN interventions_count INTEGER DEFAULT 0");
}

// [COURSE BUILDER SCHEMA EXTENSIONS]
const courseInfo = db.prepare("PRAGMA table_info(courses)").all().map(c => c.name);
if (!courseInfo.includes('creator_id'))      db.exec("ALTER TABLE courses ADD COLUMN creator_id TEXT REFERENCES users(id)");
if (!courseInfo.includes('learning_outcome')) db.exec("ALTER TABLE courses ADD COLUMN learning_outcome TEXT");
if (!courseInfo.includes('status'))          db.exec("ALTER TABLE courses ADD COLUMN status TEXT DEFAULT 'draft'");

const cmInfo2 = db.prepare("PRAGMA table_info(course_milestones)").all().map(c => c.name);
if (!cmInfo2.includes('description'))  db.exec("ALTER TABLE course_milestones ADD COLUMN description TEXT");
if (!cmInfo2.includes('duration_days')) db.exec("ALTER TABLE course_milestones ADD COLUMN duration_days INTEGER DEFAULT 7");

const ctInfo2 = db.prepare("PRAGMA table_info(course_tasks)").all().map(c => c.name);
if (!ctInfo2.includes('concepts'))    db.exec("ALTER TABLE course_tasks ADD COLUMN concepts TEXT DEFAULT '[]'");
if (!ctInfo2.includes('steps'))       db.exec("ALTER TABLE course_tasks ADD COLUMN steps TEXT DEFAULT '[]'");
if (!ctInfo2.includes('difficulty'))   db.exec("ALTER TABLE course_tasks ADD COLUMN difficulty TEXT DEFAULT 'easy'");
if (!ctInfo2.includes('goal'))        db.exec("ALTER TABLE course_tasks ADD COLUMN goal TEXT");
if (!ctInfo2.includes('commands'))    db.exec("ALTER TABLE course_tasks ADD COLUMN commands TEXT DEFAULT '[]'");

module.exports = db;
