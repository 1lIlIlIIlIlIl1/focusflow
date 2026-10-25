// FocusFlow 音频引擎：用 Web Audio 实时合成氛围音，零音频文件、无版权风险
let ctx = null;
let master = null;
let current = null;
let currentPreset = null;
let volume = 0.5;

function ensureCtx() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = volume * 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/* 生成 4 秒循环噪音缓冲
 * white  : 白噪音，全频段等能量（-0 dB/oct）
 * pink   : 粉红噪音，每倍频程 -3 dB（Paul Kellet 近似）
 * brown  : 棕噪音，每倍频程 -6 dB
 * violet : 紫噪音，每倍频程 +6 dB（对白噪音做一阶差分）
 * 灰噪音不在这里生成，见 grey 预设（白噪音 + 逆等响滤波链）
 */
function noiseBuffer(kind) {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  if (kind === 'white') {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } else if (kind === 'brown') {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    }
  } else if (kind === 'violet') {
    // 一阶差分：白噪音能量随频率线性上升，即 +6 dB/oct
    let prev = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      d[i] = (w - prev) * 0.5;
      prev = w;
    }
  } else {
    // pink (Paul Kellet 近似)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  return buf;
}

/* 把缓冲归一化到目标 RMS：让不同噪声切换时响度一致，不会忽大忽小 */
function normalize(buf, targetRms) {
  const d = buf.getChannelData(0);
  let sum = 0;
  for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
  const rms = Math.sqrt(sum / d.length);
  if (!rms) return buf;
  const k = targetRms / rms;
  for (let i = 0; i < d.length; i++) d[i] *= k;
  return buf;
}

function loopSource(kind, targetRms) {
  const src = ctx.createBufferSource();
  const buf = noiseBuffer(kind);
  src.buffer = targetRms ? normalize(buf, targetRms) : buf;
  src.loop = true;
  src.start();
  return src;
}

function lfo(rate, depth, target, base) {
  const osc = ctx.createOscillator();
  osc.frequency.value = rate;
  const g = ctx.createGain();
  g.gain.value = depth;
  osc.connect(g).connect(target);
  target.value = base;
  osc.start();
  return osc;
}

