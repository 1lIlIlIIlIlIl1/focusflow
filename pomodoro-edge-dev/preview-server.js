// 预览服务器：把扩展页面当普通网页跑，并注入 chrome.* 模拟层
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'pomodoro-edge');
const PORT = Number(process.env.PORT || 8787);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

http
  .createServer((req, res) => {
    let url = decodeURIComponent((req.url || '/').split('?')[0]);
    if (url === '/') url = '/popup.html';

    let filePath;
    if (url === '/__mock.js') {
      filePath = path.join(__dirname, 'mock-chrome.js');
    } else {
      filePath = path.join(ROOT, url);
    }

    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('not found: ' + url);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    let body = fs.readFileSync(filePath);
    if (ext === '.html') {
      const html = body.toString('utf8').replace('<head>', '<head>\n  <script src="/__mock.js"></script>');
      body = Buffer.from(html, 'utf8');
    }

    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`preview on http://127.0.0.1:${PORT}/popup.html`);
  });
