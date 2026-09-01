const express = require('express');
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/requireAuth');
const { publicAccount } = require('./auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const account = await prisma.account.findUnique({ where: { id: req.accountId } });
  if (!account) {
    return res.status(404).json({ error: 'Conta não encontrada.' });
  }
  res.json({ account: publicAccount(account) });
});

module.exports = router;
