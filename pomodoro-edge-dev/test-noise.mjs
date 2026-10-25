// 噪音引擎测试：加载真实 offscreen.js（用假 AudioContext），
// 验证白/粉/紫噪音的频谱斜率、增益归一化、以及预设与界面按钮是否一一对应
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.join(__dirname, '..', 'pomodoro-edge');

/* ---------------- 最小 AudioContext 模拟 ---------------- */
class Param {
  constructor(v = 0) { this.value = v; }
  setValueAtTime() { return this; }
  linearRampToValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
  cancelScheduledValues() { return this; }
}
class Node {
  constructor(ctx) { this.ctx = ctx; }
  connect(n) { return n; }
  disconnect() {}
}
class GainNode extends Node {
  constructor(ctx) { super(ctx); this.gain = new Param(1); }
}
class BiquadNode extends Node {
  constructor(ctx) {
    super(ctx);
    this.type = 'lowpass';
    this.frequency = new Param(350);
    this.Q = new Param(1);
    this.gain = new Param(0);
  }
}
class SourceNode extends Node {
  constructor(ctx) { super(ctx); this.buffer = null; this.loop = false; }
  start() {}
  stop() {}
}
class OscNode extends Node {
  constructor(ctx) { super(ctx); this.type = 'sine'; this.frequency = new Param(440); }
  start() {}
  stop() {}
}
class FakeAudioContext {
  constructor() {
    this.sampleRate = 48000;
    this.currentTime = 0;
    this.state = 'running';
    this.destination = new Node(this);
  }
  resume() { return Promise.resolve(); }
  createBuffer(ch, len, sr) {
    const data = new Float32Array(len);
    return { numberOfChannels: ch, length: len, sampleRate: sr, getChannelData: () => data };
  }
  createGain() { return new GainNode(this); }
  createBiquadFilter() { return new BiquadNode(this); }
  createBufferSource() { return new SourceNode(this); }
  createOscillator() { return new OscNode(this); }
}

const fakeChrome = { runtime: { onMessage: { addListener() {} } } };

function loadEngine() {
  const src = fs.readFileSync(path.join(EXT, 'offscreen.js'), 'utf8');
  const sandbox = {
    console,
    Math,
    Float32Array,
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0, // 不真的跑篝火爆裂定时器
    clearInterval: () => {},
    AudioContext: FakeAudioContext,
    chrome: fakeChrome,
    Promise,
    Date,
    String,
    Number,
    Object,
    Array,
    isFinite,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(
    src + '\nglobalThis.__x = { PRESETS, noiseBuffer, normalize, ensureCtx, getCtx: () => ctx };',
    sandbox
  );
  return sandbox.__x;
}

/* ---------------- 频谱分析 ----------------
 * 用 Welch 法：4096 点分段 + Hann 窗 + 段间平均功率。
 * 单段周期图对随机噪声的估计方差高达 ±5 dB，会把斜率测歪，
 * 所以必须分段平均（4 秒缓冲可切 46 段，抖动降到 1 dB 以内）。
 */
const SEG = 4096;
function welchPower(data, sr, freq) {
  const segs = Math.floor(data.length / SEG);
  const win = new Float64Array(SEG);
  let w2 = 0;
  for (let i = 0; i < SEG; i++) {
    win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (SEG - 1)); // Hann
    w2 += win[i] * win[i];
  }
  const w = (2 * Math.PI * freq) / sr;
  let acc = 0;
  for (let s = 0; s < segs; s++) {
    const off = s * SEG;
    let re = 0, im = 0;
    for (let i = 0; i < SEG; i++) {
      const v = data[off + i] * win[i];
      re += v * Math.cos(w * i);
      im -= v * Math.sin(w * i);
    }
    acc += re * re + im * im;
  }
  return acc / segs / (w2 * w2);
}

// 最小二乘拟合 dB 对 log2(f) 的斜率（dB/倍频程）
function slopeDbPerOct(data, sr, f0, f1, points = 20) {
  const xs = [], ys = [];
  for (let i = 0; i < points; i++) {
    const f = f0 * Math.pow(f1 / f0, i / (points - 1));
    const p = welchPower(data, sr, f);
    if (!(p > 0)) continue;
    xs.push(Math.log2(f));
    ys.push(10 * Math.log10(p));
  }
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return num / den;
}

function rms(data) {
  let s = 0;
  for (let i = 0; i < data.length; i++) s += data[i] * data[i];
  return Math.sqrt(s / data.length);
}

/* ---------------- 断言 ---------------- */
let pass = 0;
const fails = [];
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fails.push(name + (detail ? ` (${detail})` : '')); console.log(`  FAIL ${name} ${detail}`); }
}

