function calculateScore(data) {
  // data: { pasteSize, typingSpeed, complexityJump, attempts }
  // weighted formula ruleset: 
  // pasteScore * 0.4 + typingPattern * 0.2 + complexityJump * 0.3 + attemptHistory * 0.1
  
  let pasteScore = Math.min((data.pasteSize || 0) / 10, 100);
  let typingPattern = data.typingSpeed > 200 ? 100 : Math.min((data.typingSpeed || 0) / 2, 100);
  let complexityJump = data.complexityJump || 0; 
  let attemptHistory = data.attempts === 1 ? 100 : 0; 
  
  // Human typing is natively inconsistent. Perfect cadences or bulk chunks trigger flags.
  let editConsistency = (pasteScore > 50 && typingPattern < 20) ? 100 : 0; 

  const score = (pasteScore * 0.3) + (typingPattern * 0.1) + (editConsistency * 0.2) + (complexityJump * 0.3) + (attemptHistory * 0.1);
  return Math.round(score);
}

module.exports = { calculateScore };
