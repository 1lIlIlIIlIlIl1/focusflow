// FocusFlow 报告与设置页
import {
  store, KEYS, DEFAULT_SETTINGS, DEFAULT_TYPES, PHASE_LABEL,
  startOfDay, startOfWeek, startOfMonth, addDays, dayKey,
  filterSessions, sumMinutes, groupByType, dailySeries, streakDays, uid, clamp,
} from './lib/core.js';

const $ = (id) => document.getElementById(id);
const PALETTE = ['#6E9BFF', '#9B8CFF', '#4FC3F7', '#FF7AB6', '#45D6A0', '#FFB35C', '#8FD3C7', '#A0A8FF'];

let settings = { ...DEFAULT_SETTINGS };
let state = null;
let sessions = [];
let rangeMode = 'today';
let currentTab = 'report';

function send(cmd, extra = {}) {
  return chrome.runtime.sendMessage({ cmd, ...extra }).catch(() => null);
}

/* ================= 范围 ================= */
function getRange(mode) {
  const now = new Date();
  const today = startOfDay(now);
  if (mode === 'today') return { from: today, to: addDays(today, 1), days: 1, unit: 'hour' };
  if (mode === 'week') {
    const from = startOfWeek(now);
    return { from, to: addDays(from, 7), days: 7, unit: 'day' };
  }
  if (mode === 'month') {
    const from = startOfMonth(now);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    return { from, to, days: Math.round((to - from) / 86400000), unit: 'day' };
  }
  if (!sessions.length) return { from: today, to: addDays(today, 1), days: 1, unit: 'hour' };
  const first = Math.min(...sessions.map((s) => s.end));
  const from = startOfDay(new Date(first));
  const to = addDays(today, 1);
  const days = Math.max(1, Math.round((to - from) / 86400000));
  return { from, to, days, unit: days > 31 ? 'day' : 'day', tail: Math.min(days, 30) };
}

function hourlySeries(list) {
  const arr = Array.from({ length: 24 }, (_, h) => ({
    label: h % 6 === 0 ? `${h}点` : '',
    short: `${h}:00`,
    minutes: 0,
    count: 0,
  }));
  for (const s of list) {
    const h = new Date(s.start).getHours();
    arr[h].minutes += (s.sec || 0) / 60;
    arr[h].count += 1;
  }
  return arr;
}

/* ================= 图表 ================= */
function niceMax(v) {
  if (v <= 0) return 30;
  const steps = [15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480, 600, 720];
  for (const s of steps) if (v <= s) return s;
  return Math.ceil(v / 120) * 120;
}

function fmtMin(m) {
  const v = Math.round(m);
  if (v < 60) return `${v} 分`;
  const h = Math.floor(v / 60);
  const r = v % 60;
  return r ? `${h} 时 ${r} 分` : `${h} 小时`;
}

let chartObserver = null;

