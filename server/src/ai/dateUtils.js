// Port exato de daysUntil/calcAge do protótipo (PerformanceApp.jsx), usados
// na montagem de alguns prompts (planilha de treino, avaliação corporal).

function daysUntil(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
}

function calcAge(birthDateStr) {
  if (!birthDateStr) return null;
  const b = new Date(birthDateStr + 'T00:00:00');
  if (isNaN(b)) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

module.exports = { daysUntil, calcAge };