const x = loadEngine();
x.ensureCtx();
const ctx = x.getCtx();
const SR = ctx.sampleRate;

console.log('频谱斜率（理论值：白 0 / 粉红 -3 / 紫 +6 / 棕 -6 dB/倍频程）');
for (const [kind, expect] of [['white', 0], ['pink', -3], ['violet', 6], ['brown', -6]]) {
  const d = x.noiseBuffer(kind).getChannelData(0);
  const s = slopeDbPerOct(d, SR, 200, 8000);
  console.log(`  ${kind.padEnd(7)} 实测 ${s.toFixed(2)} dB/oct`);
  ok(`${kind} 斜率接近 ${expect}`, Math.abs(s - expect) < 0.6, `实测 ${s.toFixed(2)}`);
}

console.log('循环缓冲');
{
  const buf = x.noiseBuffer('white');
  ok('缓冲为 4 秒', buf.length === SR * 4, `实际 ${buf.length}`);
  ok('无 NaN 采样点', buf.getChannelData(0).every ? Array.prototype.every.call(buf.getChannelData(0), Number.isFinite) : true);
}

console.log('归一化');
{
  const buf = x.noiseBuffer('white');
  x.normalize(buf, 0.5);
  const r = rms(buf.getChannelData(0));
  ok('归一化后 RMS ≈ 0.5', Math.abs(r - 0.5) < 0.02, `实测 ${r.toFixed(3)}`);
  ok('归一化后无削波', buf.getChannelData(0).every ? Array.prototype.every.call(buf.getChannelData(0), (v) => Math.abs(v) <= 1) : true);
}

console.log('预设完整性');
{
  const keys = Object.keys(x.PRESETS);
  const want = ['rain', 'fire', 'stream', 'space', 'white', 'pink', 'violet', 'grey'];
  for (const k of want) ok(`存在预设 ${k}`, keys.includes(k));
  for (const k of want) ok(`预设 ${k} 有中文名`, typeof x.PRESETS[k].label === 'string' && x.PRESETS[k].label.length > 0);
}

console.log('每个预设可构建（不抛错、返回节点数组）');
{
  for (const k of Object.keys(x.PRESETS)) {
    let built = null, err = null;
    try {
      const out = new GainNode(ctx);
      built = x.PRESETS[k].build(out);
    } catch (e) { err = e; }
    // build 可以直接返回节点数组，也可以返回 { nodes, timers }（带定时器的音色）
    const nodes = Array.isArray(built) ? built : built && built.nodes;
    ok(`${k} 构建成功`, !err, err && err.message);
    ok(`${k} 返回可停止的节点`, Array.isArray(nodes) && nodes.length > 0 && nodes.every((n) => n && typeof n.disconnect === 'function'));
  }
}

console.log('界面按钮与音频预设一一对应');
{
  const html = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8');
  const uiKeys = [...html.matchAll(/data-preset="([^"]+)"/g)].map((m) => m[1]);
  const engineKeys = Object.keys(x.PRESETS);
  ok('按钮无重复', new Set(uiKeys).size === uiKeys.length);
  ok('每个按钮都有对应音色', uiKeys.every((k) => engineKeys.includes(k)), uiKeys.filter((k) => !engineKeys.includes(k)).join(','));
  ok('每个音色都有按钮', engineKeys.every((k) => uiKeys.includes(k)), engineKeys.filter((k) => !uiKeys.includes(k)).join(','));
  ok('按钮数量为 8', uiKeys.length === 8, `实际 ${uiKeys.length}`);
}

console.log('popup.js 文案表覆盖全部音色');
{
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  for (const k of Object.keys(x.PRESETS)) {
    ok(`PRESET_LABEL 含 ${k}`, new RegExp(`\\b${k}\\s*:`).test(js));
  }
}

console.log('灰噪音滤波链');
{
  const html = fs.readFileSync(path.join(EXT, 'offscreen.js'), 'utf8');
  const greyBlock = html.slice(html.indexOf('grey: {'));
  ok('灰噪含低频搁架提升', /type = 'lowshelf'/.test(greyBlock));
  ok('灰噪含 3kHz 附近衰减', /type = 'peaking'/.test(greyBlock));
  ok('灰噪含高频搁架提升', /type = 'highshelf'/.test(greyBlock));
  ok('灰噪有 30Hz 高通保护', /type = 'highpass'/.test(greyBlock));
}

console.log(`\n${pass} passed, failures: ${fails.length ? fails.join(' | ') : 'none'}`);
process.exit(fails.length ? 1 : 0);
