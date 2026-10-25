// 纯函数测试：时间计算与统计
import assert from 'node:assert/strict';
import {
  formatClock, formatDuration, remainingOf, progressOf, dayKey,
  startOfDay, startOfWeek, addDays, filterSessions, sumMinutes,
  groupByType, dailySeries, streakDays, DEFAULT_TYPES,
} from '../pomodoro-edge/lib/core.js';

let pass = 0;
function t(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ok  ' + name);
  } catch (e) {
    console.log('  FAIL ' + name + '\n       ' + e.message);
    process.exitCode = 1;
  }
}

console.log('format');
t('formatClock 25 分钟', () => assert.equal(formatClock(1500), '25:00'));
t('formatClock 9 秒补零', () => assert.equal(formatClock(9), '00:09'));
t('formatClock 超过一小时', () => assert.equal(formatClock(3725), '1:02:05'));
t('formatClock 负数归零', () => assert.equal(formatClock(-5), '00:00'));
t('formatDuration 分钟', () => assert.equal(formatDuration(45), '45 分钟'));
t('formatDuration 小时', () => assert.equal(formatDuration(90), '1 小时 30 分'));
t('formatDuration 整小时', () => assert.equal(formatDuration(120), '2 小时'));

console.log('remaining / progress');
const base = {
  totalSec: 1500,
  remainingSec: 1500,
  endAt: null,
  status: 'idle',
};
t('idle 用 remainingSec', () => assert.equal(remainingOf(base), 1500));
t('running 用 endAt 推算', () => {
  const now = 1_000_000;
  const s = { ...base, status: 'running', endAt: now + 90_000 };
  assert.equal(remainingOf(s, now), 90);
});
t('running 到点不为负', () => {
  const now = 1_000_000;
  const s = { ...base, status: 'running', endAt: now - 5000 };
  assert.equal(remainingOf(s, now), 0);
});
t('progress 一半', () => {
  const now = 1_000_000;
  const s = { totalSec: 100, status: 'running', endAt: now + 50_000, remainingSec: 50 };
  assert.equal(progressOf(s, now), 0.5);
});

console.log('date');
t('dayKey 格式', () => assert.equal(dayKey(new Date(2026, 0, 5)), '2026-01-05'));
t('startOfWeek 周一', () => {
  const d = new Date(2026, 9, 25); // 2026-10-25 是周日
  assert.equal(dayKey(startOfWeek(d)), '2026-10-19');
});
t('addDays 跨月', () => {
  const d = new Date(2026, 9, 31);
  assert.equal(dayKey(addDays(d, 1)), '2026-11-01');
});

console.log('stats');
const mk = (daysAgo, typeId, mins, hour = 10) => {
  const end = new Date(2026, 9, 25, hour, 0, 0, 0);
  end.setDate(end.getDate() - daysAgo);
  return {
    id: 'x' + daysAgo + typeId + mins,
    typeId,
    typeName: DEFAULT_TYPES.find((t) => t.id === typeId)?.name || '?',
    color: '#fff',
    start: end.getTime() - mins * 60000,
    end: end.getTime(),
    sec: mins * 60,
    date: dayKey(end),
  };
};

const sessions = [
  mk(0, 'study', 25, 9),
  mk(0, 'study', 25, 11),
  mk(0, 'work', 50, 14),
  mk(1, 'study', 25, 10),
  mk(2, 'fun', 25, 20),
];

t('filterSessions 今日', () => {
  const from = new Date(2026, 9, 25);
  assert.equal(filterSessions(sessions, from, addDays(from, 1)).length, 3);
});
t('filterSessions 不含上界', () => {
  const from = new Date(2026, 9, 25);
  const tomorrow = addDays(from, 1);
  assert.equal(filterSessions(sessions, tomorrow, addDays(from, 2)).length, 0);
});
t('sumMinutes', () => assert.equal(sumMinutes(sessions), 150));
t('groupByType 排序与占比', () => {
  const g = groupByType(sessions, DEFAULT_TYPES);
  assert.equal(g[0].id, 'study');
  assert.equal(g[0].sessions, 3);
  assert.equal(Math.round(g[0].minutes), 75);
  assert.equal(g.length, 3);
});
t('groupByType 使用设置里的新名字', () => {
  const renamed = DEFAULT_TYPES.map((x) => (x.id === 'study' ? { ...x, name: '深度学习' } : x));
  const g = groupByType(sessions, renamed);
  assert.equal(g.find((x) => x.id === 'study').name, '深度学习');
});
t('dailySeries 长度与归零', () => {
  const s = dailySeries(sessions, new Date(2026, 9, 21), 5);
  assert.equal(s.length, 5);
  assert.equal(s[s.length - 1].minutes, 100);
  assert.equal(s[0].minutes, 0);
});

console.log('streak');
t('连续 3 天', () => {
  const today = new Date();
  const list = [0, 1, 2].map((d) => {
    const e = new Date(today);
    e.setDate(e.getDate() - d);
    return { end: e.getTime(), sec: 1500, date: dayKey(e) };
  });
  assert.equal(streakDays(list), 3);
});
t('今天没记录但昨天有 → 从昨天算', () => {
  const today = new Date();
  const e = new Date(today);
  e.setDate(e.getDate() - 1);
  assert.equal(streakDays([{ end: e.getTime(), sec: 1500, date: dayKey(e) }]), 1);
});
t('断档则中断', () => {
  const today = new Date();
  const mk2 = (d) => {
    const e = new Date(today);
    e.setDate(e.getDate() - d);
    return { end: e.getTime(), sec: 1500, date: dayKey(e) };
  };
  assert.equal(streakDays([mk2(0), mk2(1), mk2(3)]), 2);
});
t('空数据', () => assert.equal(streakDays([]), 0));

console.log(`\n${pass} passed, failures: ${process.exitCode ? 'yes' : 'none'}`);
