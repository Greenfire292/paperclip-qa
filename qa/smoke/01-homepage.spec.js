const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

function createSeededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

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

test('visual smoke: homepage shell renders', async ({ page }) => {
  await installDeterministicRandom(page);
  await page.goto('/index.html');

  await expect(page).toHaveTitle(/Crownforge Prototype/i);
  await expect(page.locator('#start')).toBeVisible();
  await expect(page.locator('#fight')).toBeVisible();
  await expect(page.locator('#board .cell, #board button').first()).toBeVisible();

  await page.screenshot({
    path: artifactPath('screenshots', '01-homepage-shell.png'),
    fullPage: true
  });
});
