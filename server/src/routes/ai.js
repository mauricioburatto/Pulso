const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/requireAuth');
const { callClaude, configured } = require('../ai/claude');
const { extractJsonArray, extractJsonObject } = require('../ai/jsonExtract');
const { daysUntil, calcAge } = require('../ai/dateUtils');

const router = express.Router();

router.use(requireAuth);

// Limite por conta, para não deixar o custo de IA descontrolado.
router.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.accountId,
  })
);

router.use((req, res, next) => {
  if (!configured) {
    return res.status(503).json({ error: 'IA não configurada no servidor (ANTHROPIC_API_KEY ausente).' });
  }
  next();
});

function asyncRoute(handler) {
  return (req, res, next) => {
    handler(req, res).catch((err) => {
      const status = err.status || (err.message && err.message.includes('JSON') ? 502 : 500);
      console.error(err);
      res.status(status).json({ error: err.message || 'Erro ao processar solicitação de IA.' });
    });
  };
}

/* ============================================================
   1. Leitura de print do relógio/app de treino (imagem → dados)
============================================================= */
router.post(
  '/ler-print-treino',
  asyncRoute(async (req, res) => {
    const { imageBase64, mediaType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Campo "imageBase64" é obrigatório.' });
    }

    const system = `Você lê capturas de tela de relógios esportivos e apps de treino (Garmin, Apple Watch/Saúde, Strava, Polar etc.) e extrai os dados do treino. Responda APENAS com um objeto JSON válido, sem texto antes ou depois, sem markdown, no formato: {"type":"Corrida|Ciclismo|Natação|Força|Outro","date":"YYYY-MM-DD ou null se não visível","duration":"minutos como número ou null","distance":"km como número ou null","pace":"string tipo 5'20\\"/km ou null","hrAvg":"número ou null","hrMax":"número ou null","calories":"número ou null","notes":"qualquer outra info relevante visível, curto"}. Se a data não estiver visível na imagem, use null. Nunca invente números que não estão na imagem.`;

    const { text } = await callClaude({
      system,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: 'Extraia os dados do treino desta imagem.' },
          ],
        },
      ],
      maxTokens: 1000,
    });

    res.json({ data: extractJsonObject(text) });
  })
);

/* ============================================================
   2. Interpretação de descrição em texto do treino
============================================================= */
router.post(
  '/interpretar-treino-texto',
  asyncRoute(async (req, res) => {
    const { description } = req.body;
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Campo "description" é obrigatório.' });
    }

    const system = `Você lê a descrição em texto que um atleta escreveu contando como foi o treino dele, e extrai os dados estruturados a partir disso. Responda APENAS com um objeto JSON válido, sem texto antes ou depois, sem markdown, no formato: {"type":"Corrida|Ciclismo|Natação|Crossfit|Força|Luta / combate|Recuperação|Outro","date":"YYYY-MM-DD se mencionado, ou null","duration":"minutos como número, estimando se necessário, ou null","distance":"km como número, ou null","pace":"string tipo 5'20\\"/km, ou null","hrAvg":"número se mencionado, ou null","hrMax":"número se mencionado, ou null","calories":"número se mencionado, ou null","notes":"um resumo curto de sensações/observações relevantes do texto"}. Não invente números que não foram ditos nem sugeridos pelo texto — nesses casos use null.`;

    const { text } = await callClaude({
      system,
      messages: [{ role: 'user', content: `Descrição do treino: ${description.trim()}` }],
      maxTokens: 1000,
    });

    res.json({ data: extractJsonObject(text) });
  })
);

