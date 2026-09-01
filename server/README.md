# Pulso API

Backend Node/Express + Prisma/PostgreSQL do Pulso (Fase 1: fundação —
contas e sessão).

## Setup

```bash
cp .env.example .env   # preencha DATABASE_URL e JWT_SECRET
npm install
npm run prisma:migrate
npm run dev
```

## Endpoints (Fase 1)

- `POST /auth/signup` — cria conta + `athlete_core` inicial, abre sessão
- `POST /auth/login` — abre sessão
- `POST /auth/logout` — encerra sessão
- `GET /me` — retorna a conta autenticada (rota protegida)

Sessão via cookie httpOnly (`pulso_session`) contendo um JWT. Senhas com
bcrypt.
