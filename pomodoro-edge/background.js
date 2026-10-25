// ZsFocus 后台服务 (MV3 service worker)
// 职责：计时状态机、alarms 调度、图标角标、阶段完成通知、音频引擎生命周期
import {
  KEYS, store, idleState, remainingOf, dayKey, uid,
  DEFAULT_SETTINGS, PHASE_LABEL,
} from './lib/core.js';

const TICK = 'ff-tick';
const FINISH = 'ff-finish';
const OFFSCREEN_PATH = 'offscreen.html';

/* ---------------- 工具 ---------------- */
function durationFor(phase, settings) {
  const min =
    phase === 'focus'
      ? settings.focusMin
      : phase === 'shortBreak'
      ? settings.shortBreakMin
      : settings.longBreakMin;
  return Math.max(1, Math.round(min)) * 60;
}

async function setState(state) {
  await store.set(KEYS.state, state);
  await syncAlarms(state);
  await updateBadge(state);
  return state;
}

async function syncAlarms(state) {
  await chrome.alarms.clear(FINISH);
  await chrome.alarms.clear(TICK);

  if (state.status !== 'running') return;

  await chrome.alarms.create(TICK, { periodInMinutes: 1, delayInMinutes: 1 });
  const when = Math.max(Date.now() + 1000, state.endAt);
  await chrome.alarms.create(FINISH, { when });
}

async function updateBadge(state) {
  const rem = remainingOf(state);
  let text = '';
  let color = '#FF6B4A';
  if (state.status === 'running') {
    const min = Math.ceil(rem / 60);
    text = min > 99 ? '99+' : String(min);
    color = state.phase === 'focus' ? '#FF6B4A' : '#2E9E78';
  } else if (state.status === 'paused') {
    text = 'II';
    color = '#8A8F9C';
  }
  try {
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color });
    if (chrome.action.setBadgeTextColor) {
      await chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
    }
  } catch (_) {}
}

/* ---------------- 音频引擎 ---------------- */
async function ensureOffscreen() {
  if (chrome.offscreen.hasDocument) {
    if (await chrome.offscreen.hasDocument()) return true;
  }
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ['AUDIO_PLAYBACK'],
      justification: '播放沉浸式氛围音与阶段提醒音',
    });
    return true;
  } catch (e) {
    if (String(e).includes('Only a single offscreen')) return true;
    console.warn('offscreen 创建失败', e);
    return false;
  }
}

async function toOffscreen(payload) {
  const ok = await ensureOffscreen();
  if (!ok) return;
  try {
    await chrome.runtime.sendMessage({ target: 'offscreen', ...payload });
  } catch (e) {
    // 文档刚创建时偶发接收者未就绪，重试一次
    await new Promise((r) => setTimeout(r, 120));
    try {
      await chrome.runtime.sendMessage({ target: 'offscreen', ...payload });
    } catch (_) {}
  }
}

