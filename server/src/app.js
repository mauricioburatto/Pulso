const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { router: authRouter } = require('./routes/auth');
const meRouter = require('./routes/me');
const athleteCoreRouter = require('./routes/athleteCore');
const athletePhotosRouter = require('./routes/athletePhotos');
const aiRouter = require('./routes/ai');
const storage = require('./storage');

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
// Limite elevado por causa das imagens em base64 enviadas para as rotas de IA
// (/ai/*) — o cliente já redimensiona antes de enviar, mas PDFs e fotos
// duplas (avaliação corporal) podem passar do limite padrão de 100kb.
app.use(express.json({ limit: '25mb' }));
app.use(cookieParser());

if (!storage.useS3) {
  app.use('/uploads', express.static(storage.LOCAL_UPLOAD_DIR));
}

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRouter);
app.use('/me', meRouter);
app.use('/athlete/core', athleteCoreRouter);
app.use('/athlete/photos', athletePhotosRouter);
app.use('/ai', aiRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

module.exports = app;
