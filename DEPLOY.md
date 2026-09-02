# Deploy do Pulso

Duas peças que sobem separadas: o backend (`/server`, Node/Express +
Postgres) e o frontend (`/web`, Vite/React estático). Este guia cobre a
stack recomendada no `CLAUDE.md` — Railway ou Render para o backend,
Vercel ou Netlify para o frontend — mas qualquer host de Node com Postgres
e qualquer host de site estático servem.

Nenhuma dessas contas/credenciais está configurada neste repositório — os
passos abaixo são para você (ou quem tiver acesso às contas de hospedagem)
executar.

## 1. Backend (`/server`)

### Opção A — Render (usa o `render.yaml` na raiz do repo)

1. No dashboard do Render, "New" → "Blueprint", aponte pro repositório.
   O `render.yaml` já provisiona o serviço web (`pulso-api`) e o Postgres
   (`pulso-db`) juntos, com `DATABASE_URL` conectado automaticamente.
2. Preencha as variáveis marcadas `sync: false` no dashboard (ver
   checklist abaixo) — o Render pede isso na hora de aplicar o blueprint.
3. Deploy. O `startCommand` (`npm start`) já roda `prisma migrate deploy`
   antes de subir o servidor — toda migration pendente é aplicada
   automaticamente a cada deploy.

### Opção B — Railway

1. "New Project" → "Deploy from GitHub repo", selecione este repositório.
2. Configure o serviço para usar `server/` como root directory (Railway
   tem esse campo nas configurações do serviço).
3. Adicione um banco Postgres ao projeto (Railway provisiona um com um
   clique) — copie a `DATABASE_URL` gerada para as variáveis do serviço
   web.
4. Build command: `npm install && npm run build`. Start command:
   `npm start`.
5. Configure as demais variáveis de ambiente (checklist abaixo).

### Checklist de variáveis de ambiente (backend)

Veja `server/.env.example` para a lista completa e comentada. As
obrigatórias:

- `DATABASE_URL` — conexão Postgres (gerada pela plataforma)
- `JWT_SECRET` — string aleatória forte (ex: `openssl rand -base64 48`)
- `NODE_ENV=production` — ativa cookie `Secure`+`SameSite=None` e `trust
  proxy` (ambos necessários rodando atrás do proxy da plataforma, com
  frontend em outro domínio)
- `CLIENT_ORIGIN` — URL exata do frontend publicado (ex:
  `https://pulso.vercel.app`), sem barra no final

Opcionais (sem elas, a funcionalidade correspondente fica com o
comportamento de desenvolvimento descrito em `server/README.md`):

- `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL` — sem isso, `/ai/*` responde 503
- `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`,
  `S3_REGION`, `S3_PUBLIC_URL_BASE` — sem isso, fotos de evolução ficam
  salvas no disco local do serviço (não sobrevive a redeploys/restarts em
  hospedagem sem disco persistente — configure isso antes de usuários
  reais subirem fotos). Cloudflare R2 é a opção recomendada no
  `CLAUDE.md`.
- `RESEND_API_KEY` + `RESEND_FROM_EMAIL` — sem isso, o código de
  recuperação de senha não é enviado de verdade (só logado no servidor)

### Depois de subir o backend

`curl https://sua-api.exemplo.com/health` deve responder `{"ok":true}`.

## 2. Frontend (`/web`)

### Opção A — Vercel

1. "Add New" → "Project", aponte pro repositório, defina `web/` como
   root directory. A Vercel detecta Vite automaticamente (build command
   `npm run build`, output `dist`) — não precisa de config extra.
2. Variável de ambiente: `VITE_API_BASE_URL` = URL pública do backend
   (ex: `https://sua-api.exemplo.com`, sem barra no final).
3. Deploy.

### Opção B — Netlify

1. "Add new site" → "Import an existing project", aponte pro
   repositório, base directory `web/`. O `web/netlify.toml` já define
   build command e publish dir.
2. Mesma variável `VITE_API_BASE_URL` no dashboard do site.
3. Deploy.

Não há rotas client-side (a navegação é só estado local em React), então
nenhum dos dois precisa de regra de rewrite para SPA.

## 3. Ligando as duas pontas

1. Pegue a URL final do frontend publicado e coloque em `CLIENT_ORIGIN`
   no backend.
2. Pegue a URL final do backend publicado e coloque em
   `VITE_API_BASE_URL` no frontend.
3. Redeploy os dois lados depois de ajustar (variável de ambiente exige
   rebuild pra entrar em efeito, tanto no Vite quanto nas plataformas
   acima).

## 4. Checklist pós-deploy

Teste manualmente, no site publicado (não em localhost):

- [ ] Criar conta nova (`/auth/signup`) — confirma que o cookie de sessão
      está sendo aceito cross-domain (é aqui que `SameSite=None` +
      `NODE_ENV=production` mal configurados quebram silenciosamente)
- [ ] Logout e login de novo
- [ ] Recarregar a página logado — sessão deve persistir
- [ ] Cadastrar uma meta/treino (testa `PUT /athlete/core`)
- [ ] Upload de uma foto de evolução (testa object storage, se
      configurado)
- [ ] Gerar algo com IA, ex. relatório diário (testa `ANTHROPIC_API_KEY`)
- [ ] "Esqueci minha senha" — confirma que o email chega de verdade (se
      `RESEND_API_KEY` configurado)

## 5. Antes de usuários externos ao Mauricio usarem o app

O `CLAUDE.md` marca isso como bloqueante: como o app coleta dado de
saúde (peso, altura, composição corporal, data de nascimento — categoria
sensível pela LGPD), é preciso ter política de privacidade e termos de
uso publicados antes de abrir para qualquer pessoa além do Mauricio.
Rascunhos estão em `docs/politica-privacidade.md` e
`docs/termos-de-uso.md` — **revisar com um advogado antes de publicar**,
eles não substituem aconselhamento jurídico real.
