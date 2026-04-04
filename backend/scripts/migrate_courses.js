const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './data/amitbodhit.db';
const db = new Database(dbPath);

try {
    db.prepare("ALTER TABLE courses ADD COLUMN badge TEXT DEFAULT 'official'").run();
    console.log('Added badge column');
} catch (e) {
    console.log('Badge column already exists');
}

try {
    db.prepare("ALTER TABLE courses ADD COLUMN source TEXT DEFAULT 'official'").run();
    console.log('Added source column');
} catch (e) {
    console.log('Source column already exists');
}

db.prepare("UPDATE courses SET badge = 'official', source = 'official' WHERE badge IS NULL OR source IS NULL").run();
console.log('Migrated existing courses');
db.close();
