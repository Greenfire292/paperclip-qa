const path = require('path');
const { defineConfig } = require('@playwright/test');

const artifactDir = process.env.ARTIFACT_DIR || path.join(__dirname, '..', 'artifacts', 'qa-captures');
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const useExternalBaseUrl = Boolean(process.env.BASE_URL);

module.exports = defineConfig({
  testDir: path.join(__dirname, 'smoke'),
  timeout: 60_000,
  fullyParallel: false,
  retries: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(artifactDir, 'html-report'), open: 'never' }]
  ],
  outputDir: path.join(artifactDir, 'test-results'),
  use: {
    baseURL,
    headless: true,
    screenshot: 'off',
    video: 'on',
    trace: 'on',
    viewport: { width: 1440, height: 900 }
  },
  webServer: useExternalBaseUrl ? undefined : {
    command: 'npm run serve',
    cwd: __dirname,
    url: baseURL,
    timeout: 30_000,
    reuseExistingServer: true
  }
});
