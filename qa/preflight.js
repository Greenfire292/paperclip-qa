const { spawnSync } = require('child_process');
const path = require('path');

function print(line = '') {
  process.stdout.write(line + '\n');
}

function run(cmd, args, options = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', ...options });
}

function checkCommand(command, args = ['--version']) {
  const result = run(command, args);
  return {
    ok: result.status === 0,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    error: result.error ? String(result.error.message || result.error) : ''
  };
}

function resolvePlaywrightBrowser() {
  try {
    const { chromium } = require('playwright');
    return chromium.executablePath();
  } catch (error) {
    return null;
  }
}

print('QA preflight for DON-33');
print('');

const nodeCheck = checkCommand('node');
print(`node: ${nodeCheck.ok ? 'ok' : 'missing'} ${nodeCheck.stdout}`.trim());

const npmCheck = checkCommand('npm');
print(`npm: ${npmCheck.ok ? 'ok' : 'missing'} ${npmCheck.stdout}`.trim());

const dockerCheck = checkCommand('docker');
print(`docker: ${dockerCheck.ok ? 'ok' : 'unavailable'}`);
if (!dockerCheck.ok && (dockerCheck.error || dockerCheck.stderr)) {
  print(`  detail: ${dockerCheck.error || dockerCheck.stderr}`);
}

const browserPath = resolvePlaywrightBrowser();
if (!browserPath) {
  print('playwright browser: not resolvable yet');
  print('  run: npx playwright install chromium');
} else {
  print(`playwright browser path: ${browserPath}`);
  const browserCheck = run(browserPath, ['--version']);
  if (browserCheck.status === 0) {
    print(`chromium launch check: ok ${String(browserCheck.stdout || '').trim()}`.trim());
  } else {
    print('chromium launch check: failed');
    const detail = String(browserCheck.stderr || browserCheck.stdout || browserCheck.error || '').trim();
    if (detail) print(`  detail: ${detail}`);
    print('  likely missing system libraries for headless Chromium.');
    print('  required unblock: runtime with Playwright browser deps, or Docker sidecar support.');
  }
}

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
print(`baseURL: ${baseURL}`);
if (process.env.BASE_URL) {
  print('server mode: external BASE_URL provided');
} else {
  print('server mode: local static server via npm run serve');
  const serveCheck = checkCommand('npx', ['http-server', '--version']);
  print(`http-server: ${serveCheck.ok ? 'ok' : 'missing'}`);
  if (!serveCheck.ok && (serveCheck.error || serveCheck.stderr)) {
    print(`  detail: ${serveCheck.error || serveCheck.stderr}`);
  }
}

print('');
print('If Chromium launch fails with shared library errors, this worker is not capture-capable for DON-33.');