/* ============================================================
   3. Geração de planilha de treino
============================================================= */
router.post(
  '/gerar-planilha',
  asyncRoute(async (req, res) => {
    const { profile, focusModality, others, nextGoal, latestAssessment, preferences, recentTrainings, weeks, toGoal } =
      req.body;

    if (!profile || !focusModality || !focusModality.name) {
      return res.status(400).json({ error: 'Campos "profile" e "focusModality" são obrigatórios.' });
    }

    const othersList = others || [];
    const recent = recentTrainings || [];

    const weeksToGoal = toGoal && nextGoal ? Math.max(1, Math.ceil(daysUntil(nextGoal.targetDate) / 7)) : null;
    const cappedWeeks = weeksToGoal ? Math.min(weeksToGoal, 2) : Math.min(weeks || 2, 2);
    const isCapped = weeksToGoal && weeksToGoal > cappedWeeks;

    const system = `Você é um treinador esportivo. Gere uma planilha de treinos com foco em uma modalidade principal, considerando também outras modalidades que o atleta já pratica em paralelo (para não sobrecarregar, sem duplicar o trabalho delas). Respeite fielmente qualquer preferência ou restrição que o atleta informar (ex: "não fazer treino de tiro" significa nunca incluir esse tipo de sessão). Responda APENAS com um array JSON compacto, sem texto antes ou depois, sem markdown, sem espaços desnecessários. Cada item: {"date":"YYYY-MM-DD","modality":"nome curto da modalidade deste treino (uma das informadas, ou 'Descanso')","title":"até 4 palavras","description":"até 8 palavras, telegráfico, sem frase completa","intensity":"leve|moderado|alto"}. Pode haver mais de um item na mesma data se fizer sentido (ex: foco + outra modalidade leve), ou um único item "Descanso". Seja extremamente econômico em texto — isso é crítico, a resposta tem limite curto de tamanho.`;

    const userMsg = `Atleta: ${profile.name}, nível ${profile.level}.
Foco desta planilha: ${focusModality.name} (${focusModality.frequency}).${
      nextGoal ? ` Prova/meta relacionada (use se fizer sentido para esta modalidade): ${nextGoal.title} em ${nextGoal.targetDate}${nextGoal.targetMetric ? `, alvo ${nextGoal.targetMetric}` : ''}.` : ''
    }
${othersList.length ? `Também pratica em paralelo: ${othersList.map((m) => `${m.name} (${m.frequency})`).join(', ')}.` : 'Sem outras modalidades cadastradas.'}
${latestAssessment ? `Avaliação do treino atual do atleta (mais confiável que o nível autodeclarado): nível real ${latestAssessment.estimatedLevel}, dificuldade: ${latestAssessment.difficultySummary || '—'}. Lacunas a corrigir: ${latestAssessment.gaps || 'nenhuma relatada'}. Calibre a intensidade e complexidade da planilha por este nível real, não pelo autodeclarado.` : ''}
${preferences && preferences.trim() ? `Preferências/restrições do atleta para esta planilha: ${preferences.trim()}.` : ''}
${recent.length ? `Treinos recentes: ${JSON.stringify(recent)}` : ''}
Gere ${cappedWeeks} semana(s) a partir de ${new Date().toISOString().slice(0, 10)}.${
      toGoal && nextGoal
        ? isCapped
          ? ` A prova é daqui a ${weeksToGoal} semanas — gere estas ${cappedWeeks} adequadas à fase atual da periodização (o atleta gera as próximas mais perto da data).`
          : ` A prova cai dentro deste período — inclua tapering nos últimos dias.`
        : ''
    }`;

    const { text, truncated } = await callClaude({
      system,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 1000,
    });

    const parsed = extractJsonArray(text);
    const plannedWorkouts = parsed.map((w) => ({
      id: 'pw_' + crypto.randomUUID(),
      date: w.date,
      modality: w.modality || focusModality.name,
      title: w.title || w.modality || focusModality.name,
      type: w.modality || focusModality.name,
      description: w.description || '',
      intensity: w.intensity || 'moderado',
    }));

    res.json({ plannedWorkouts, truncated });
  })
);

/* ============================================================
   Detalhamento de uma sessão de treino específica (planilha)
============================================================= */
router.post(
  '/detalhar-sessao',
  asyncRoute(async (req, res) => {
    const { item, profile, nextGoal } = req.body;
    if (!item || !profile) {
      return res.status(400).json({ error: 'Campos "item" e "profile" são obrigatórios.' });
    }

    const system = `Você é treinador esportivo. Detalhe uma sessão de treino específica no padrão de planilha profissional de atleta, em português do Brasil. Responda APENAS com um objeto JSON compacto, sem texto antes ou depois, sem markdown. Formato: {"warmup":"aquecimento detalhado, direto","main":"treino principal detalhado — séries, repetições, tempos, distâncias e/ou pace conforme a modalidade","cooldown":"volta à calma e alongamento, direto","estimatedDuration":"tempo total estimado, ex: 45-55 min","pace":"ritmo alvo em min/km ou min/100m se for corrida, ciclismo ou natação, ex: 5:30-5:50 min/km — null se não se aplicar a esta modalidade","targetZone":"zona de frequência cardíaca ou RPE alvo, ex: Zona 2 (65-75% FCmáx) — null se não pertinente","notes":"uma dica prática curta, ou null"}. Seja específico e objetivo, sem frases de efeito.`;

    const userMsg = `Modalidade: ${item.modality || item.type}. Sessão: ${item.title}. Resumo: ${item.description}. Intensidade: ${item.intensity || 'moderado'}. Nível do atleta: ${profile.level}.${
      nextGoal && nextGoal.targetMetric ? ` Meta de referência do atleta: ${nextGoal.targetMetric}.` : ''
    }`;

    const { text } = await callClaude({
      system,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 1000,
    });

    res.json({ detail: extractJsonObject(text) });
  })
);