function drawDonut(items, totalSec) {
  const size = 148;
  const r = 62;
  const sw = 16;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  if (!items.length || totalSec <= 0) {
    $('donut').innerHTML = `<svg width="${size}" height="${size}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1c2029" stroke-width="${sw}"/></svg>
      <div class="donut-center"><div class="big">—</div><div class="small">暂无数据</div></div>`;
    $('legend').innerHTML = '';
    $('donutHint').textContent = '';
    return;
  }

  let offset = 0;
  const segs = items.map((d) => {
    const len = Math.max(0, (d.sec / totalSec) * c);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const html = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color}" stroke-width="${sw}"
      stroke-dasharray="${Math.max(0.01, len - 1.5)} ${c}" stroke-dashoffset="${-offset}"
      transform="rotate(-90 ${cx} ${cy})" stroke-linecap="round"/>`;
    offset += len;
    return html;
  });

  $('donut').innerHTML = `<svg width="${size}" height="${size}">${segs.join('')}</svg>
    <div class="donut-center">
      <div class="big num">${(totalSec / 3600).toFixed(1)}</div>
      <div class="small">小时</div>
    </div>`;

  const totalMin = totalSec / 60;
  $('legend').innerHTML = items
    .slice(0, 6)
    .map(
      (d) => `<div class="legend-item">
        <span class="legend-dot" style="background:${d.color}"></span>
        <span class="legend-name">${escapeHtml(d.name)}</span>
        <span class="legend-val num">${Math.round(d.minutes)}′ · ${Math.round((d.minutes / totalMin) * 100)}%</span>
      </div>`
    )
    .join('');
  $('donutHint').textContent = `${items.length} 种用途`;
}

function drawBars(container, items, opts = {}) {
  const W = Math.max(240, container.clientWidth || 520);
  const H = opts.height || 196;
  const padL = 30;
  const padR = 6;
  const padT = 10;
  const padB = 20;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const max = niceMax(Math.max(...items.map((i) => i.minutes), 0));
  const n = items.length;
  const step = plotW / n;
  const bw = Math.max(3, Math.min(26, step * 0.58));
  const color = opts.color || '#FF6B4A';

  const grid = [];
  for (let i = 0; i <= 3; i++) {
    const y = padT + (plotH / 3) * i;
    const val = Math.round(max - (max / 3) * i);
    grid.push(
      `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#20252e" stroke-width="1"/>` +
        `<text x="${padL - 8}" y="${y + 3.5}" text-anchor="end" font-size="10" fill="#5f6675">${val}</text>`
    );
  }

  const bars = items.map((it, i) => {
    const h = max > 0 ? (it.minutes / max) * plotH : 0;
    const x = padL + step * i + (step - bw) / 2;
    const y = padT + plotH - Math.max(h, it.minutes > 0 ? 2 : 0);
    const bh = Math.max(h, it.minutes > 0 ? 2 : 0);
    const fill = it.minutes > 0 ? color : '#20252e';
    const label = it.label
      ? `<text x="${padL + step * i + step / 2}" y="${H - 5}" text-anchor="middle" font-size="10" fill="#5f6675">${escapeHtml(it.label)}</text>`
      : '';
    return `<rect class="bar-rect" data-i="${i}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${fill}"/>${label}`;
  });

  container.innerHTML = `<svg width="${W}" height="${H}">${grid.join('')}${bars.join('')}
    <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#2b313d" stroke-width="1"/>
  </svg><div class="tooltip" id="tt"></div>`;

  const tt = container.querySelector('#tt');
  container.querySelector('svg').addEventListener('mousemove', (e) => {
    const rect = e.target.closest('.bar-rect');
    if (!rect) {
      tt.classList.remove('show');
      return;
    }
    const it = items[Number(rect.dataset.i)];
    const box = container.getBoundingClientRect();
    tt.innerHTML = `<b>${escapeHtml(it.short || it.label || '')}</b> · ${fmtMin(it.minutes)}${it.count ? ` · ${it.count} 次` : ''}`;
    tt.style.left = `${clamp(e.clientX - box.left - 40, 4, box.width - 140)}px`;
    tt.style.top = `${e.clientY - box.top - 34}px`;
    tt.classList.add('show');
  });
  container.querySelector('svg').addEventListener('mouseleave', () => tt.classList.remove('show'));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ================= 渲染报告 ================= */