/* ---------------- 阶段流转 ---------------- */
async function completePhase(reason = 'timer') {
  const settings = await store.getSettings();
  let state = await store.getState();
  if (reason === 'timer' && state.status !== 'running') return state;

  const now = Date.now();
  const finishedPhase = state.phase;
  const finishedSec = state.totalSec;
  let sessions = await store.getSessions();
  let round = state.round || 1;
  let nextPhase;

  if (finishedPhase === 'focus') {
    // 跳过不计数；过短的片段（<60 秒）也不计入，避免误触污染数据
    if (reason === 'timer' && finishedSec >= 60) {
      sessions.push({
        id: uid(),
        typeId: state.typeId,
        typeName: state.typeName,
        color: state.color,
        start: state.startedAt || now - finishedSec * 1000,
        end: now,
        sec: finishedSec,
        date: dayKey(new Date(now)),
      });
      await store.set(KEYS.sessions, sessions);
      round = round + 1;
    }
    const needLong = (round - 1) % Math.max(1, settings.roundsBeforeLong) === 0 && round > 1;
    nextPhase = needLong ? 'longBreak' : 'shortBreak';
  } else {
    nextPhase = 'focus';
  }

  const totalSec = durationFor(nextPhase, settings);
  state = {
    ...state,
    phase: nextPhase,
    status: 'idle',
    totalSec,
    remainingSec: totalSec,
    endAt: null,
    startedAt: null,
    round,
    lastCompletedAt: now,
  };
  await setState(state);

  if (reason === 'timer') {
    if (settings.notifyOn) {
      if (finishedPhase === 'focus') {
        notify('专注完成', `刚刚专注了 ${Math.round(finishedSec / 60)} 分钟，去${PHASE_LABEL[nextPhase]}一下吧`);
      } else {
        notify('休息结束', '准备好了就继续下一轮专注');
      }
    }
    if (settings.soundOn) {
      await toOffscreen({ cmd: 'chime', kind: finishedPhase === 'focus' ? 'focus-end' : 'break-end' });
    }
  }

  const auto = nextPhase === 'focus' ? settings.autoStartFocus : settings.autoStartBreak;
  if (auto) return startPhase(state, settings);
  return state;
}

function notify(title, message) {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title,
      message,
      priority: 2,
    });
  } catch (_) {}
}

async function startPhase(state, settings) {
  const totalSec = state.totalSec || durationFor(state.phase, settings);
  // 暂停后继续：从剩余时间接着走，不重置
  const remain =
    state.status === 'paused'
      ? Math.max(1, Math.min(state.remainingSec || totalSec, totalSec))
      : totalSec;
  const now = Date.now();
  const next = {
    ...state,
    status: 'running',
    totalSec,
    remainingSec: remain,
    startedAt: state.status === 'paused' ? state.startedAt || now : now,
    endAt: now + remain * 1000,
  };
  const saved = await setState(next);

  if (settings.musicAutoPlay && next.phase === 'focus') {
    const music = await store.getMusic();
    if (!music.playing) {
      await store.set(KEYS.music, { ...music, playing: true });
      await toOffscreen({
        cmd: 'music-play',
        preset: music.preset,
        volume: music.volume,
      });
    }
  }
  return saved;
}