/* ============================================================
   8. Avaliação de nível a partir do treino atual (texto/imagem/PDF)
============================================================= */
router.post(
  '/avaliacao-treino-atual',
  asyncRoute(async (req, res) => {
    const { description, profile, fileKind, imageBase64, pdfBase64 } = req.body;
    const hasFile = fileKind === 'image' ? !!imageBase64 : fileKind === 'pdf' ? !!pdfBase64 : false;

    if ((!description || !description.trim()) && !hasFile) {
      return res.status(400).json({ error: 'Descreva o treino atual em texto e/ou anexe uma foto/PDF dele.' });
    }
    if (!profile) {
      return res.status(400).json({ error: 'Campo "profile" é obrigatório.' });
    }

    const system = `Você é um treinador esportivo experiente e multi-modalidade. O atleta vai te mostrar o treino que ele já está fazendo atualmente — pode ser de qualquer modalidade (musculação, corrida, crossfit, luta, esportes de quadra, etc), descrito em texto e/ou em uma foto/print/PDF de uma planilha, app ou papel. Sua tarefa é analisar esse conteúdo e estimar o nível e a dificuldade real do treino, independente do que a modalidade "de nome" sugere. Responda APENAS com um objeto JSON compacto, sem texto antes ou depois, sem markdown, no formato: {"estimatedLevel":"Iniciante|Intermediário|Avançado","difficultySummary":"1-2 frases descrevendo o grau de dificuldade real (volume, intensidade, complexidade técnica)","strengths":"1-2 frases sobre pontos fortes do treino atual","gaps":"1-2 frases sobre lacunas, riscos ou desequilíbrios que você percebe (ex: falta de mobilidade, volume desbalanceado, ausência de descanso)","recommendation":"1-2 frases de recomendação prática de próximo passo"}. Seja específico com base no que foi mostrado, não genérico.`;

    const contentBlocks = [];
    if (description && description.trim()) {
      contentBlocks.push({ type: 'text', text: `Descrição do atleta sobre o treino atual: ${description.trim()}` });
    } else {
      contentBlocks.push({ type: 'text', text: 'O atleta não escreveu descrição, apenas anexou o arquivo abaixo com o treino atual.' });
    }
    contentBlocks.push({
      type: 'text',
      text: `Contexto do atleta: ${profile.name}, nível autodeclarado ${profile.level}, modalidade principal ${profile.modality}.`,
    });

    if (hasFile) {
      if (fileKind === 'pdf') {
        contentBlocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } });
      } else {
        contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } });
      }
    }

    const { text } = await callClaude({
      system,
      messages: [{ role: 'user', content: contentBlocks }],
      maxTokens: 1000,
    });

    res.json({ assessment: extractJsonObject(text) });
  })
);

/* ============================================================
   7. Avaliação de composição corporal por fotos
============================================================= */
router.post(
  '/avaliacao-corporal',
  asyncRoute(async (req, res) => {
    const { profile, frontImageBase64, sideImageBase64 } = req.body;
    if (!frontImageBase64 || !sideImageBase64) {
      return res.status(400).json({ error: 'Envie as duas fotos (frente e lado) em base64.' });
    }
    if (!profile) {
      return res.status(400).json({ error: 'Campo "profile" é obrigatório.' });
    }

    const age = calcAge(profile.birthDate);

    const system = `Você é um avaliador físico auxiliando uma leitura visual de composição corporal a partir de duas fotos (frente e lado direito), seguindo o protocolo padrão de aferição por bioimpedância visual. Use idade, sexo, peso e altura informados para calibrar a estimativa das medidas. Responda APENAS com um objeto JSON compacto, sem texto antes ou depois, sem markdown, no formato: {"fatPercent":número estimado de percentual de gordura (ex: 23.5),"waist":circunferência de cintura estimada em cm,"hip":circunferência de quadril estimada em cm,"arm":circunferência de braço em cm,"forearm":circunferência de antebraço em cm,"thigh":circunferência de coxa em cm,"calf":circunferência de panturrilha em cm,"muscleNote":"observação curta sobre massa muscular aparente","postureNote":"observação curta sobre postura/simetria, ou null","protocolIssues":"se as fotos não seguiram bem o protocolo (roupa larga, ângulo, iluminação, pose incorreta), descreva aqui objetivamente; caso contrário null"}. Todos os valores numéricos devem ser números, não strings.`;

    const userMsg = `Atleta: ${profile.name}, ${age ? `${age} anos` : 'idade não informada'}, sexo ${profile.sex || 'não informado'}, peso ${profile.weight || '?'}kg, altura ${profile.height || '?'}m, modalidade ${profile.modality}, nível ${profile.level}.`;

    const { text } = await callClaude({
      system,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: userMsg },
            { type: 'text', text: 'Foto de frente:' },
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: frontImageBase64 } },
            { type: 'text', text: 'Foto de lado (direito):' },
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: sideImageBase64 } },
          ],
        },
      ],
      maxTokens: 1000,
    });

    res.json({ assessment: extractJsonObject(text), ageAtAssessment: age });
  })
);

