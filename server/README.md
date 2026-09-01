# Pulso API

Backend Node/Express + Prisma/PostgreSQL do Pulso.

## Setup

```bash
cp .env.example .env   # preencha DATABASE_URL e JWT_SECRET
npm install
npm run prisma:migrate
npm run dev
```

## Endpoints

### Fase 1 — autenticação

- `POST /auth/signup` — cria conta + `athlete_core` inicial, abre sessão
- `POST /auth/login` — abre sessão
- `POST /auth/logout` — encerra sessão
- `GET /me` — retorna a conta autenticada (rota protegida)

Sessão via cookie httpOnly (`pulso_session`) contendo um JWT. Senhas com
bcrypt.

### Fase 2 — dados do atleta

- `GET /athlete/core` — retorna o JSON `core` do atleta autenticado
- `PUT /athlete/core` — substitui o JSON `core` (`{ "core": {...} }`)
- `GET /athlete/photos` — lista fotos de evolução (metadados + URL)
- `POST /athlete/photos` — upload de foto (`multipart/form-data`: `photo`
  arquivo, `date`, `notes` opcional)
- `DELETE /athlete/photos/:id` — remove a foto (storage + banco)

Todas protegidas por sessão; cada conta só enxerga seus próprios dados.

## Armazenamento de imagens

Por padrão (sem `S3_BUCKET` configurado), as fotos são salvas em disco em
`server/uploads/` e servidas em `/uploads/...` — só para desenvolvimento
local, sem custo de nuvem.

Para produção, configure um bucket S3-compatível (ex: Cloudflare R2) via
`.env`:

```
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT=...              # endpoint do R2/S3
S3_REGION=auto                # "auto" no R2
S3_PUBLIC_URL_BASE=https://...  # domínio público do bucket
```

Quando `S3_BUCKET` está definido, o app passa a gravar direto no bucket
em vez do disco local — nenhuma mudança de código é necessária.
