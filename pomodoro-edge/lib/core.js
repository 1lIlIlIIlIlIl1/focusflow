// ZsFocus 共享核心：数据模型、存储封装、时间与统计计算
// 被 popup / dashboard / background 共同引用（ES module）

export const KEYS = {
  state: 'ff_state',
  settings: 'ff_settings',
  sessions: 'ff_sessions',
  music: 'ff_music',
};

export const ACCENT = '#FF6B4A';

export const DEFAULT_TYPES = [
  { id: 'study', name: '学习', color: '#6E9BFF' },
  { id: 'work', name: '工作', color: '#9B8CFF' },
  { id: 'watch', name: '看视频', color: '#4FC3F7' },
  { id: 'fun', name: '娱乐', color: '#FF7AB6' },
  { id: 'read', name: '阅读', color: '#45D6A0' },
];

export const DEFAULT_SETTINGS = {
  types: DEFAULT_TYPES,
  focusMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  roundsBeforeLong: 4,
  autoStartBreak: false,
  autoStartFocus: false,
  soundOn: true,
  notifyOn: true,
  dailyGoalMin: 120,
  musicPreset: 'rain',
  musicVolume: 0.5,
  musicAutoPlay: true,
};

export const PHASE_LABEL = {
  focus: '专注',
  shortBreak: '短休息',
  longBreak: '长休息',
};

export function idleState(settings = DEFAULT_SETTINGS) {
  const type = settings.types[0] || DEFAULT_TYPES[0];
  return {
    phase: 'focus',
    typeId: type.id,
    typeName: type.name,
    color: type.color,
    totalSec: settings.focusMin * 60,
    remainingSec: settings.focusMin * 60,
    endAt: null,
    startedAt: null,
    status: 'idle',
    round: 1,
    doneToday: 0,
  };
}

// ---------- 存储 ----------
const area = () => chrome.storage.local;

export const store = {
  async get(key, fallback) {
    const o = await area().get(key);
    return o[key] === undefined ? fallback : o[key];
  },
  async set(key, val) {
    await area().set({ [key]: val });
  },
  async getSettings() {
    const saved = await this.get(KEYS.settings, {});
    return { ...DEFAULT_SETTINGS, ...saved, types: saved.types || DEFAULT_SETTINGS.types };
  },
  async getState() {
    const saved = await this.get(KEYS.state, null);
    const settings = await this.getSettings();
    return saved || idleState(settings);
  },
  async getSessions() {
    return await this.get(KEYS.sessions, []);
  },
  async getMusic() {
    return await this.get(KEYS.music, {
      playing: false,
      preset: 'rain',
      volume: 0.5,
    });
  },
};

// ---------- 时间 ----------
export function remainingOf(state, now = Date.now()) {
  if (state.status === 'running' && state.endAt) {
    return Math.max(0, Math.round((state.endAt - now) / 1000));
  }
  return Math.max(0, state.remainingSec | 0);
}

export function progressOf(state, now = Date.now()) {
  if (!state.totalSec) return 0;
  return Math.min(1, Math.max(0, 1 - remainingOf(state, now) / state.totalSec));
}

export function formatClock(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  return h > 0
    ? `${h}:${mm}:${String(s).padStart(2, '0')}`
    : `${mm}:${String(s).padStart(2, '0')}`;
}

export function formatDuration(min) {
  min = Math.round(min);
  if (min < 60) return `${min} 分钟`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`;
}

export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// 周一为一周起点
export function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const wd = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - wd);
  return x;
}

export function startOfMonth(d = new Date()) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// ---------- 统计 ----------
export function filterSessions(sessions, from, to) {
  const a = from.getTime();
  const b = to.getTime();
  return sessions.filter((s) => s.end >= a && s.end < b);
}

export function sumMinutes(sessions) {
  return sessions.reduce((acc, s) => acc + (s.sec || 0), 0) / 60;
}

export function groupByType(sessions, types = []) {
  const map = new Map();
  for (const s of sessions) {
    const cur = map.get(s.typeId) || {
      id: s.typeId,
      name: s.typeName || '未分类',
      color: s.color || '#888888',
      sessions: 0,
      sec: 0,
    };
    cur.sessions += 1;
    cur.sec += s.sec || 0;
    // 用设置里的最新名称/颜色，找不到则用历史快照
    const t = types.find((x) => x.id === s.typeId);
    if (t) {
      cur.name = t.name;
      cur.color = t.color;
    }
    map.set(s.typeId, cur);
  }
  return [...map.values()]
    .map((v) => ({ ...v, minutes: v.sec / 60 }))
    .sort((a, b) => b.sec - a.sec);
}

export function dailySeries(sessions, from, days) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(startOfDay(from), i);
    const next = addDays(d, 1);
    const list = filterSessions(sessions, d, next);
    out.push({
      date: d,
      key: dayKey(d),
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      weekday: '一二三四五六日'[(d.getDay() + 6) % 7],
      minutes: sumMinutes(list),
      count: list.length,
    });
  }
  return out;
}

// 连续打卡天数（当天有 >=1 个完成的专注段即算）
export function streakDays(sessions) {
  const keys = new Set(sessions.map((s) => s.date || dayKey(new Date(s.end))));
  let streak = 0;
  let cursor = startOfDay(new Date());
  if (!keys.has(dayKey(cursor))) {
    cursor = addDays(cursor, -1);
    if (!keys.has(dayKey(cursor))) return 0;
  }
  while (keys.has(dayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

export function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}
