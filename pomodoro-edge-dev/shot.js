// 用 CDP 在 headless Edge 里打开扩展页面并截图（含控制台错误采集）
const fs = require('fs');
const path = require('path');

const PORT = 9333;
const OUT = path.join(__dirname, '_preview');

const JOBS = [
  { name: 'popup', url: '/popup.html', w: 360, h: 540 },
  {
    name: 'popup-running',
    url: '/popup.html',
    w: 360,
    h: 540,
    after: `document.getElementById('btnMain').click()`,
    wait: 1400,
  },
  { name: 'dashboard', url: '/dashboard.html', w: 1280, h: 1140 },
  { name: 'dashboard-week', url: '/dashboard.html', w: 1280, h: 1140, after: `document.querySelector('[data-range="week"]').click()` },
  { name: 'settings', url: '/dashboard.html#settings', w: 1280, h: 1140 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });

  let msgId = 0;
  const pending = new Map();
  const logs = [];

  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      return;
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      logs.push(`[exception] ${d.text} ${d.exception?.description || ''}`.slice(0, 400));
    }
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
      logs.push(
        `[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ').slice(0, 300)
      );
    }
  });

  function send(method, params = {}, sessionId) {
    const id = ++msgId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }

  for (const job of JOBS) {
    const url = `http://127.0.0.1:8787${job.url}`;
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, sessionId);
    await send('Runtime.enable', {}, sessionId);
    await send(
      'Emulation.setDeviceMetricsOverride',
      { width: job.w, height: job.h, deviceScaleFactor: 2, mobile: false },
      sessionId
    );
    await send('Page.navigate', { url }, sessionId);
    await sleep(2600);

    if (job.after) {
      try {
        await send('Runtime.evaluate', { expression: job.after, awaitPromise: false }, sessionId);
      } catch (e) {
        logs.push(`[eval-fail] ${job.name}: ${e.message}`);
      }
      await sleep(job.wait || 900);
    }

    const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    const file = path.join(OUT, `${job.name}.png`);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    console.log('saved', path.basename(file));
    await send('Target.closeTarget', { targetId });
  }

  if (logs.length) {
    console.log('\n--- console ---');
    console.log([...new Set(logs)].join('\n'));
  } else {
    console.log('\nno console errors');
  }
  ws.close();
}

main().catch((e) => {
  console.error('FAILED', e.message);
  process.exit(1);
});