function renderReport() {
  const range = getRange(rangeMode);
  let list = filterSessions(sessions, range.from, range.to);
  const totalMin = sumMinutes(list);
  const totalSec = list.reduce((a, s) => a + (s.sec || 0), 0);

  // 概览
  $('statTotal').innerHTML = totalMin >= 60
    ? `${(totalMin / 60).toFixed(1)}<span class="unit">小时</span>`
    : `${Math.round(totalMin)}<span class="unit">分钟</span>`;
  $('statTotalSub').textContent = `共 ${list.length} 个番茄`;

  const today = startOfDay(new Date());
  const elapsedDays = rangeMode === 'all'
    ? Math.max(1, Math.round((addDays(today, 1) - range.from) / 86400000))
    : rangeMode === 'today'
    ? 1
    : Math.max(1, Math.round((addDays(today, 1) - range.from) / 86400000));
  $('statAvg').innerHTML = `${Math.round(totalMin / Math.min(elapsedDays, range.days))}<span class="unit">分钟</span>`;
  $('statAvgSub').textContent = `按 ${Math.min(elapsedDays, range.days)} 天平均`;

  const streak = streakDays(sessions);
  $('statStreak').innerHTML = `${streak}<span class="unit">天</span>`;

  const todayList = filterSessions(sessions, today, addDays(today, 1));
  const todayMin = sumMinutes(todayList);
  const goal = Math.max(1, settings.dailyGoalMin);
  const pct = clamp(Math.round((todayMin / goal) * 100), 0, 999);
  $('statGoal').innerHTML = `${pct}<span class="unit">%</span>`;
  $('goalFill').style.width = `${Math.min(100, pct)}%`;
  $('statGoalSub').textContent =
    pct >= 100
      ? `已达成 · 今日 ${Math.round(todayMin)} 分钟`
      : `目标 ${goal} 分钟 · 还差 ${Math.max(0, Math.round(goal - todayMin))} 分钟`;

  // 分布
  const grouped = groupByType(list, settings.types);
  drawDonut(grouped, totalSec);

  // 趋势（始终按天统计，避免和下方"时段分布"重复）
  let tStart, tDays, tTitle;
  if (rangeMode === 'today') {
    tStart = addDays(today, -6);
    tDays = 7;
    tTitle = '最近 7 天';
  } else if (rangeMode === 'week') {
    tStart = range.from;
    tDays = 7;
    tTitle = '本周每日专注';
  } else if (rangeMode === 'month') {
    tStart = range.from;
    tDays = range.days;
    tTitle = '本月每日专注';
  } else {
    tDays = Math.min(30, Math.max(7, Math.round((range.to - range.from) / 86400000)));
    tStart = addDays(range.to, -tDays);
    tTitle = `最近 ${tDays} 天`;
  }
  const raw = dailySeries(sessions, tStart, tDays);
  const series = raw.map((d) => ({
    ...d,
    short: `${d.label} 周${d.weekday}`,
    label:
      tDays <= 8
        ? `周${d.weekday}`
        : d.date.getDate() === 1 || d.date.getDate() % 5 === 0
        ? `${d.date.getMonth() + 1}/${d.date.getDate()}`
        : '',
  }));
  $('trendTitle').textContent = tTitle;
  $('trendHint').textContent = '单位：分钟';
  drawBars($('trendChart'), series, { height: 196 });

  // 时段分布
  const allInRange = filterSessions(sessions, range.from, range.to);
  const hourData = hourlySeries(allInRange);
  drawBars($('hourChart'), hourData, { height: 148, color: '#6E9BFF' });

  // 明细
  if (!grouped.length) {
    $('detailList').innerHTML = `<div class="empty">这个时间范围内还没有专注记录</div>`;
  } else {
    const top = Math.max(...grouped.map((g) => g.minutes));
    $('detailList').innerHTML = grouped
      .map(
        (g) => `<div class="detail-row">
          <span class="legend-dot" style="background:${g.color};width:10px;height:10px"></span>
          <span class="detail-name">${escapeHtml(g.name)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${(g.minutes / top) * 100}%;background:${g.color}"></span></span>
          <span class="detail-val num">${fmtMin(g.minutes)} · ${g.sessions} 次</span>
        </div>`
      )
      .join('');
  }

  // 最近记录
  const recent = [...sessions].sort((a, b) => b.end - a.end).slice(0, 8);
  if (!recent.length) {
    $('records').innerHTML = `<div class="empty">完成第一个番茄后，这里会出现你的专注记录</div>`;
  } else {
    $('records').innerHTML = recent
      .map((s) => {
        const d = new Date(s.start);
        const time = `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        return `<div class="rec">
          <span class="legend-dot" style="background:${s.color || '#888'};width:10px;height:10px"></span>
          <span class="rec-name">${escapeHtml(s.typeName || '专注')}</span>
          <span class="rec-time num">${time}</span>
          <span class="rec-dur num">${Math.round((s.sec || 0) / 60)} 分钟</span>
        </div>`;
      })
      .join('');
  }
}

/* ================= 设置 ================= */
function renderSettings() {
  $('setFocus').value = settings.focusMin;
  $('setShort').value = settings.shortBreakMin;
  $('setLong').value = settings.longBreakMin;
  $('setRounds').value = settings.roundsBeforeLong;
  $('setGoal').value = settings.dailyGoalMin;
  $('setAutoBreak').checked = !!settings.autoStartBreak;
  $('setAutoFocus').checked = !!settings.autoStartFocus;
  $('setSound').checked = !!settings.soundOn;
  $('setNotify').checked = !!settings.notifyOn;
  $('setMusicAuto').checked = !!settings.musicAutoPlay;
  renderTypeEditor();
}

function typeStats(typeId) {
  const list = sessions.filter((s) => s.typeId === typeId);
  return { count: list.length, minutes: sumMinutes(list) };
}

function renderTypeEditor() {
  const box = $('typeEditor');
  box.innerHTML = settings.types
    .map((t) => {
      const st = typeStats(t.id);
      return `<div class="type-row" data-id="${t.id}">
        <input type="color" value="${t.color}" data-act="color" aria-label="颜色" />
        <input type="text" value="${escapeHtml(t.name)}" data-act="name" maxlength="8" aria-label="用途名称" />
        <span class="stat-mini num">${Math.round(st.minutes)} 分钟</span>
        <button class="icon-btn" data-act="del" title="删除这个用途">
          <svg width="13" height="13" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>`;
    })
    .join('');
}

let saveTimer = null;
function showToast() {
  const t = $('saveToast');
  t.classList.add('show');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => t.classList.remove('show'), 1400);
}

async function persistSettings(patch = {}) {
  settings = { ...settings, ...patch };
  await store.set(KEYS.settings, settings);
  showToast();
  // 计时器空闲时同步当前阶段时长
  const st = await store.getState();
  if (st.status === 'idle') {
    await send('set-phase', { phase: st.phase });
    const res = await send('sync-type');
    if (res?.state) state = res.state;
  }
}

function bindSettings() {
  const numMap = {
    setFocus: 'focusMin',
    setShort: 'shortBreakMin',
    setLong: 'longBreakMin',
    setRounds: 'roundsBeforeLong',
    setGoal: 'dailyGoalMin',
  };
  for (const [id, key] of Object.entries(numMap)) {
    $(id).addEventListener('change', (e) => {
      const v = clamp(Number(e.target.value) || 1, 1, key === 'dailyGoalMin' ? 900 : 180);
      e.target.value = v;
      persistSettings({ [key]: v });
    });
  }

  const boolMap = {
    setAutoBreak: 'autoStartBreak',
    setAutoFocus: 'autoStartFocus',
    setSound: 'soundOn',
    setNotify: 'notifyOn',
    setMusicAuto: 'musicAutoPlay',
  };
  for (const [id, key] of Object.entries(boolMap)) {
    $(id).addEventListener('change', (e) => persistSettings({ [key]: e.target.checked }));
  }

  $('btnTestSound').addEventListener('click', () => send('test-sound'));
  $('btnTestNotify').addEventListener('click', () => {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'FocusFlow',
      message: '通知长这样，专注结束时会提醒你',
      priority: 2,
    });
  });

  $('typeEditor').addEventListener('change', async (e) => {
    const row = e.target.closest('.type-row');
    if (!row) return;
    const id = row.dataset.id;
    const types = settings.types.map((t) => ({ ...t }));
    const target = types.find((t) => t.id === id);
    if (!target) return;
    if (e.target.dataset.act === 'color') target.color = e.target.value;
    if (e.target.dataset.act === 'name') {
      const name = e.target.value.trim().slice(0, 8) || target.name;
      e.target.value = name;
      target.name = name;
    }
    await persistSettings({ types });
    renderTypeEditor();
    const res = await send('sync-type');
    if (res?.state) state = res.state;
  });

  $('typeEditor').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act="del"]');
    if (!btn) return;
    if (settings.types.length <= 1) {
      alert('至少保留一个用途');
      return;
    }
    const row = btn.closest('.type-row');
    const id = row.dataset.id;
    const t = settings.types.find((x) => x.id === id);
    if (!confirm(`删除用途「${t.name}」？历史记录会保留。`)) return;
    const types = settings.types.filter((x) => x.id !== id);
    await persistSettings({ types });
    renderTypeEditor();
    const res = await send('sync-type');
    if (res?.state) state = res.state;
  });

  $('btnAddType').addEventListener('click', async () => {
    if (settings.types.length >= 10) {
      alert('最多 10 个用途');
      return;
    }
    const color = PALETTE[settings.types.length % PALETTE.length];
    const types = [...settings.types, { id: uid(), name: '新用途', color }];
    await persistSettings({ types });
    renderTypeEditor();
    const inputs = $('typeEditor').querySelectorAll('input[data-act="name"]');
    const last = inputs[inputs.length - 1];
    last.focus();
    last.select();
  });

  $('btnClear').addEventListener('click', async () => {
    if (!confirm('确定清空全部专注记录？此操作不可恢复。')) return;
    await store.set(KEYS.sessions, []);
    sessions = [];
    renderReport();
    showToast();
  });

  $('btnExport').addEventListener('click', exportCsv);
  $('btnExport2').addEventListener('click', exportCsv);
}

function exportCsv() {
  if (!sessions.length) {
    alert('还没有可以导出的记录');
    return;
  }
  const rows = [['日期', '开始时间', '结束时间', '用途', '时长(分钟)']];
  for (const s of [...sessions].sort((a, b) => a.end - b.end)) {
    const a = new Date(s.start);
    const b = new Date(s.end);
    const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    rows.push([dayKey(a), hm(a), hm(b), s.typeName || '', String(Math.round((s.sec || 0) / 60))]);
  }
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `focusflow-${dayKey()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ================= 路由 ================= */
function setTab(tab) {
  currentTab = tab;
  const isReport = tab === 'report';
  $('viewReport').hidden = !isReport;
  $('viewSettings').hidden = isReport;
  $('range').style.display = isReport ? 'flex' : 'none';
  for (const b of $('tabs').querySelectorAll('button')) {
    b.classList.toggle('active', b.dataset.tab === tab);
  }
  if (isReport) renderReport();
  else renderSettings();
  history.replaceState(null, '', `#${tab}`);
}

/* ================= 启动 ================= */
async function load() {
  const [s, st, se] = await Promise.all([store.getSettings(), store.getState(), store.getSessions()]);
  settings = s;
  state = st;
  sessions = se;
}

function bindTop() {
  $('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) setTab(b.dataset.tab);
  });
  $('range').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    rangeMode = b.dataset.range;
    for (const x of $('range').querySelectorAll('button')) {
      x.classList.toggle('active', x === b);
    }
    renderReport();
  });

  let raf = null;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      if (currentTab === 'report') renderReport();
    });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[KEYS.sessions]) {
      sessions = changes[KEYS.sessions].newValue || [];
      if (currentTab === 'report') renderReport();
      else renderTypeEditor();
    }
    if (changes[KEYS.settings]) {
      settings = { ...DEFAULT_SETTINGS, ...(changes[KEYS.settings].newValue || {}) };
      if (currentTab === 'settings') renderSettings();
      else renderReport();
    }
  });
}

(async function main() {
  await load();
  bindTop();
  bindSettings();
  const hash = location.hash.replace('#', '');
  setTab(hash === 'settings' ? 'settings' : 'report');
})();
