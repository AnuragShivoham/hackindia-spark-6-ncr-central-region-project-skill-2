/**
 * Force Learning Loop: Behavior Analysis
 * Converts raw telemetry into a 'Learning Mode' directive.
 * 
 * Logic Shifts (Psychology over Punishment):
 * - <20ms/char: Suspicious (bot/script/copy-trigger)
 * - 20-60ms: Normal (fast human)
 * - 500+ characters: High Paste (Complexity Jump)
 */
function calculateScore(data) {
  // data: { pasteSize, typingSpeed, complexityJump, attempts, wasEmpty }
  
  // 1. Paste Sensitivity (Exponential after 500)
  let pasteScore = 0;
  if (data.pasteSize > 500) {
    pasteScore = Math.min(60 + (data.pasteSize - 500) / 20, 100); 
  } else if (data.pasteSize > 200) {
    pasteScore = (data.pasteSize / 10); // 20-50
  }

  // 2. Typing Pattern Analysis
  // avgSpeed is ms per keystroke
  let typingPattern = 0;
  if (data.typingSpeed < 20) {
    typingPattern = 100; // Likely scripted or rapid-fire paste triggering keys
  } else if (data.typingSpeed < 60) {
    typingPattern = 40;  // Fast - Active Learning
  } else {
    typingPattern = 0;   // Normal
  }

  // 3. Context Awareness (Empty Editor + Large Paste = High Flag)
  let contextFlag = 0;
  if (data.wasEmpty && data.pasteSize > 300) {
    contextFlag = 100;
  }

  // 4. Intensity Factor: High Paste + Fast Typing = Clear Cheat
  let editConsistency = (data.pasteSize > 400 && data.typingSpeed < 30) ? 100 : 0; 

  // Weighted Composition (0-100)
  const score = (pasteScore * 0.3) + (typingPattern * 0.1) + (contextFlag * 0.4) + (editConsistency * 0.2);
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

module.exports = { calculateScore };
