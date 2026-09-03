const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

let unauthorizedHandler = null;
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

async function apiFetch(path, { method = 'GET', body, isFormData = false } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  const raw = await res.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && unauthorizedHandler) unauthorizedHandler();
    throw new Error((data && data.error) || res.statusText || 'Erro na requisição.');
  }
  return data;
}

// A conta vinda do backend tem weight/height como número e birthDate como
// datetime ISO — o resto do app trata esses campos como strings simples
// ("72.5", "1.75", "1995-05-20"), então normalizamos aqui, uma vez só.
function normalizeAccount(account) {
  if (!account) return account;
  return {
    ...account,
    weight: account.weight != null ? String(account.weight) : '',
    height: account.height != null ? String(account.height) : '',
    birthDate: account.birthDate ? account.birthDate.slice(0, 10) : '',
  };
}

export function resolveMediaUrl(url) {
  if (!url) return url;
  if (/^https?:\/\//.test(url)) return url;
  return `${API_BASE}${url}`;
}

export const api = {
  async signup(payload) {
    const data = await apiFetch('/auth/signup', { method: 'POST', body: payload });
    return normalizeAccount(data.account);
  },
  async login(payload) {
    const data = await apiFetch('/auth/login', { method: 'POST', body: payload });
    return normalizeAccount(data.account);
  },
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
  async me() {
    const data = await apiFetch('/me');
    return normalizeAccount(data.account);
  },
  forgotPassword: (email) => apiFetch('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (payload) => apiFetch('/auth/reset-password', { method: 'POST', body: payload }),

  async getCore() {
    const data = await apiFetch('/athlete/core');
    return data.core;
  },
  async putCore(core) {
    const data = await apiFetch('/athlete/core', { method: 'PUT', body: { core } });
    return data.core;
  },

  async listPhotos() {
    const data = await apiFetch('/athlete/photos');
    return data.photos;
  },
  async uploadPhoto(formData) {
    const data = await apiFetch('/athlete/photos', { method: 'POST', body: formData, isFormData: true });
    return data.photo;
  },
  deletePhoto: (id) => apiFetch(`/athlete/photos/${id}`, { method: 'DELETE' }),

  ai: {
    lerPrintTreino: (payload) => apiFetch('/ai/ler-print-treino', { method: 'POST', body: payload }),
    interpretarTreinoTexto: (payload) => apiFetch('/ai/interpretar-treino-texto', { method: 'POST', body: payload }),
    gerarPlanilha: (payload) => apiFetch('/ai/gerar-planilha', { method: 'POST', body: payload }),
    detalharSessao: (payload) => apiFetch('/ai/detalhar-sessao', { method: 'POST', body: payload }),
    avaliacaoTreinoAtual: (payload) => apiFetch('/ai/avaliacao-treino-atual', { method: 'POST', body: payload }),
    avaliacaoCorporal: (payload) => apiFetch('/ai/avaliacao-corporal', { method: 'POST', body: payload }),
    gerarDieta: (payload) => apiFetch('/ai/gerar-dieta', { method: 'POST', body: payload }),
    sugestaoSuplementacao: (payload) => apiFetch('/ai/sugestao-suplementacao', { method: 'POST', body: payload }),
    analiseEvolucao: (payload) => apiFetch('/ai/analise-evolucao', { method: 'POST', body: payload }),
    relatorio: (payload) => apiFetch('/ai/relatorio', { method: 'POST', body: payload }),
  },
};
