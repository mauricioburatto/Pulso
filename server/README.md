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

### Fase 3 — recuperação de senha

- `POST /auth/forgot-password` — gera um código de 6 dígitos (10 min de
  validade) e envia por email. Resposta idêntica exista ou não a conta,
  para não revelar quais emails estão cadastrados.
- `POST /auth/reset-password` — valida o código e troca a senha
  (`{ "email", "code", "newPassword" }`)

O código é armazenado com hash (sha256) na tabela
`password_reset_tokens`; um novo pedido invalida qualquer código anterior
não usado da mesma conta.

### Fase 4 — proxy de IA

Um endpoint por funcionalidade de IA do protótipo (`PerformanceApp.jsx`),
reaproveitando os mesmos system prompts, exatamente como estão — só a
`ANTHROPIC_API_KEY` migrou do navegador para o servidor:

- `POST /ai/ler-print-treino` — imagem (print de relógio/app) → dados do treino
- `POST /ai/interpretar-treino-texto` — descrição em texto → dados do treino
- `POST /ai/gerar-planilha` — gera a planilha de treino (considera modalidades, meta, avaliação de nível)
- `POST /ai/detalhar-sessao` — detalha uma sessão específica da planilha
- `POST /ai/avaliacao-treino-atual` — texto e/ou imagem/PDF → nível e dificuldade real do treino atual
- `POST /ai/avaliacao-corporal` — duas fotos (frente/lado) → composição corporal estimada
- `POST /ai/gerar-dieta` — gera um dia alimentar (o casamento com a base TACO continua no frontend)
- `POST /ai/sugestao-suplementacao` — texto de suplementação (preparação + dia da prova)
- `POST /ai/analise-evolucao` — retrospecto de evolução a partir do histórico de treinos
- `POST /ai/relatorio` — relatório diário ou semanal (`{ "kind": "daily"|"weekly" }`)

Todas protegidas por sessão e com rate limit de 30 requisições/15min por
conta. Sem `ANTHROPIC_API_KEY` configurada, todas respondem `503`. O
modelo usado é `claude-sonnet-4-6` (o mesmo já testado no protótipo);
pode ser trocado via `ANTHROPIC_MODEL` sem alterar código.

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

## Envio de email

Por padrão (sem `RESEND_API_KEY` configurado), o email de recuperação de
senha é apenas gravado em `server/dev-emails/` — só para desenvolvimento,
sem enviar nada de verdade. Para produção, configure `RESEND_API_KEY` e
`RESEND_FROM_EMAIL` no `.env` (conta no [Resend](https://resend.com)).
