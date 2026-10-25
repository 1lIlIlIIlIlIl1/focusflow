// 生成扩展图标：深色圆角底 + 橙色倒计时圆环（顶部留缺口）+ 中心圆点
// 纯 Node 实现，无第三方依赖。用法：node gen-icons.js
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const lerp = (a, b, t) => a + (b - a) * t;
const norm = (deg) => ((deg % 360) + 360) % 360;

function render(size) {
  const S = 4;
  const W = size * S;
  const out = Buffer.alloc(W * W * 4);
  const cx = W / 2, cy = W / 2;
  const compact = size <= 24;
  const radius = W * (compact ? 0.20 : 0.235);
  const rOuter = W * (compact ? 0.425 : 0.345);
  const rInner = W * (compact ? 0.215 : 0.225);
  const rDot = compact ? 0 : W * 0.062;
  const gapHalf = compact ? 26 : 30;

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5, py = y + 0.5;
      const dx = px - cx, dy = py - cy;
      const dist = Math.hypot(dx, dy);
      let r = 0, g = 0, b = 0, a = 0;

      // 圆角矩形底
      const qx = Math.max(Math.abs(dx) - (W / 2 - radius), 0);
      const qy = Math.max(Math.abs(dy) - (W / 2 - radius), 0);
      if (Math.hypot(qx, qy) <= radius) {
        const t = y / W;
        r = Math.round(lerp(0x22, 0x0e, t));
        g = Math.round(lerp(0x26, 0x10, t));
        b = Math.round(lerp(0x31, 0x15, t));
        a = 255;
      }

      const ang = norm((Math.atan2(dy, dx) * 180) / Math.PI);
      const gapStart = 270 - gapHalf;
      const gapEnd = 270 + gapHalf;
      const inArc = ang <= gapStart || ang >= gapEnd;
      const arcLen = 360 - gapHalf * 2;

      // 圆环（顶部留缺口）
      if (dist <= rOuter && dist >= rInner && inArc) {
        const t = Math.min(1, Math.max(0, norm(ang - gapEnd) / arcLen));
        r = Math.round(lerp(0xff, 0xff, t));
        g = Math.round(lerp(0x6b, 0xa8, t));
        b = Math.round(lerp(0x4a, 0x5c, t));
        a = 255;
      }
      // 中心点
      if (rDot > 0 && dist <= rDot) {
        r = 0xff; g = 0xe6; b = 0xd5; a = 255;
      }

      const o = (y * W + x) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a;
    }
  }

  // 盒式降采样
  const px = size;
  const final = Buffer.alloc(px * px * 4);
  const n = S * S;
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const o = ((y * S + sy) * W + (x * S + sx)) * 4;
          const al = out[o + 3] / 255;
          r += out[o] * al; g += out[o + 1] * al; b += out[o + 2] * al; a += out[o + 3];
        }
      }
      const avgA = a / n;
      const k = avgA > 0 ? a / 255 : 1;
      const o2 = (y * px + x) * 4;
      final[o2] = Math.round(r / k);
      final[o2 + 1] = Math.round(g / k);
      final[o2 + 2] = Math.round(b / k);
      final[o2 + 3] = Math.round(avgA);
    }
  }
  return encodePNG(px, px, final);
}

const dir = path.join(__dirname, '..', 'pomodoro-edge', 'icons');
fs.mkdirSync(dir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  fs.writeFileSync(path.join(dir, `icon${size}.png`), render(size));
  console.log(`icons/icon${size}.png`);
}
