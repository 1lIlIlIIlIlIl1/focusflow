// FocusFlow 弹窗逻辑
import {
  store, KEYS, remainingOf, formatClock, filterSessions, sumMinutes,
  startOfDay, addDays, PHASE_LABEL, DEFAULT_SETTINGS,
} from './lib/core.js';

const el = (id) => document.getElementById(id);
const R = 86;
const C = 2 * Math.PI * R;

let settings = DEFAULT_SETTINGS;
let state = null;
let music = { playing: false, preset: 'rain', volume: 0.5 };
let sessions = [];
let lastClock = '';
let lastRound = '';

const PRESET_LABEL = {
  rain: '雨声',
  fire: '篝火',
  stream: '溪流',
  space: '深空',
  white: '白噪音',
  pink: '粉红噪音',
  violet: '紫噪音',
  grey: '灰噪音',
};


function send(cmd, extra = {}) {
  return chrome.runtime.sendMessage({ cmd, ...extra }).catch(() => null);
}

/* ---------- 渲染 ---------- */
function renderTypes() {
  const box = el('types');
  box.innerHTML = '';
  for (const t of settings.types) {
    const b = document.createElement('button');
    b.className = 'type-chip' + (t.id === state.typeId ? ' active' : '');
    b.dataset.id = t.id;
    b.innerHTML = `<span class="dot" style="background:${t.color}"></span><span></span>`;
    b.lastElementChild.textContent = t.name;
    box.appendChild(b);
  }
}

function renderState() {
  const isBreak = state.phase !== 'focus';
  el('phaseLabel').textContent = isBreak
    ? PHASE_LABEL[state.phase]
    : state.status === 'idle'
    ? '准备专注'
    : state.status === 'paused'
    ? '已暂停'
    : '专注中';

  const btn = el('btnMain');
  btn.classList.toggle('running', state.status === 'running');
  btn.textContent =
    state.status === 'running'
      ? '暂停'
      : state.status === 'paused'
      ? '继续'
      : isBreak
      ? '开始休息'
      : '开始专注';

  el('dialProgress').style.stroke = isBreak ? 'url(#gradBreak)' : 'url(#gradFocus)';
  renderTypes();
  renderClock(true);
  renderRound();
}

function renderClock(force = false) {
  const rem = remainingOf(state);
  const text = formatClock(rem);
  if (force || text !== lastClock) {
    el('clock').textContent = text;
    lastClock = text;
  }
  const ratio = state.totalSec ? rem / state.totalSec : 1;
  const offset = C * (1 - Math.min(1, Math.max(0, ratio)));
  el('dialProgress').style.strokeDasharray = `${C}`;
  el('dialProgress').style.strokeDashoffset = `${offset}`;
}

function renderRound() {
  const total = Math.max(1, settings.roundsBeforeLong);
  const idx = ((state.round - 1) % total) + 1;
  const text =
    state.phase === 'focus' ? `第 ${idx} / ${total} 轮` : `${PHASE_LABEL[state.phase]} · 第 ${idx} 轮待开始`;
  if (text !== lastRound) {
    el('roundLabel').textContent = text;
    lastRound = text;
  }
}

function renderMusic() {
  const playing = !!music.playing;
  el('iconPlay').style.display = playing ? 'none' : 'block';
  el('iconPause').style.display = playing ? 'block' : 'none';
  el('btnMusic').classList.toggle('playing', playing);
  el('presetName').textContent = PRESET_LABEL[music.preset] || '雨声';
  el('volume').value = Math.round((music.volume ?? 0.5) * 100);
  for (const b of el('presetMenu').querySelectorAll('button')) {
    b.classList.toggle('active', b.dataset.preset === music.preset);
  }
}

function renderToday() {
  const from = startOfDay(new Date());
  const list = filterSessions(sessions, from, addDays(from, 1));
  const mins = Math.round(sumMinutes(list));
  el('todayMins').textContent = mins >= 60
    ? `${Math.floor(mins / 60)} 小时 ${mins % 60} 分`
    : `${mins} 分钟`;
  el('todayCount').textContent = String(list.length);
}

