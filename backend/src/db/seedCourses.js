const db = require('./database');

function upsertCourse(course) {
  db.prepare(`
    INSERT INTO courses (id, title, description, difficulty, tech_stack, version)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      description=excluded.description,
      difficulty=excluded.difficulty,
      tech_stack=excluded.tech_stack,
      version=excluded.version
  `).run(
    course.id,
    course.title,
    course.description,
    course.difficulty,
    course.tech_stack,
    course.version
  );
}

function insertMilestones(courseId, milestones) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO course_milestones
    (id, course_id, title, position)
    VALUES (?, ?, ?, ?)
  `);

  milestones.forEach((m, i) => {
    stmt.run(m.id, courseId, m.title, i);
  });
}

function insertTasks(courseId, tasks) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO course_tasks
    (id, course_id, milestone_id, title, description, position,
     validation_type, validation_rules, hints, file_path, starter_template)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  tasks.forEach((t, i) => {
    stmt.run(
      t.id,
      courseId,
      t.milestone_id || null,
      t.title || "Untitled Task",
      t.description || null,
      i,
      "static",
      JSON.stringify(t.validation || {}),
      JSON.stringify(t.hints || []),
      t.file_path || null,
      t.starter_template || null
    );
  });
}

function seedUrlShortener() {
  const courseId = "course_url_shortener";

  upsertCourse({
    id: courseId,
    title: "URL Shortener",
    description: "Build a URL shortening service with analytics",
    difficulty: "medium",
    tech_stack: "Node.js, Express, SQLite",
    version: 1
  });

  insertMilestones(courseId, [
    { id: "m1", title: "Server Setup" },
    { id: "m2", title: "Shorten API" },
    { id: "m3", title: "Redirect" },
    { id: "m4", title: "Analytics" }
  ]);

  insertTasks(courseId, [
    {
      id: "t1",
      milestone_id: "m1",
      title: "Initialize Express Server",
      description: "Create a basic Express server",
      file_path: "src/index.js",
      starter_template: "const express = require('express');\nconst app = express();\n\n// TODO: Setup basic route and listen\n\nmodule.exports = app;",
      validation: { mustInclude: ["app.listen"] },
      hints: ["Use Express to start server"]
    },
    {
      id: "t2",
      milestone_id: "m2",
      title: "Create POST /shorten",
      description: "Define a route to shorten URLs",
      file_path: "src/index.js",
      starter_template: "// Previous code...\n\napp.post('/shorten', (req, res) => {\n  // TODO: Generate short ID\n});",
      validation: { mustInclude: ["app.post"] },
      hints: ["Define POST route"]
    },
    {
      id: "t3",
      milestone_id: "m3",
      title: "Redirect URL",
      description: "Implement the redirect logic",
      file_path: "src/index.js",
      starter_template: "app.get('/:id', (req, res) => {\n  // TODO: Redirect to long URL\n});",
      validation: { mustInclude: ["res.redirect"] },
      hints: ["Use redirect method"]
    },
    {
      id: "t4",
      milestone_id: "m4",
      title: "Track clicks",
      description: "Add a click counter to analytics",
      file_path: "src/index.js",
      starter_template: "// Logic to increment click count...",
      validation: { mustInclude: ["click"] },
      hints: ["Increment counter"]
    }
  ]);
}

function seedChatApp() {
  const courseId = "course_chat_app";

  upsertCourse({
    id: courseId,
    title: "Realtime Chat App",
    description: "Build socket-based chat system",
    difficulty: "hard",
    tech_stack: "Node.js, Socket.io",
    version: 1
  });

  insertMilestones(courseId, [
    { id: "m1c", title: "Socket Setup" },
    { id: "m2c", title: "Send Messages" },
    { id: "m3c", title: "Receive Messages" }
  ]);

  insertTasks(courseId, [
    {
      id: "t1c",
      milestone_id: "m1c",
      title: "Initialize socket.io",
      file_path: "src/server.js",
      starter_template: "const http = require('http');\nconst { Server } = require('socket.io');\n\nconst server = http.createServer();\n// TODO: Initialize IO",
      validation: { mustInclude: ["socket.io"] },
      hints: ["Import socket.io"]
    },
    {
      id: "t2c",
      milestone_id: "m2c",
      title: "Emit message",
      file_path: "src/server.js",
      starter_template: "io.on('connection', (socket) => {\n  // TODO: Emit message\n});",
      validation: { mustInclude: ["emit"] },
      hints: ["Use emit"]
    },
    {
      id: "t3c",
      milestone_id: "m3c",
      title: "Listen messages",
      file_path: "src/server.js",
      starter_template: "socket.on('message', (data) => {\n  // TODO: Handle broadcast\n});",
      validation: { mustInclude: ["on"] },
      hints: ["Use on()"]
    }
  ]);
}

function seedEcommerce() {
  const courseId = "course_ecommerce";

  upsertCourse({
    id: courseId,
    title: "E-commerce Backend",
    description: "Build product, cart and order APIs",
    difficulty: "hard",
    tech_stack: "Node.js, Express",
    version: 1
  });

  insertMilestones(courseId, [
    { id: "m1e", title: "Products" },
    { id: "m2e", title: "Cart" },
    { id: "m3e", title: "Orders" }
  ]);

  insertTasks(courseId, [
    {
      id: "t1e",
      milestone_id: "m1e",
      title: "Create product API",
      file_path: "src/app.js",
      starter_template: "const express = require('express');\nconst app = express();\n\n// TODO: GET /products",
      validation: { mustInclude: ["products"] },
      hints: ["Define routes"]
    },
    {
      id: "t2e",
      milestone_id: "m2e",
      title: "Add to cart",
      file_path: "src/app.js",
      starter_template: "app.post('/cart', (req, res) => {\n  // TODO: Add to session cart\n});",
      validation: { mustInclude: ["cart"] },
      hints: ["Store cart"]
    },
    {
      id: "t3e",
      milestone_id: "m3e",
      title: "Create order",
      file_path: "src/app.js",
      starter_template: "app.post('/orders', (req, res) => {\n  // TODO: Commit cart to DB\n});",
      validation: { mustInclude: ["order"] },
      hints: ["Handle checkout"]
    }
  ]);
}

function seedTaskManager() {
  const courseId = "course_task_manager";

  upsertCourse({
    id: courseId,
    title: "Task Manager",
    description: "Kanban-style task manager",
    difficulty: "medium",
    tech_stack: "React, Node",
    version: 1
  });

  insertMilestones(courseId, [
    { id: "m1t", title: "Create Tasks" },
    { id: "m2t", title: "Update Tasks" }
  ]);

  insertTasks(courseId, [
    {
      id: "t1t",
      milestone_id: "m1t",
      title: "Create task",
      validation: { mustInclude: ["createTask"] },
      hints: ["Store tasks"]
    },
    {
      id: "t2t",
      milestone_id: "m2t",
      title: "Update task",
      validation: { mustInclude: ["update"] },
      hints: ["Edit tasks"]
    }
  ]);
}

function seedAuth() {
  const courseId = "course_auth";

  upsertCourse({
    id: courseId,
    title: "JWT Auth System",
    description: "Authentication with JWT",
    difficulty: "medium",
    tech_stack: "Node.js, JWT",
    version: 1
  });

  insertMilestones(courseId, [
    { id: "m1a", title: "Login/Register" },
    { id: "m2a", title: "JWT" }
  ]);

  insertTasks(courseId, [
    {
      id: "t1a",
      milestone_id: "m1a",
      title: "Login API",
      validation: { mustInclude: ["login"] },
      hints: ["Create login route"]
    },
    {
      id: "t2a",
      milestone_id: "m2a",
      title: "Generate JWT",
      validation: { mustInclude: ["jwt.sign"] },
      hints: ["Use jwt.sign"]
    }
  ]);
}

function runSeed() {
  seedUrlShortener();
  seedChatApp();
  seedEcommerce();
  seedTaskManager();
  seedAuth();

  console.log("✅ Courses seeded successfully");
}

runSeed();
