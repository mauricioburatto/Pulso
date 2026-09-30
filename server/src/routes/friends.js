const express = require('express');
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

function publicFriend(account) {
  return { id: account.id, name: account.name };
}

function otherAccount(friendship, myId) {
  return friendship.requesterId === myId ? friendship.addressee : friendship.requester;
}

// GET /friends — lista de amigos (amizades aceitas)
router.get('/', async (req, res) => {
  const rows = await prisma.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ requesterId: req.accountId }, { addresseeId: req.accountId }],
    },
    include: { requester: true, addressee: true },
  });
  res.json({ friends: rows.map((f) => publicFriend(otherAccount(f, req.accountId))) });
});

// GET /friends/requests — pedidos pendentes recebidos e enviados
router.get('/requests', async (req, res) => {
  const rows = await prisma.friendship.findMany({
    where: {
      status: 'PENDING',
      OR: [{ requesterId: req.accountId }, { addresseeId: req.accountId }],
    },
    include: { requester: true, addressee: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    received: rows
      .filter((f) => f.addresseeId === req.accountId)
      .map((f) => ({ id: f.id, from: publicFriend(f.requester), createdAt: f.createdAt })),
    sent: rows
      .filter((f) => f.requesterId === req.accountId)
      .map((f) => ({ id: f.id, to: publicFriend(f.addressee), createdAt: f.createdAt })),
  });
});

// POST /friends/requests — enviar pedido de amizade por email
router.post('/requests', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Campo "email" é obrigatório.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const target = await prisma.account.findUnique({ where: { email: normalizedEmail } });
  if (!target) {
    return res.status(404).json({ error: 'Não encontramos nenhum atleta com esse email.' });
  }
  if (target.id === req.accountId) {
    return res.status(400).json({ error: 'Você não pode adicionar a si mesmo.' });
  }

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: req.accountId, addresseeId: target.id },
        { requesterId: target.id, addresseeId: req.accountId },
      ],
    },
  });

  if (existing) {
    if (existing.status === 'ACCEPTED') {
      return res.status(409).json({ error: 'Vocês já são amigos.' });
    }
    if (existing.requesterId === req.accountId) {
      return res.status(409).json({ error: 'Pedido já enviado — aguardando resposta.' });
    }
    // O outro atleta já tinha te chamado antes — aceitar direto em vez de
    // duplicar o pedido.
    const friendship = await prisma.friendship.update({
      where: { id: existing.id },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    });
    return res.status(200).json({ friendship, autoAccepted: true });
  }

  const friendship = await prisma.friendship.create({
    data: { requesterId: req.accountId, addresseeId: target.id },
  });
  res.status(201).json({ friendship });
});

// POST /friends/requests/:id/accept
router.post('/requests/:id/accept', async (req, res) => {
  const request = await prisma.friendship.findUnique({ where: { id: req.params.id } });
  if (!request || request.status !== 'PENDING' || request.addresseeId !== req.accountId) {
    return res.status(404).json({ error: 'Pedido não encontrado.' });
  }
  const friendship = await prisma.friendship.update({
    where: { id: request.id },
    data: { status: 'ACCEPTED', respondedAt: new Date() },
  });
  res.json({ friendship });
});

// POST /friends/requests/:id/decline — também cancela um pedido enviado por mim
router.post('/requests/:id/decline', async (req, res) => {
  const request = await prisma.friendship.findUnique({ where: { id: req.params.id } });
  const isParty = request && (request.addresseeId === req.accountId || request.requesterId === req.accountId);
  if (!request || request.status !== 'PENDING' || !isParty) {
    return res.status(404).json({ error: 'Pedido não encontrado.' });
  }
  await prisma.friendship.delete({ where: { id: request.id } });
  res.status(204).end();
});

// DELETE /friends/:friendId — desfazer amizade
router.delete('/:friendId', async (req, res) => {
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: req.accountId, addresseeId: req.params.friendId },
        { requesterId: req.params.friendId, addresseeId: req.accountId },
      ],
    },
  });
  if (!friendship) {
    return res.status(404).json({ error: 'Amizade não encontrada.' });
  }
  await prisma.friendship.delete({ where: { id: friendship.id } });
  res.status(204).end();
});

// PATCH /friends/settings — opt-in de compartilhar evolução física com amigos
router.patch('/settings', async (req, res) => {
  const { shareBodyEvolution } = req.body;
  if (typeof shareBodyEvolution !== 'boolean') {
    return res.status(400).json({ error: 'Campo "shareBodyEvolution" deve ser um booleano.' });
  }
  await prisma.account.update({ where: { id: req.accountId }, data: { shareBodyEvolution } });
  res.json({ shareBodyEvolution });
});

// GET /friends/feed — treinos recentes dos amigos, e evolução física só de
// quem ativou o compartilhamento (opt-in, por padrão fica privado).
router.get('/feed', async (req, res) => {
  const rows = await prisma.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ requesterId: req.accountId }, { addresseeId: req.accountId }],
    },
    include: { requester: true, addressee: true },
  });
  const friends = rows.map((f) => otherAccount(f, req.accountId));

  if (friends.length === 0) {
    return res.json({ feed: [] });
  }

  const cores = await prisma.athleteCore.findMany({
    where: { athleteId: { in: friends.map((f) => f.id) } },
  });
  const coreByAthlete = new Map(cores.map((c) => [c.athleteId, c.data]));

  const items = [];
  for (const friend of friends) {
    const core = coreByAthlete.get(friend.id);
    if (!core) continue;

    const trainings = Array.isArray(core.trainings) ? core.trainings : [];
    for (const t of trainings.slice(0, 10)) {
      items.push({
        type: 'training',
        date: t.date,
        friend: publicFriend(friend),
        training: { type: t.type, duration: t.duration, distance: t.distance, effort: t.effort },
      });
    }

    if (friend.shareBodyEvolution) {
      const assessments = Array.isArray(core.bodyAssessments) ? core.bodyAssessments : [];
      const latest = [...assessments].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      if (latest) {
        items.push({
          type: 'body_evolution',
          date: latest.date,
          friend: publicFriend(friend),
          assessment: { weight: latest.weight, fatPercent: latest.fatPercent },
        });
      }
    }
  }

  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({ feed: items.slice(0, 40) });
});

module.exports = router;
