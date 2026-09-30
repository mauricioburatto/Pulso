// Teste de fumaça de ponta a ponta: cria uma conta de verdade (contra o
// backend + Postgres local) e navega por todas as abas do app, checando que
// nada quebra (sem erros de console/página) e que a navegação básica
// funciona. Não substitui testes unitários — é uma rede de segurança contra
// regressões visuais/estruturais grandes antes de cada deploy.
import { test, expect } from '@playwright/test';

const TABS = [
  'Painel',
  'Metas & Provas',
  'Treinos',
  'Sincronizar treino',
  'Evolução física',
  'Suplementos',
  'Nutrição',
  'Análise IA',
  'Relatórios',
  'Comunidade',
  'Ajustes',
];

test('signup e navegação por todas as abas sem erros', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/404|401|CERT/.test(msg.text())) {
      errors.push(`console: ${msg.text()}`);
    }
  });

  await page.goto('/');
  await page.getByText('Criar conta', { exact: true }).first().click();

  const stamp = Date.now();
  const email = `smoke_${stamp}@test.com`;
  await page.getByPlaceholder('Nome completo').fill('Smoke Test');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder(/Nome de usuário/).fill(`smoke_${stamp}`);
  await page.getByPlaceholder('Criar senha (mín. 8 caracteres)').fill('senha1234');
  await page.getByPlaceholder('Confirmar senha').fill('senha1234');
  await page.getByPlaceholder('Data de nascimento').fill('1995-05-20');
  await page.getByPlaceholder('Peso (kg)').fill('75');
  await page.getByPlaceholder('Altura (m)').fill('1.78');
  const selects = await page.locator('select').all();
  await selects[0].selectOption({ label: 'Amador' });
  await selects[1].selectOption({ label: 'Masculino' });
  await selects[2].selectOption({ label: '2 anos ou mais' });
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Criar conta e entrar' }).click();

  await expect(page.getByText('Comece por aqui')).toBeVisible({ timeout: 10000 });

  for (const tab of TABS) {
    await page.getByText(tab, { exact: true }).click();
    await page.waitForTimeout(300);
  }

  await page.getByRole('button', { name: 'sair' }).click();
  await expect(page.getByText('Entrar na sua conta', { exact: false })).toBeVisible({ timeout: 5000 });

  expect(errors, `Erros encontrados durante a navegação:\n${errors.join('\n')}`).toEqual([]);
});
