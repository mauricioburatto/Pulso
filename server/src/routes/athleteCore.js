const express = require('express');
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const athleteCore = await prisma.athleteCore.findUnique({
    where: { athleteId: req.accountId },
  });
  if (!athleteCore) {
    return res.status(404).json({ error: 'Dados do atleta não encontrados.' });
  }
  res.json({ core: athleteCore.data });
});

router.put('/', requireAuth, async (req, res) => {
  const { core } = req.body;
  if (!core || typeof core !== 'object' || Array.isArray(core)) {
    return res.status(400).json({ error: 'Campo "core" é obrigatório e deve ser um objeto.' });
  }

  const athleteCore = await prisma.athleteCore.upsert({
    where: { athleteId: req.accountId },
    update: { data: core },
    create: { athleteId: req.accountId, data: core },
  });

  res.json({ core: athleteCore.data });
});

module.exports = router;
