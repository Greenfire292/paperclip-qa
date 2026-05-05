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

test('visual smoke: start run, buy a unit, place it on the board', async ({ page }) => {
  await installDeterministicRandom(page);
  await page.goto('/index.html');

  await page.click('#start');
  await expect(page.locator('#shop .shop-item')).toHaveCount(3);
  await page.locator('#shop .shop-item button').first().click();
  await expect(page.locator('#bench button')).toHaveCount(1);

  const benchUnitLabel = await page.locator('#bench button').first().innerText();
  const unitName = benchUnitLabel.split(' (')[0];
  await page.locator('#bench button').first().click();

  await expect(page.locator('#board button').first()).toContainText(unitName);
  await expect(page.locator('#state')).toContainText('Round: 1');

  await page.screenshot({
    path: artifactPath('screenshots', '02-shop-and-placement.png'),
    fullPage: true
  });
});
