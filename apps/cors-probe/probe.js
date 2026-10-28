import { classifyFailure } from './classify.js';

const BASE = 'https://personal.connectapi.garmin.com';
const TOKEN_URL = BASE + '/personalapitoken-service/personal-api/personal-api-key/token';
const DATA_URL = BASE + '/userprofile-service/userprofile/settings'; // swap after CLI proves a cheaper endpoint (plan 07)

const $ = (id) => document.getElementById(id);
const lines = [];
const log = (s) => { lines.push(s); $('out').textContent = lines.join('\n'); };

async function step(name, url, init) {
  let res;
  try {
    res = await fetch(url, init);
  } catch {
    // Control: opaque no-cors request with no custom headers. Resolves if host is reachable.
    let controlResolved = false;
    try { await fetch(url, { mode: 'no-cors' }); controlResolved = true; } catch { /* unreachable */ }
    log(`${name}: FAIL ${classifyFailure({ threw: true, controlResolved })}`);
    return null;
  }
  const cls = classifyFailure({ status: res.status });
  log(`${name}: ${res.ok ? 'PASS' : 'FAIL'} ${cls} (HTTP ${res.status})`);
  return res.ok ? res : null;
}

$('run').addEventListener('click', async () => {
  let key = $('key').value;
  $('key').value = '';
  lines.length = 0;
  log(`time: ${new Date().toISOString()}`);
  log(`origin: ${location.origin}`);
  log(`display-standalone: ${matchMedia('(display-mode: standalone)').matches}`);
  log(`ua: ${navigator.userAgent}`);
  const t = await step('token', TOKEN_URL, { method: 'POST', headers: { Accept: '*/*', Authorization: `ApiKey ${key}` } });
  key = '';
  if (!t) return;
  let token = (await t.text()).trim();
  try { token = JSON.parse(token).accessToken ?? token; } catch { /* bare JWT */ }
  await step('data', DATA_URL, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
  token = '';
});

$('copy').addEventListener('click', () => navigator.clipboard.writeText(lines.join('\n')));
