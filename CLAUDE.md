# Pulso — Contexto do projeto para o Claude Code

Este arquivo é lido automaticamente pelo Claude Code sempre que ele trabalha neste
repositório. Ele explica o que o Pulso é, o estado atual do código, e o plano
técnico para transformar o protótipo em um produto com backend real.

## O que é o Pulso

App de performance esportiva para nutricionistas/personal trainers acompanharem
atletas: treinos, avaliação de composição corporal por IA (fotos), nutrição
(base TACO embutida), suplementação, metas/provas e relatórios.

Identidade visual: fundo azul-marinho escuro, acentos em vermelho/dourado/azul,
tipografia Bebas Neue (números grandes) + Inter (corpo) + JetBrains Mono (dados).

## Estado atual (protótipo client-side)

- `PerformanceApp.jsx` — o app React completo, pensado para rodar como Claude
  Artifact dentro do Claude.ai. Usa `window.storage` (API de persistência do
  Claude.ai) e chama a API da Anthropic direto do navegador.
- `Pulso.html` / `Pulso-mobile.html` — versões standalone (React + Babel via
  CDN, sem build step) para rodar fora do Claude.ai. Nelas, `window.storage` é
  substituído por um shim que usa `localStorage`, e a IA é desativada (lança
  erro explicando que só funciona dentro do Claude.ai) porque não há proxy
  seguro de API key fora daquele ambiente.

**Tudo hoje é 100% client-side.** Não existe backend, banco de dados, nem
autenticação real. Isso é a limitação estrutural que este plano resolve.

### Modelo de dados atual (por atleta)

Cada conta (`account`) tem: `id, name, email, passwordHash (hash simples, NÃO
seguro), modality, level, weight, height, trainingTime, birthDate, sex,
createdAt`.

Cada atleta tem um objeto `core` (hoje guardado como um único JSON em
`window.storage`/`localStorage`):

```
core = {
  goals: [],              // metas e provas
  trainings: [],          // histórico de treinos realizados
  plannedWorkouts: [],    // planilha gerada por IA
  modalities: [],         // modalidades praticadas + frequência
  supplements: [],        // suplementos com horário
  supplementSuggestions: [], // sugestões geradas por IA
  reports: [],            // relatórios diário/semanal gerados por IA
  analyses: [],           // análises de evolução geradas por IA
  bodyAssessments: [],    // avaliações de composição corporal por foto
  trainingAssessments: [],// avaliação de nível a partir de treino atual
  diet: { targetKcal, targetProtein, targetCarb, targetFat, meals: [], questionnaire: {} },
}
```

Fotos de evolução ficam numa chave separada por atleta (`athlete:{id}:photos`).

### Chamadas de IA existentes (todas usam `model: "claude-sonnet-4-6"`, vision
quando aplicável)

Cada uma tem um `system prompt` já testado e funcional dentro do `.jsx` — ao
migrar para o backend, **reaproveitar esses prompts como estão**, só trocando
de onde a chamada é feita:

1. Leitura de print do relógio/app de treino (imagem → dados estruturados)
2. Interpretação de descrição em texto do treino (texto → dados estruturados)
3. Geração de planilha de treino (considera modalidades, preferências, nível
   real detectado, meta/prova)
4. Análise de evolução do atleta (histórico → texto)
5. Geração de relatório diário/semanal (texto)
6. Sugestão de suplementação (texto)
7. Avaliação de composição corporal por fotos (2 imagens → dados numéricos)
8. Avaliação de nível a partir de treino atual (texto e/ou imagem/PDF → dados)
9. Geração de dieta (texto → lista de refeições, casada com a base TACO local)

## Objetivo deste plano

Migrar de "tudo no navegador" para uma arquitetura cliente + servidor, **sem
reescrever a lógica de negócio e os prompts que já funcionam** — só mudar
*onde* eles rodam.

## Stack recomendada

- **Backend**: Node.js + Express (ou Fastify) — mesma linguagem do frontend,
  menor curva de aprendizado pra continuar com Claude Code.
- **Banco de dados**: PostgreSQL. Usar Prisma como ORM (schema declarativo,
  migrations automáticas, boa integração com TypeScript se decidirmos migrar
  pra TS depois).
- **Autenticação**: sessão via cookie httpOnly + JWT, ou biblioteca tipo
  `lucia-auth`/`better-auth`. Senha com **bcrypt** (nunca o hash atual, que é
  só ofuscação, não segurança real).