/* ---------------- 消息处理 ---------------- */
async function handle(msg) {
  const settings = await store.getSettings();
  let state = await store.getState();

  switch (msg.cmd) {
    case 'start': {
      if (state.status === 'running') return { ok: true, state };
      state = await startPhase(state, settings);
      return { ok: true, state };
    }
    case 'pause': {
      if (state.status !== 'running') return { ok: true, state };
      const rem = remainingOf(state);
      state = { ...state, status: 'paused', remainingSec: rem, endAt: null };
      return { ok: true, state: await setState(state) };
    }
    case 'reset': {
      const totalSec = state.totalSec || durationFor(state.phase, settings);
      state = {
        ...state,
        status: 'idle',
        remainingSec: totalSec,
        endAt: null,
        startedAt: null,
      };
      return { ok: true, state: await setState(state) };
    }
    case 'skip': {
      state = await completePhase('skip');
      return { ok: true, state };
    }
    case 'set-type': {
      const t = settings.types.find((x) => x.id === msg.typeId);
      if (!t) return { ok: false, state };
      state = { ...state, typeId: t.id, typeName: t.name, color: t.color };
      return { ok: true, state: await setState(state) };
    }
    case 'sync-type': {
      const t = settings.types.find((x) => x.id === state.typeId);
      if (!t) {
        const first = settings.types[0];
        if (!first) return { ok: true, state };
        state = { ...state, typeId: first.id, typeName: first.name, color: first.color };
      } else if (t.name !== state.typeName || t.color !== state.color) {
        state = { ...state, typeName: t.name, color: t.color };
      } else {
        return { ok: true, state };
      }
      return { ok: true, state: await setState(state) };
    }
    case 'set-duration': {
      const sec = Math.max(60, Math.round(msg.minutes) * 60);
      state = {
        ...state,
        totalSec: sec,
        remainingSec: sec,
        status: 'idle',
        endAt: null,
        startedAt: null,
      };
      return { ok: true, state: await setState(state) };
    }
    case 'set-phase': {
      const totalSec = durationFor(msg.phase, settings);
      state = {
        ...state,
        phase: msg.phase,
        status: 'idle',
        totalSec,
        remainingSec: totalSec,
        endAt: null,
        startedAt: null,
      };
      return { ok: true, state: await setState(state) };
    }
    case 'get': {
      return { ok: true, state };
    }
    case 'music-play': {
      const music = await store.getMusic();
      const next = { ...music, playing: true, preset: msg.preset || music.preset };
      if (msg.volume !== undefined) next.volume = msg.volume;
      await store.set(KEYS.music, next);
      await toOffscreen({ cmd: 'music-play', preset: next.preset, volume: next.volume });
      return { ok: true, music: next };
    }
    case 'music-pause': {
      const music = await store.getMusic();
      await store.set(KEYS.music, { ...music, playing: false });
      try {
        await chrome.runtime.sendMessage({ target: 'offscreen', cmd: 'music-pause' });
      } catch (_) {}
      return { ok: true, music: { ...music, playing: false } };
    }
    case 'music-preset': {
      const music = await store.getMusic();
      const next = { ...music, preset: msg.preset };
      await store.set(KEYS.music, next);
      if (next.playing) {
        await toOffscreen({ cmd: 'music-play', preset: msg.preset, volume: next.volume });
      }
      return { ok: true, music: next };
    }
    case 'music-volume': {
      const music = await store.getMusic();
      const next = { ...music, volume: msg.volume };
      await store.set(KEYS.music, next);
      await toOffscreen({ cmd: 'music-volume', volume: msg.volume });
      return { ok: true, music: next };
    }
    case 'test-sound': {
      await toOffscreen({ cmd: 'chime', kind: 'focus-end' });
      return { ok: true };
    }
    default:
      return { ok: false, error: 'unknown cmd' };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target === 'offscreen') return;
  handle(msg)
    .then((res) => sendResponse(res))
    .catch((e) => sendResponse({ ok: false, error: String(e) }));
  return true;
});

/* ---------------- alarms ---------------- */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === TICK) {
    const state = await store.getState();
    if (state.status === 'running') await updateBadge(state);
    return;
  }
  if (alarm.name === FINISH) {
    const state = await store.getState();
    if (state.status !== 'running') return;
    if (remainingOf(state) > 1) {
      // 系统休眠等原因导致提前唤醒，重新排程
      await syncAlarms(state);
      return;
    }
    await completePhase('timer');
  }
});

/* ---------------- 生命周期 ---------------- */
async function bootstrap() {
  const settings = await store.getSettings();
  await store.set(KEYS.settings, settings);

  let state = await store.getState();

  // 运行中但结束时间已过（浏览器关闭期间走完的）→ 结算
  if (state.status === 'running' && remainingOf(state) <= 0) {
    const done = await completePhase('timer');
    state = done;
  } else if (state.status === 'running') {
    await syncAlarms(state);
  }

  // 浏览器重启后不保留音乐播放态，避免幽灵状态
  const music = await store.getMusic();
  if (music.playing) {
    await store.set(KEYS.music, { ...music, playing: false });
  }
  await updateBadge(state);
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await store.set(KEYS.settings, DEFAULT_SETTINGS);
    const s = idleState(DEFAULT_SETTINGS);
    await store.set(KEYS.state, s);
    await store.set(KEYS.sessions, []);
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html#welcome') });
  }
  await bootstrap();
});

chrome.runtime.onStartup.addListener(() => {
  bootstrap();
});

// service worker 被唤醒时也跑一次轻量同步
bootstrap().catch((e) => console.warn('bootstrap', e));
