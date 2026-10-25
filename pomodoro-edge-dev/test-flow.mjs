// 状态机集成测试：用模拟的 chrome.* 驱动真实 background.js
import assert from 'node:assert/strict';

const mem = {};
const createdAlarms = {};
const listeners = { alarm: [], message: [], installed: [], startup: [], changed: [] };
const badges = [];

globalThis.chrome = {
  storage: {
    local: {
      async get(keys) {
        if (keys == null) return { ...mem };
        if (typeof keys === 'string') return { [keys]: mem[keys] };
        if (Array.isArray(keys)) {
          const o = {};
          keys.forEach((k) => (o[k] = mem[k]));
          return o;
        }
        const o = {};
        for (const [k, d] of Object.entries(keys)) o[k] = mem[k] === undefined ? d : mem[k];
        return o;
      },
      async set(obj) {
        Object.assign(mem, JSON.parse(JSON.stringify(obj)));
      },
    },
    onChanged: { addListener() {} },
  },
  alarms: {
    async create(name, info) {
      createdAlarms[name] = info;
    },
    async clear(name) {
      delete createdAlarms[name];
      return true;
    },
    onAlarm: { addListener: (f) => listeners.alarm.push(f) },
  },
  action: {
    async setBadgeText(o) {
      badges.push(o.text);
    },
    async setBadgeBackgroundColor() {},
    async setBadgeTextColor() {},
  },
  notifications: { create() {} },
  offscreen: {
    async hasDocument() {
      return true;
    },
    async createDocument() {},
  },
  runtime: {
    id: 'test',
    getURL: (p) => p,
    async sendMessage(msg) {
      if (msg && msg.target === 'offscreen') return { ok: true };
      return sendMsg(msg);
    },
    onMessage: { addListener: (f) => listeners.message.push(f) },
    onInstalled: { addListener: (f) => listeners.installed.push(f) },
    onStartup: { addListener: (f) => listeners.startup.push(f) },
  },
  tabs: { create() {} },
};

function sendMsg(msg) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) resolve(undefined);
    }, 4000);
    for (const fn of listeners.message) {
      try {
        fn(msg, {}, (resp) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(resp);
        });
      } catch (e) {
        /* ignore */
      }
    }
  });
}

function fireAlarm(name) {
  return Promise.all(listeners.alarm.map((f) => f({ name })));
}

const near = (a, b, tol) => Math.abs(a - b) <= tol;

function t(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log('  ok  ' + name))
    .catch((e) => {
      console.log('  FAIL ' + name + '\n       ' + e.message);
      process.exitCode = 1;
    });
}

await import('../pomodoro-edge/background.js');
await new Promise((r) => setTimeout(r, 120));

console.log('启动');
await t('初始为空闲、25 分钟、第一个用途', async () => {
  const r = await sendMsg({ cmd: 'get' });
  assert.equal(r.state.status, 'idle');
  assert.equal(r.state.totalSec, 1500);
  assert.equal(r.state.typeId, 'study');
});

console.log('计时');
await t('start 后进入运行态并排好结束闹钟', async () => {
  const r = await sendMsg({ cmd: 'start' });
  assert.equal(r.state.status, 'running');
  assert.ok(r.state.endAt > Date.now() + 1490 * 1000, 'endAt 应为 25 分钟后');
  assert.ok(createdAlarms['ff-finish'], '应创建结束闹钟');
  assert.ok(createdAlarms['ff-tick'], '应创建分钟闹钟');
});

await t('pause 冻结剩余秒数', async () => {
  const r = await sendMsg({ cmd: 'pause' });
  assert.equal(r.state.status, 'paused');
  assert.equal(r.state.endAt, null);
  assert.ok(r.state.remainingSec >= 1490 && r.state.remainingSec <= 1500);
  assert.equal(createdAlarms['ff-finish'], undefined, '暂停时应清除结束闹钟');
});

