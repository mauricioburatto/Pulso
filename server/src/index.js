require('dotenv').config();

for (const key of ['DATABASE_URL', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error(`Variável de ambiente obrigatória ausente: ${key}`);
    process.exit(1);
  }
}

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Pulso API rodando na porta ${PORT}`);
});
