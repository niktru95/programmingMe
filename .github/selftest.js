/* Прогон index.html?selftest в headless Chromium (для CI). Код выхода 1 — если тесты упали. */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '?selftest');
  await page.waitForFunction(() => document.title.indexOf('SELFTEST-') === 0, null, { timeout: 150000 });
  const title = await page.title();
  console.log(title);
  await browser.close();
  process.exit(title === 'SELFTEST-OK' ? 0 : 1);
})();
