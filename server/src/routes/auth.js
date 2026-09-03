const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const prisma = require('../prisma');
const { sendEmail } = require('../email');
const { SESSION_COOKIE } = require('../middleware/requireAuth');

const router = express.Router();

const BCRYPT_ROUNDS = 12;
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const RESET_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutos

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

function hashResetCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function resetCodeMatches(codeHash, candidateCode) {
  const candidateHash = Buffer.from(hashResetCode(candidateCode), 'hex');
  const storedHash = Buffer.from(codeHash, 'hex');
  if (candidateHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(candidateHash, storedHash);
}

function publicAccount(account) {
  const { passwordHash, ...rest } = account;
  return rest;
}

// Em produção, frontend e backend normalmente vivem em domínios diferentes
// (ex: Vercel + Railway) — isso torna a requisição "cross-site" aos olhos do
// navegador, e cookies só são enviados nesse caso com SameSite=None (que por
// sua vez exige Secure). Em dev, localhost:5173 e localhost:3000 contam como
// o mesmo "site", então Lax já basta e evita exigir HTTPS local.
const isProduction = process.env.NODE_ENV === 'production';
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
};

function setSessionCookie(res, accountId) {
  const token = jwt.sign({ accountId }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
  res.cookie(SESSION_COOKIE, token, { ...SESSION_COOKIE_OPTIONS, maxAge: SESSION_MAX_AGE_MS });
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
          targetKcal: '',
          targetProtein: '',
          targetCarb: '',
          targetFat: '',
          meals: [],
          questionnaire: { rotina: '', alimentacaoAtual: '', gosta: '', naoGosta: '', paladar: '', suplementos: '', observacoes: '' },
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
  res.clearCookie(SESSION_COOKIE, SESSION_COOKIE_OPTIONS);
  res.status(204).end();
});

router.post('/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email é obrigatório.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const account = await prisma.account.findUnique({ where: { email: normalizedEmail } });

  // Resposta idêntica exista ou não a conta, para não revelar emails cadastrados.
  if (account) {
    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = hashResetCode(code);
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MS);

    await prisma.passwordResetToken.updateMany({
      where: { accountId: account.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await prisma.passwordResetToken.create({
      data: { accountId: account.id, codeHash, expiresAt },
    });

    await sendEmail({
      to: account.email,
      subject: 'Código para redefinir sua senha — Pulso',
      text: `Seu código de verificação é ${code}.\n\nEle expira em 10 minutos. Se você não pediu essa redefinição, ignore este email.`,
    });
  }

  res.json({ message: 'Se este email estiver cadastrado, um código de verificação foi enviado.' });
});

router.post('/reset-password', resetLimiter, async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Email, código e nova senha são obrigatórios.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const account = await prisma.account.findUnique({ where: { email: normalizedEmail } });

  const invalidCodeResponse = () =>
    res.status(400).json({ error: 'Código inválido ou expirado.' });

  if (!account) {
    return invalidCodeResponse();
  }

  const token = await prisma.passwordResetToken.findFirst({
    where: { accountId: account.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (!token || !resetCodeMatches(token.codeHash, String(code))) {
    return invalidCodeResponse();
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.$transaction([
    prisma.account.update({ where: { id: account.id }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
  ]);

  res.json({ message: 'Senha redefinida com sucesso.' });
});

module.exports = { router, publicAccount };
