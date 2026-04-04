const db = require('../db/database');

const cache = new Map();

function updateMetric(oldValue, newValue) {
  const alpha = 0.2; 
  return oldValue * (1 - alpha) + newValue * alpha;
}

function getSkill(userId) {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.time < 60000) {
    return cached.data; 
  }

  const row = db.prepare('SELECT * FROM user_skills WHERE user_id = ?').get(userId);
  const fresh = row || { 
      fundamentals: 50, syntax: 50, problem_solving: 50, 
      debugging: 50, system_design: 50, update_count: 0 
  };
  
  if (cache.size > 1000) cache.clear();
  
  cache.set(userId, { data: fresh, time: Date.now() });
  return fresh;
}

function updateSkill(userId, newMetrics) {
    const current = { ...getSkill(userId) };
    
    current.fundamentals = updateMetric(current.fundamentals, newMetrics.fundamentals ?? current.fundamentals);
    current.syntax = updateMetric(current.syntax, newMetrics.syntax ?? current.syntax);
    current.problem_solving = updateMetric(current.problem_solving, newMetrics.problem_solving ?? current.problem_solving);
    current.debugging = updateMetric(current.debugging, newMetrics.debugging ?? current.debugging);
    current.system_design = updateMetric(current.system_design, newMetrics.system_design ?? current.system_design);
    current.update_count = (current.update_count || 0) + 1;

    cache.set(userId, { data: current, time: Date.now() });

    if (current.update_count % 5 === 0) {
        db.prepare(`
            INSERT INTO user_skills (user_id, fundamentals, syntax, problem_solving, debugging, system_design, update_count)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET 
                fundamentals = excluded.fundamentals,
                syntax = excluded.syntax,
                problem_solving = excluded.problem_solving,
                debugging = excluded.debugging,
                system_design = excluded.system_design,
                update_count = excluded.update_count
        `).run(userId, current.fundamentals, current.syntax, current.problem_solving, current.debugging, current.system_design, current.update_count);
    }
}

function getAdaptiveConfig(userId) {
    const skill = getSkill(userId);
    const avg = (skill.fundamentals + skill.syntax + skill.problem_solving) / 3;
    
    let difficulty = 'medium';
    if (avg < 30) difficulty = 'easy';
    if (avg > 70) difficulty = 'hard';

    return { avgSkill: avg, difficulty };
}

module.exports = { getSkill, updateSkill, getAdaptiveConfig };
