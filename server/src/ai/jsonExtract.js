// Port exato de extractJsonArray/extractJsonObject do protótipo
// (PerformanceApp.jsx) — mesma lógica de reparo de JSON cortado por limite
// de tokens.

function extractJsonArray(text) {
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('[');
  if (start === -1) throw new Error('Nenhum array JSON encontrado na resposta.');
  const candidate = cleaned.slice(start);
  try {
    return JSON.parse(candidate);
  } catch {
    let depth = 0;
    let lastGoodEnd = -1;
    let inString = false;
    let escape = false;
    for (let i = 0; i < candidate.length; i++) {
      const ch = candidate[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inString = !inString;
      if (inString) continue;
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) lastGoodEnd = i;
      }
    }
    if (lastGoodEnd === -1) {
      throw new Error('A resposta veio incompleta e não foi possível recuperar nenhum item.');
    }
    const repaired = candidate.slice(0, lastGoodEnd + 1) + ']';
    return JSON.parse(repaired);
  }
}

function extractJsonObject(text) {
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Nenhum objeto JSON encontrado na resposta.');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

module.exports = { extractJsonArray, extractJsonObject };
