# Pulso Web

Frontend do Pulso — Vite + React, migrado do protótipo `PerformanceApp.jsx`
(artifact standalone) para consumir a API real em `/server` em vez de
`window.storage`/chamadas diretas à Anthropic no navegador.

## Setup

```bash
cp .env.example .env   # aponte VITE_API_BASE_URL pro backend (padrão: localhost:3000)
npm install
npm run dev             # http://localhost:5173
```

Requer o backend (`/server`) rodando — veja `server/README.md`. O
`CLIENT_ORIGIN` do backend precisa apontar para a origem deste app
(`http://localhost:5173` em dev).

## O que mudou em relação ao protótipo

- **Sessão/conta**: `ProfileGate` fala com `POST /auth/signup`,
  `POST /auth/login`, `POST /auth/forgot-password`,
  `POST /auth/reset-password` em vez de simular tudo em
  `window.storage`. A sessão é um cookie httpOnly — não há mais
  `hashPassword`/lista local de contas no navegador.
- **Dados do atleta**: `core` é carregado via `GET /athlete/core` e salvo
  via `PUT /athlete/core` (substituindo `storeGet`/`storeSet`).
- **Fotos de evolução**: upload real (`multipart/form-data`) para
  `POST /athlete/photos` em vez de guardar base64 dentro do `core`.
- **IA**: as 10 chamadas que antes iam direto pro `fetch` da Anthropic no
  navegador agora chamam os endpoints `/ai/*` do backend
  (`src/api.js`), que já devolvem o resultado processado — os system
  prompts continuam exatamente os mesmos, só mudou de onde a chamada
  parte.
- O design visual (tokens de cor, tipografia, componentes) não foi
  tocado — só a camada de dados/rede.

`src/api.js` centraliza toda comunicação com o backend (fetch com
`credentials: "include"` para o cookie de sessão).
