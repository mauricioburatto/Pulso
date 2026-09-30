const express = require('express');
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/requireAuth');
const { publicAccount, USERNAME_PATTERN, SESSION_COOKIE_OPTIONS } = require('./auth');
const { SESSION_COOKIE } = require('../middleware/requireAuth');
const storage = require('../storage');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const account = await prisma.account.findUnique({ where: { id: req.accountId } });
  if (!account) {
    return res.status(404).json({ error: 'Conta não encontrada.' });
  }
  res.json({ account: publicAccount(account) });
});

router.patch('/', requireAuth, async (req, res) => {
  const { name, username, birthDate, sex, weight, height, level, trainingTime } = req.body;
  const data = {};

  if (name !== undefined) {
    if (!String(name).trim()) {
      return res.status(400).json({ error: 'Nome não pode ficar em branco.' });
    }
    data.name = String(name).trim();
  }

  if (username !== undefined) {
    const normalizedUsername = String(username).trim();
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      return res.status(400).json({
        error: 'Nome de usuário deve ter de 3 a 24 caracteres, usando apenas letras, números, ponto ou underscore.',
      });
    }
    const taken = await prisma.account.findFirst({
      where: { username: { equals: normalizedUsername, mode: 'insensitive' }, NOT: { id: req.accountId } },
    });
    if (taken) {
      return res.status(409).json({ error: 'Esse nome de usuário já está em uso — escolha outro.' });
    }
    data.username = normalizedUsername;
  }

  if (weight !== undefined) {
    const n = Number(weight);
    if (weight !== null && (isNaN(n) || n <= 0)) {
      return res.status(400).json({ error: 'Peso inválido.' });
    }
    data.weight = weight === null ? null : n;
  }

  if (height !== undefined) {
    const n = Number(height);
    if (height !== null && (isNaN(n) || n <= 0)) {
      return res.status(400).json({ error: 'Altura inválida.' });
    }
    data.height = height === null ? null : n;
  }

  if (birthDate !== undefined) {
    if (birthDate === null) {
      data.birthDate = null;
    } else {
      const d = new Date(birthDate);
      const age = (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (isNaN(d.getTime()) || age < 10 || age > 100) {
        return res.status(400).json({ error: 'Confira a data de nascimento informada.' });
      }
      data.birthDate = d;
    }
  }

  if (sex !== undefined) data.sex = sex || null;
  if (level !== undefined) data.level = level || null;
  if (trainingTime !== undefined) data.trainingTime = trainingTime || null;

  let account;
  try {
    account = await prisma.account.update({ where: { id: req.accountId }, data });
  } catch (err) {
    if (err.code === 'P2002' && err.meta && err.meta.target && err.meta.target.includes('username')) {
      return res.status(409).json({ error: 'Esse nome de usuário já está em uso — escolha outro.' });
    }
    throw err;
  }

  res.json({ account: publicAccount(account) });
});

router.delete('/', requireAuth, async (req, res) => {
  const photos = await prisma.athletePhoto.findMany({ where: { athleteId: req.accountId } });
  for (const photo of photos) {
    await storage.deleteObject(photo.objectKey);
  }
  // O resto (athleteCore, athletePhotos, passwordResetTokens, friendships)
  // é removido em cascata pelas foreign keys definidas no schema.
  await prisma.account.delete({ where: { id: req.accountId } });
  res.clearCookie(SESSION_COOKIE, SESSION_COOKIE_OPTIONS);
  res.status(204).end();
});

module.exports = router;