- **IA**: Anthropic SDK oficial (`@anthropic-ai/sdk`) rodando **só no
  servidor**. A `ANTHROPIC_API_KEY` nunca deve chegar ao navegador.
- **Armazenamento de imagens** (fotos de evolução, prints, fotos de avaliação
  corporal): serviço de object storage compatível com S3 (Cloudflare R2 é
  mais barato que S3 puro). Parar de guardar imagens como base64 dentro do
  JSON do banco.
- **Email** (recuperação de senha real): Resend ou Amazon SES.
- **Hospedagem**: Railway ou Render pra backend+banco (mais simples que AWS
  pra começar); Vercel ou Netlify pro frontend se ele virar uma build de
  verdade (Vite) em vez do HTML solto atual.

## Plano em fases (cada fase deve ser um conjunto de commits pequenos e
testáveis, não uma reescrita gigante de uma vez)

### Fase 1 — Fundação do backend
- Inicializar projeto Node/Express separado (pasta `/server`)
- Configurar Postgres + Prisma
- Schema inicial: tabela `accounts` (id, name, email, password_hash, modality,
  level, weight, height, training_time, birth_date, sex, created_at) e tabela
  `athlete_core` (athlete_id, data JSONB, updated_at) — **guardar o `core`
  inteiro como JSONB por enquanto** é a forma mais rápida de migrar sem
  quebrar nada; normalizar em tabelas separadas (goals, trainings, etc.) só
  depois, se a necessidade de queries complexas justificar.
- Endpoints: `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`,
  `GET /me`
- Middleware de sessão protegendo rotas autenticadas

### Fase 2 — Dados do atleta
- `GET /athlete/core`, `PUT /athlete/core` (substitui o `window.storage`
  atual — o frontend passa a chamar essas rotas em vez de `localStorage`)
- `GET /athlete/photos`, `POST /athlete/photos`, `DELETE
  /athlete/photos/:id` — com upload real pro object storage, não mais base64
  no payload

### Fase 3 — Recuperação de senha real
- `POST /auth/forgot-password` gera código, envia por email de verdade
  (Resend/SES), guarda o código com expiração (ex: 10 minutos) numa tabela
  `password_reset_tokens`
- `POST /auth/reset-password` valida o código e troca a senha

### Fase 4 — Proxy de IA (a parte que mais importa)
- Um endpoint por funcionalidade de IA (ex: `POST /ai/sincronia-imagem`,
  `POST /ai/gerar-planilha`, `POST /ai/avaliacao-corporal`, etc.), cada um
  recebendo do frontend só os dados necessários (não a API key) e devolvendo
  o resultado já processado
- **Reutilizar os system prompts exatamente como estão** no `.jsx` atual —
  eles já foram testados e ajustados nesta conversa
- Rate limiting por conta (evitar custo descontrolado de API)

### Fase 5 — Frontend real
- Migrar `PerformanceApp.jsx` de "artifact standalone" pra um projeto Vite
  de verdade, com as chamadas de IA e storage apontando pro backend em vez
  de `window.storage`/`callClaude` locais
- Manter o design system (tokens de cor, componentes) exatamente como está —
  já foi refinado várias vezes nesta conversa, não precisa mexer

### Fase 6 — Deploy e produto
- Variáveis de ambiente (`ANTHROPIC_API_KEY`, `DATABASE_URL`,
  `RESEND_API_KEY`, etc.) configuradas no serviço de hospedagem, nunca
  commitadas no repositório
- Política de privacidade + termos de uso antes de qualquer usuário externo
  ao Mauricio usar o app (dados de saúde = LGPD categoria sensível)

## Regras gerais para o Claude Code seguir neste repositório

- Nunca commitar chaves de API, senhas ou segredos — sempre usar `.env`
  (adicionar `.env` ao `.gitignore` desde o primeiro commit do backend)
- Fazer commits pequenos e descritivos por funcionalidade, não um commit
  gigante por fase
- Preservar o design visual e os prompts de IA existentes — a mudança aqui é
  de arquitetura (onde o código roda), não de produto
- Perguntar antes de apagar ou reescrever os arquivos `Pulso.html` /
  `Pulso-mobile.html` — eles continuam úteis como demo standalone mesmo depois
  do backend existir
