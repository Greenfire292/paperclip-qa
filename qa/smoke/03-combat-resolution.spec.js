const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

async function installDeterministicRandom(page, seed = 123456789) {
  await page.addInitScript(({ initialSeed }) => {
    let value = initialSeed >>> 0;
    Math.random = () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 0x100000000;
    };
  }, { initialSeed: seed });
}

function artifactPath(...parts) {
  const base = process.env.ARTIFACT_DIR || path.join(__dirname, '..', '..', 'artifacts', 'qa-captures');
  const target = path.join(base, ...parts);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  return target;
}

test('visual smoke: auto-combat resolves and writes combat evidence', async ({ page }) => {
  await installDeterministicRandom(page);
  await page.goto('/index.html');

  await page.click('#start');
  for (let i = 0; i < 3; i += 1) {
    await page.locator('#shop .shop-item button').first().click();
  }
  await expect(page.locator('#bench button')).toHaveCount(3);
  for (let i = 0; i < 3; i += 1) {
    await page.locator('#bench button').first().click();
  }

  await page.click('#fight');
  await expect(page.locator('#log')).toContainText(/Victory|Loss|Run clear|Run failed/i);
  await expect(page.locator('#board button').first()).not.toContainText('(empty)');

  await page.screenshot({
    path: artifactPath('screenshots', '03-combat-resolution.png'),
    fullPage: true
  });
});
