require('dotenv').config();

for (const key of ['DATABASE_URL', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error(`Variável de ambiente obrigatória ausente: ${key}`);
    process.exit(1);
  }
}

if (process.env.S3_BUCKET) {
  for (const key of ['S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_URL_BASE']) {
    if (!process.env[key]) {
      console.error(`S3_BUCKET definido, mas falta a variável obrigatória: ${key}`);
      process.exit(1);
    }
  }
}

if (process.env.RESEND_API_KEY && !process.env.RESEND_FROM_EMAIL) {
  console.error('RESEND_API_KEY definido, mas falta a variável obrigatória: RESEND_FROM_EMAIL');
  process.exit(1);
}

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Pulso API rodando na porta ${PORT}`);
});
