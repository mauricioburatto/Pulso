const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const prisma = require('../prisma');
const { SESSION_COOKIE } = require('../middleware/requireAuth');

const router = express.Router();

const BCRYPT_ROUNDS = 12;
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

function publicAccount(account) {
  const { passwordHash, ...rest } = account;
  return rest;
}

function setSessionCookie(res, accountId) {
  const token = jwt.sign({ accountId }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_MS,
  });
}

router.post('/signup', authLimiter, async (req, res) => {
  const {
    name,
    email,
    password,
    modality,
    level,
    weight,
    height,
    trainingTime,
    birthDate,
    sex,
  } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const existing = await prisma.account.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(409).json({ error: 'Já existe uma conta com este email.' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const account = await prisma.account.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash,
      modality: modality ?? null,
      level: level ?? null,
      weight: weight ?? null,
      height: height ?? null,
      trainingTime: trainingTime ?? null,
      birthDate: birthDate ? new Date(birthDate) : null,
      sex: sex ?? null,
    },
  });

  await prisma.athleteCore.create({
    data: {
      athleteId: account.id,
      data: {
        goals: [],
        trainings: [],
        plannedWorkouts: [],
        modalities: [],
        supplements: [],
        supplementSuggestions: [],
        reports: [],
        analyses: [],
        bodyAssessments: [],
        trainingAssessments: [],
        diet: {
          targetKcal: null,
          targetProtein: null,
          targetCarb: null,
          targetFat: null,
          meals: [],
          questionnaire: {},
        },
      },
    },
  });

  setSessionCookie(res, account.id);
  res.status(201).json({ account: publicAccount(account) });
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const account = await prisma.account.findUnique({ where: { email: normalizedEmail } });

  if (!account) {
    return res.status(401).json({ error: 'Email ou senha inválidos.' });
  }

  const valid = await bcrypt.compare(password, account.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Email ou senha inválidos.' });
  }

  setSessionCookie(res, account.id);
  res.json({ account: publicAccount(account) });
});

router.post('/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.status(204).end();
});

module.exports = { router, publicAccount };
