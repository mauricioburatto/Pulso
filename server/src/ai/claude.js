const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

let client = null;
if (process.env.ANTHROPIC_API_KEY) {
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Espelha o helper callClaude() do protótipo (PerformanceApp.jsx) — mesma
// assinatura e mesmo formato de retorno, só que rodando no servidor com a
// API key real em vez do fetch direto do navegador.
async function callClaude({ system, messages, maxTokens = 1000 }) {
  if (!client) {
    const err = new Error('ANTHROPIC_API_KEY não configurada no servidor.');
    err.status = 503;
    throw err;
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages,
  });

  const text = (response.content || [])
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('\n')
    .trim();

  return { text, truncated: response.stop_reason === 'max_tokens' };
}

module.exports = { callClaude, configured: Boolean(client) };