/* 各氛围音的音色图 */
const PRESETS = {
  rain: {
    label: '雨声',
    build(out) {
      const hiss = loopSource('white');
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400;
      bp.Q.value = 0.6;
      const hissGain = ctx.createGain();
      hissGain.gain.value = 0.5;
      hiss.connect(bp).connect(hissGain).connect(out);

      const low = loopSource('brown');
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 260;
      const lowGain = ctx.createGain();
      lowGain.gain.value = 0.7;
      low.connect(lp).connect(lowGain).connect(out);

      // 雨势起伏
      const mod = lfo(0.07, 0.12, hissGain.gain, 0.5);
      return [hiss, low, mod];
    },
  },
  fire: {
    label: '篝火',
    build(out) {
      const body = loopSource('brown');
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      const bodyGain = ctx.createGain();
      bodyGain.gain.value = 0.55;
      body.connect(lp).connect(bodyGain).connect(out);

      const mod = lfo(0.23, 0.1, bodyGain.gain, 0.55);

      // 随机爆裂声
      const crackle = setInterval(() => {
        if (!ctx || ctx.state !== 'running') return;
        const now = ctx.currentTime;
        const burst = ctx.createBufferSource();
        burst.buffer = noiseBuffer('white');
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1200 + Math.random() * 2600;
        bp.Q.value = 3;
        const g = ctx.createGain();
        const peak = 0.08 + Math.random() * 0.22;
        const dur = 0.03 + Math.random() * 0.06;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(peak, now + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        burst.connect(bp).connect(g).connect(out);
        burst.start(now);
        burst.stop(now + dur + 0.02);
      }, 140);

      return { nodes: [body, mod], timers: [crackle] };
    },
  },
  stream: {
    label: '溪流',
    build(out) {
      const a = loopSource('white');
      const bpA = ctx.createBiquadFilter();
      bpA.type = 'bandpass';
      bpA.frequency.value = 1600;
      bpA.Q.value = 1.4;
      const gA = ctx.createGain();
      gA.gain.value = 0.34;
      a.connect(bpA).connect(gA).connect(out);

      const b = loopSource('white');
      const bpB = ctx.createBiquadFilter();
      bpB.type = 'bandpass';
      bpB.frequency.value = 4200;
      bpB.Q.value = 2.5;
      const gB = ctx.createGain();
      gB.gain.value = 0.1;
      b.connect(bpB).connect(gB).connect(out);

      const c = loopSource('brown');
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      const gC = ctx.createGain();
      gC.gain.value = 0.4;
      c.connect(lp).connect(gC).connect(out);

      const modA = lfo(0.11, 0.1, gA.gain, 0.34);
      const modB = lfo(0.19, 0.04, gB.gain, 0.1);
      return [a, b, c, modA, modB];
    },
  },
  space: {
    label: '深空',
    build(out) {
      const deep = loopSource('brown');
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 380;
      const g1 = ctx.createGain();
      g1.gain.value = 0.75;
      deep.connect(lp).connect(g1).connect(out);

      const air = loopSource('pink');
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 5200;
      bp.Q.value = 3;
      const g2 = ctx.createGain();
      g2.gain.value = 0.05;
      air.connect(bp).connect(g2).connect(out);

      const modL = lfo(0.045, 140, lp.frequency, 380);
      const modG = lfo(0.03, 0.18, g1.gain, 0.75);
      return [deep, air, modL, modG];
    },
  },

  /* ---------------- 纯噪音 ---------------- */
  white: {
    label: '白噪音',
    build(out) {
      const src = loopSource('white', 0.5);
      // 15 kHz 以上人耳几乎无感，砍掉可减少「嘶嘶」的刺耳感
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 15000;
      const g = ctx.createGain();
      g.gain.value = 0.52;
      src.connect(lp).connect(g).connect(out);
      return [src, lp, g];
    },
  },
  pink: {
    label: '粉红噪音',
    build(out) {
      const src = loopSource('pink', 0.5);
      const g = ctx.createGain();
      g.gain.value = 0.6;
      src.connect(g).connect(out);
      return [src, g];
    },
  },
  violet: {
    label: '紫噪音',
    build(out) {
      // 频段能量集中在中高频，同样 RMS 下听感更响，所以压得更低
      const src = loopSource('violet', 0.28);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 12000;
      const g = ctx.createGain();
      g.gain.value = 0.62;
      src.connect(lp).connect(g).connect(out);
      return [src, lp, g];
    },
  },
  grey: {
    label: '灰噪音',
    build(out) {
      // 灰噪音 = 白噪音经过「等响曲线反向补偿」：
      // 低频与极高频加厚，2–4 kHz（人耳最敏感的频段）略削，
      // 听感上各频段响度更均匀，比白噪音耐听、不易疲劳。
      const src = loopSource('white', 0.5);

      const hp = ctx.createBiquadFilter(); // 防止低频被抬起后轰隆/伤扬声器
      hp.type = 'highpass';
      hp.frequency.value = 30;
      hp.Q.value = 0.7;

      const lowShelf = ctx.createBiquadFilter();
      lowShelf.type = 'lowshelf';
      lowShelf.frequency.value = 150;
      lowShelf.gain.value = 10;

      const presence = ctx.createBiquadFilter();
      presence.type = 'peaking';
      presence.frequency.value = 3200;
      presence.Q.value = 0.8;
      presence.gain.value = -5;

      const airShelf = ctx.createBiquadFilter();
      airShelf.type = 'highshelf';
      airShelf.frequency.value = 9000;
      airShelf.gain.value = 5;

      const g = ctx.createGain();
      g.gain.value = 0.5;

      src.connect(hp).connect(lowShelf).connect(presence).connect(airShelf).connect(g).connect(out);
      return [src, hp, lowShelf, presence, airShelf, g];
    },
  },
};

function stopCurrent(fade = 0.6) {
  if (!current) return;
  const { out, nodes = [], timers = [] } = current;
  timers.forEach((t) => clearInterval(t));
  const now = ctx.currentTime;
  try {
    out.gain.cancelScheduledValues(now);
    out.gain.setValueAtTime(out.gain.value, now);
    out.gain.linearRampToValueAtTime(0.0001, now + fade);
  } catch (_) {}
  setTimeout(() => {
    nodes.forEach((n) => {
      try {
        if (n.stop) n.stop();
        if (n.disconnect) n.disconnect();
      } catch (_) {}
    });
    try {
      out.disconnect();
    } catch (_) {}
  }, fade * 1000 + 80);
  current = null;
}

function play(preset) {
  ensureCtx();
  if (!PRESETS[preset]) preset = 'rain';
  if (current && currentPreset === preset) return;
  stopCurrent(0.5);
  currentPreset = preset;

  const out = ctx.createGain();
  out.gain.value = 0.0001;
  out.connect(master);
  const built = PRESETS[preset].build(out);
  const nodes = Array.isArray(built) ? built : built.nodes;
  const timers = (Array.isArray(built) ? [] : built.timers) || [];

  const now = ctx.currentTime;
  out.gain.exponentialRampToValueAtTime(1, now + 1.2);
  current = { out, nodes, timers };
}

function pause() {
  stopCurrent(0.6);
  currentPreset = null;
}

function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (master) {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(volume * 0.9, now + 0.15);
  }
}

/* 阶段提示音 */
function chime(kind = 'focus-end') {
  ensureCtx();
  const now = ctx.currentTime;
  const notes = kind === 'focus-end' ? [784, 1046.5] : [659.25, 880];
  notes.forEach((f, i) => {
    const t0 = now + i * 0.18;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = f;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.22, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 1);
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== 'offscreen') return;
  try {
    switch (msg.cmd) {
      case 'music-play':
        if (msg.volume !== undefined) setVolume(msg.volume);
        play(msg.preset || 'rain');
        break;
      case 'music-pause':
        pause();
        break;
      case 'music-volume':
        setVolume(msg.volume);
        break;
      case 'music-stop-all':
        pause();
        break;
      case 'chime':
        chime(msg.kind);
        break;
      case 'ping':
        sendResponse({ ok: true, preset: currentPreset });
        return true;
    }
    sendResponse({ ok: true });
  } catch (e) {
    sendResponse({ ok: false, error: String(e) });
  }
  return true;
});
