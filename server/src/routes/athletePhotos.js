const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/requireAuth');
const storage = require('../storage');

const router = express.Router();

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Apenas arquivos de imagem são aceitos.'));
    }
    cb(null, true);
  },
});

function extensionFor(mimetype) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
  };
  return map[mimetype] || 'bin';
}

router.get('/', requireAuth, async (req, res) => {
  const photos = await prisma.athletePhoto.findMany({
    where: { athleteId: req.accountId },
    orderBy: { date: 'desc' },
  });
  res.json({ photos });
});

router.post('/', requireAuth, (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo "photo" é obrigatório.' });
    }
    const { date, notes } = req.body;
    if (!date) {
      return res.status(400).json({ error: 'Campo "date" é obrigatório.' });
    }

    const key = `athletes/${req.accountId}/photos/${crypto.randomUUID()}.${extensionFor(req.file.mimetype)}`;
    const url = await storage.putObject(key, req.file.buffer, req.file.mimetype);

    const photo = await prisma.athletePhoto.create({
      data: {
        athleteId: req.accountId,
        date: new Date(date),
        notes: notes ? String(notes).trim() : null,
        objectKey: key,
        url,
      },
    });

    res.status(201).json({ photo });
  });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const photo = await prisma.athletePhoto.findUnique({ where: { id: req.params.id } });
  if (!photo || photo.athleteId !== req.accountId) {
    return res.status(404).json({ error: 'Foto não encontrada.' });
  }

  await storage.deleteObject(photo.objectKey);
  await prisma.athletePhoto.delete({ where: { id: photo.id } });

  res.status(204).end();
});

module.exports = router;
