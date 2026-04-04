const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('./data/amitbodhit.db');
const users = db.prepare("SELECT id, email, name FROM users WHERE email LIKE 'o%' OR name LIKE 'o%'").all();
console.log('--- USERS ---');
console.log(JSON.stringify(users, null, 2));

const projects = db.prepare('SELECT id, user_id, title, status FROM projects').all();
console.log('--- PROJECTS ---');
console.log(JSON.stringify(projects, null, 2));