/* ---------- 循环 ---------- */
let finishing = false;
function tick() {
  if (state && state.status === 'running') {
    renderClock();
    // 本地兜底：后台通知到达前先把到点状态收尾
    if (remainingOf(state) <= 0 && !finishing) {
      finishing = true;
      refresh().finally(() => setTimeout(() => { finishing = false; }, 1500));
    }
  }
  requestAnimationFrame(tick);
}

/* ---------- 数据刷新 ---------- */
async function refresh() {
  const [s, st, mu, se] = await Promise.all([
    store.getSettings(),
    store.getState(),
    store.getMusic(),
    store.getSessions(),
  ]);
  const structureChanged =
    !state ||
    s.types.length !== settings.types.length ||
    st.phase !== state.phase ||
    st.status !== state.status ||
    st.typeId !== state.typeId ||
    st.totalSec !== state.totalSec ||
    st.round !== state.round;

  settings = s;
  state = st;
  music = mu;
  sessions = se;

  if (structureChanged) {
    renderState();
  } else {
    renderClock(true);
    renderRound();
  }
  renderMusic();
  renderToday();
}

/* ---------- 事件 ---------- */
function bindEvents() {
  el('types').addEventListener('click', async (e) => {
    const chip = e.target.closest('.type-chip');
    if (!chip) return;
    const res = await send('set-type', { typeId: chip.dataset.id });
    if (res?.state) {
      state = res.state;
      renderState();
    }
  });

  el('btnMain').addEventListener('click', async () => {
    const res = state.status === 'running'
      ? await send('pause')
      : await send('start');
    if (res?.state) {
      state = res.state;
      renderState();
      if (state.status === 'running') {
        const mu = await store.getMusic();
        music = mu;
        renderMusic();
      }
    }
  });

  el('btnReset').addEventListener('click', async () => {
    const res = await send('reset');
    if (res?.state) {
      state = res.state;
      renderState();
    }
  });

  el('btnSkip').addEventListener('click', async () => {
    const res = await send('skip');
    if (res?.state) {
      state = res.state;
      renderState();
    }
  });

  el('btnMusic').addEventListener('click', async () => {
    if (music.playing) {
      await send('music-pause');
      music = { ...music, playing: false };
    } else {
      await send('music-play', { preset: music.preset, volume: music.volume });
      music = { ...music, playing: true };
    }
    renderMusic();
  });

  el('btnPreset').addEventListener('click', (e) => {
    e.stopPropagation();
    el('presetMenu').classList.toggle('open');
  });

  el('presetMenu').addEventListener('click', async (e) => {
    e.stopPropagation();
    const b = e.target.closest('button');
    if (!b) return;
    music = { ...music, preset: b.dataset.preset };
    el('presetMenu').classList.remove('open');
    renderMusic();
    await send('music-preset', { preset: music.preset });
  });

  document.addEventListener('click', () => el('presetMenu').classList.remove('open'));

  let volTimer = null;
  el('volume').addEventListener('input', (e) => {
    const v = Number(e.target.value) / 100;
    music = { ...music, volume: v };
    clearTimeout(volTimer);
    volTimer = setTimeout(() => send('music-volume', { volume: v }), 90);
  });

  const openDashboard = (hash = '') => {
    chrome.tabs.create({ url: chrome.runtime.getURL(`dashboard.html${hash}`) });
    window.close();
  };
  el('btnReport').addEventListener('click', () => openDashboard('#report'));
  el('btnOpenReport').addEventListener('click', () => openDashboard('#report'));
  el('btnSettings').addEventListener('click', () => openDashboard('#settings'));

  // 后台状态变化（到点、自动切换）实时同步
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes[KEYS.state] || changes[KEYS.settings] || changes[KEYS.sessions] || changes[KEYS.music]) {
      refresh();
    }
  });
}

/* ---------- 启动 ---------- */
(async function main() {
  await refresh();
  bindEvents();
  el('dialProgress').style.strokeDasharray = `${C}`;
  renderClock(true);
  requestAnimationFrame(tick);
})();