await t('继续时接着剩余时间而不是重置', async () => {
  const before = mem.ff_state.remainingSec;
  const r = await sendMsg({ cmd: 'start' });
  assert.equal(r.state.status, 'running');
  const leftSec = Math.round((r.state.endAt - Date.now()) / 1000);
  assert.ok(near(leftSec, before, 2), `剩余应约 ${before} 秒，实际 ${leftSec}`);
});

await t('reset 回到满时长', async () => {
  const r = await sendMsg({ cmd: 'reset' });
  assert.equal(r.state.status, 'idle');
  assert.equal(r.state.remainingSec, 1500);
});

console.log('阶段完成');
await t('专注到点后记一条记录并进入短休息', async () => {
  await sendMsg({ cmd: 'start' });
  // 把结束时间调到过去，模拟时间到
  const st = { ...mem.ff_state, endAt: Date.now() - 1200 };
  mem.ff_state = st;
  await fireAlarm('ff-finish');

  const sessions = mem.ff_sessions || [];
  assert.equal(sessions.length, 1, '应记录 1 条');
  assert.equal(sessions[0].sec, 1500);
  assert.equal(sessions[0].typeId, 'study');
  assert.equal(sessions[0].typeName, '学习');
  assert.ok(sessions[0].date, '应有日期字段');

  assert.equal(mem.ff_state.phase, 'shortBreak');
  assert.equal(mem.ff_state.status, 'idle');
  assert.equal(mem.ff_state.totalSec, 300, '短休息默认 5 分钟');
  assert.equal(mem.ff_state.round, 2);
});

await t('休息到点后回到专注且不再记录', async () => {
  await sendMsg({ cmd: 'start' });
  mem.ff_state = { ...mem.ff_state, endAt: Date.now() - 1200 };
  await fireAlarm('ff-finish');
  assert.equal(mem.ff_sessions.length, 1, '休息不应产生记录');
  assert.equal(mem.ff_state.phase, 'focus');
});

await t('重复触发闹钟不会重复记录', async () => {
  await fireAlarm('ff-finish');
  assert.equal(mem.ff_sessions.length, 1);
});

console.log('用途与时长');
await t('切换用途同步名称与颜色', async () => {
  const r = await sendMsg({ cmd: 'set-type', typeId: 'watch' });
  assert.equal(r.state.typeId, 'watch');
  assert.equal(r.state.typeName, '看视频');
  assert.equal(r.state.color, '#4FC3F7');
});

await t('改时长后重置为空闲', async () => {
  const r = await sendMsg({ cmd: 'set-duration', minutes: 45 });
  assert.equal(r.state.totalSec, 2700);
  assert.equal(r.state.status, 'idle');
});

await t('类型被移除后 sync-type 回落到第一个用途', async () => {
  const settings = { ...mem.ff_settings };
  settings.types = settings.types.filter((x) => x.id !== 'watch');
  delete mem.ff_state.typeName;
  mem.ff_settings = settings;
  mem.ff_state = { ...mem.ff_state, typeId: 'watch', typeName: '看视频' };
  const r = await sendMsg({ cmd: 'sync-type' });
  assert.equal(r.state.typeId, 'study');
});

console.log('跳过');
await t('skip 不进记录且切换阶段', async () => {
  await sendMsg({ cmd: 'set-phase', phase: 'focus' });
  const before = mem.ff_sessions.length;
  const r = await sendMsg({ cmd: 'skip' });
  assert.equal(mem.ff_sessions.length, before, '跳过不应产生记录');
  assert.equal(r.state.phase, 'shortBreak');
});

console.log('角标');
await t('运行中角标显示剩余分钟', async () => {
  await sendMsg({ cmd: 'start' });
  const text = badges[badges.length - 1];
  assert.ok(/^\d+$/.test(text), '角标应为数字，实际: ' + text);
});

await t('暂停时角标为 II', async () => {
  await sendMsg({ cmd: 'pause' });
  assert.equal(badges[badges.length - 1], 'II');
});

console.log(`\nfailures: ${process.exitCode ? 'yes' : 'none'}`);