/* ============================================================
   9. Geração de dieta
============================================================= */
router.post(
  '/gerar-dieta',
  asyncRoute(async (req, res) => {
    const { profile, diet, questionnaire } = req.body;
    if (!profile) {
      return res.status(400).json({ error: 'Campo "profile" é obrigatório.' });
    }

    const d = diet || {};
    const q = questionnaire || {};

    const system = `Você é nutricionista esportivo. Monte um dia alimentar completo (café da manhã, almoço, lanche da tarde, jantar, e ceia se fizer sentido) usando alimentos comuns do dia a dia brasileiro, com nomes de alimentos SIMPLES e genéricos no padrão da tabela TACO (ex: "Arroz, tipo 1, cozido", "Frango, peito, sem pele, grelhado", "Banana, prata", "Ovo, de galinha, inteiro, cozido", "Feijão, carioca, cozido", "Batata-doce, cozida", "Pão, francês"). Respeite as metas diárias de calorias e macros informadas, se houver. Respeite rigorosamente a rotina, os horários, o que o atleta gosta e não gosta de comer, e as preferências de paladar informadas — nunca inclua algo que ele disse que não come. Considere a suplementação em uso ao montar o plano (não duplique nutrientes já cobertos por suplementos informados). Responda APENAS com um array JSON compacto, sem texto antes ou depois, sem markdown, no formato: [{"meal":"Café da manhã","time":"07:00","items":[{"food":"Pão, francês","grams":50}]}]. Use gramas realistas.`;

    const questionnaireLines = [
      q.rotina && q.rotina.trim() ? `Rotina diária: ${q.rotina.trim()}` : '',
      q.alimentacaoAtual && q.alimentacaoAtual.trim() ? `Alimentação atual: ${q.alimentacaoAtual.trim()}` : '',
      q.gosta && q.gosta.trim() ? `Gosta de comer: ${q.gosta.trim()}` : '',
      q.naoGosta && q.naoGosta.trim() ? `Não gosta / não come: ${q.naoGosta.trim()}` : '',
      q.paladar && q.paladar.trim() ? `Paladar/preferências: ${q.paladar.trim()}` : '',
      q.suplementos && q.suplementos.trim() ? `Suplementação em uso: ${q.suplementos.trim()}` : '',
      q.observacoes && q.observacoes.trim() ? `Considerações adicionais do atleta: ${q.observacoes.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const userMsg = `Atleta: ${profile.name}, ${profile.sex || 'sexo não informado'}, peso ${profile.weight || '?'}kg, altura ${profile.height || '?'}m, modalidade ${profile.modality}, nível ${profile.level}.
${d.targetKcal ? `Meta diária: ${d.targetKcal}kcal, proteína ${d.targetProtein}g, carboidrato ${d.targetCarb}g, gordura ${d.targetFat}g.` : 'Sem meta de macros definida — monte algo equilibrado para um atleta desse perfil.'}
${questionnaireLines ? `Informações do atleta sobre hábitos e preferências (respeite rigorosamente, principalmente o que ele não gosta/não come):\n${questionnaireLines}` : 'Sem informações adicionais de rotina/preferências — monte algo genérico e equilibrado.'}`;

    const { text } = await callClaude({ system, messages: [{ role: 'user', content: userMsg }], maxTokens: 1000 });

    res.json({ meals: extractJsonArray(text) });
  })
);

/* ============================================================
   6. Sugestão de suplementação
============================================================= */
router.post(
  '/sugestao-suplementacao',
  asyncRoute(async (req, res) => {
    const { profile, nextGoal } = req.body;
    if (!profile) {
      return res.status(400).json({ error: 'Campo "profile" é obrigatório.' });
    }

    const system = `Você é nutricionista esportivo. Sugira suplementação esportiva de uso comum e legal (nada de substâncias controladas) para um atleta, organizada em duas partes com rótulos simples "Preparação:" e "Dia da prova:". Em "Preparação", cubra as semanas antes da prova (ex: hidratação, carboidrato, eletrólitos, ferro/vitamina D se pertinente ao contexto, cafeína em treinos-chave). Em "Dia da prova", cubra antes, durante e depois (ex: refeição pré-prova, carboidrato/gel durante, reposição de eletrólitos, recuperação pós-prova). Escreva em português do Brasil, texto corrido direto, sem markdown pesado, no máximo 4 parágrafos curtos no total. Finalize com uma frase deixando claro que as doses devem ser individualizadas por um nutricionista, considerando o histórico e exames do atleta.`;

    const userMsg = `Atleta: ${profile.name}, modalidade ${profile.modality}, nível ${profile.level}.
Prova/meta: ${nextGoal ? `${nextGoal.title} em ${nextGoal.targetDate}, tipo: ${nextGoal.competitionType || '—'}, alvo: ${nextGoal.targetMetric || 'não especificado'}` : 'nenhuma prova cadastrada — sugerir suplementação geral de preparação e de dia de treino/competição típica da modalidade'}`;

    const { text } = await callClaude({
      system,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 1000,
    });

    res.json({ content: text });
  })
);

/* ============================================================
   4. Análise de evolução do atleta
============================================================= */
router.post(
  '/analise-evolucao',
  asyncRoute(async (req, res) => {
    const { profile, nextGoal, recentTrainings } = req.body;
    if (!profile) {
      return res.status(400).json({ error: 'Campo "profile" é obrigatório.' });
    }

    const recent = recentTrainings || [];

    const system = `Você é um treinador esportivo experiente analisando o retrospecto de treino de um atleta. Escreva em português do Brasil, em texto corrido (sem markdown, sem títulos numerados), direto e objetivo, em 3 a 5 parágrafos curtos. Avalie se o atleta está evoluindo, estagnado ou regredindo, apontando com base em quais dados (volume, intensidade, consistência, frequência) chegou a essa conclusão. Se os dados forem insuficientes para alguma conclusão, diga isso claramente em vez de inventar. Termine com 1-2 recomendações práticas.`;

    const userMsg = `Atleta: ${profile.name}, modalidade ${profile.modality}, nível ${profile.level}.
Meta atual: ${nextGoal ? `${nextGoal.title} em ${nextGoal.targetDate}` : 'nenhuma cadastrada'}.
Histórico de treinos (mais recente primeiro): ${JSON.stringify(recent)}`;

    const { text } = await callClaude({
      system,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 1000,
    });

    res.json({ content: text });
  })
);

/* ============================================================
   5. Geração de relatório diário/semanal
============================================================= */
router.post(
  '/relatorio',
  asyncRoute(async (req, res) => {
    const { kind, profile, trainings, supplementNames } = req.body;
    if (kind !== 'daily' && kind !== 'weekly') {
      return res.status(400).json({ error: 'Campo "kind" deve ser "daily" ou "weekly".' });
    }
    if (!profile) {
      return res.status(400).json({ error: 'Campo "profile" é obrigatório.' });
    }

    const windowDays = kind === 'daily' ? 1 : 7;

    const system = `Você escreve relatórios curtos de treino para um atleta, em português do Brasil, texto corrido sem markdown, tom direto e motivador mas honesto (sem exagero). Relatório ${kind === 'daily' ? 'diário' : 'semanal'}: resuma o que foi feito, destaque pontos positivos e pontos de atenção, e feche com uma frase objetiva sobre o próximo passo. Máximo 2 parágrafos curtos.`;

    const userMsg = `Atleta: ${profile.name}, ${profile.modality}, nível ${profile.level}.
Período: últimos ${windowDays} dia(s).
Treinos no período: ${JSON.stringify(trainings || [])}
Suplementação programada: ${JSON.stringify(supplementNames || [])}`;

    const { text } = await callClaude({
      system,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 1000,
    });

    res.json({ content: text });
  })
);

module.exports = router;
