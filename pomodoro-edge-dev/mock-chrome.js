/* 预览用：最小 chrome.* 模拟层，让真实 background.js / popup.js 能在普通网页里跑起来 */
(function () {
  if (window.chrome && window.chrome.runtime && window.chrome.runtime.id) return;

  const KEY = '__ff_store';
  let data = {};
  try {
    data = JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch (e) {
    data = {};
  }

  const TYPES = [
    ['study', '学习', '#6E9BFF'],
    ['work', '工作', '#9B8CFF'],
    ['watch', '看视频', '#4FC3F7'],
    ['fun', '娱乐', '#FF7AB6'],
    ['read', '阅读', '#45D6A0'],
  ];

  function dayKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  if (!data.ff_sessions) {
    const seed = [
      [0, 'study', 25], [0, 'work', 50], [0, 'study', 25], [0, 'watch', 25], [0, 'fun', 25],
      [1, 'study', 75], [1, 'work', 50], [2, 'read', 50], [2, 'study', 25],
      [3, 'study', 50], [3, 'fun', 25], [4, 'work', 75], [4, 'study', 25], [5, 'watch', 50],
      [6, 'study', 100], [7, 'study', 50], [7, 'read', 25], [8, 'work', 50], [9, 'fun', 25],
      [10, 'study', 75], [11, 'work', 50], [12, 'study', 25], [13, 'read', 50],
      [14, 'study', 50], [15, 'watch', 75], [16, 'study', 100], [17, 'work', 25],
      [18, 'study', 50], [19, 'fun', 50], [20, 'study', 75], [21, 'read', 25],
    ];
    const now = new Date();
    data.ff_sessions = seed.map(([daysAgo, tid, mins], i) => {
      const t = TYPES.find((x) => x[0] === tid);
      const end = new Date(now);
      end.setDate(end.getDate() - daysAgo);
      end.setHours(9 + (i % 9), (20 + i * 7) % 60, 0, 0);
      const start = new Date(end.getTime() - mins * 60000);
      return {
        id: 's' + i,
        typeId: tid,
        typeName: t[1],
        color: t[2],
        start: start.getTime(),
        end: end.getTime(),
        sec: mins * 60,
        date: dayKey(end),
      };
    });
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  const listeners = {
    message: [],
    alarm: [],
    installed: [],
    startup: [],
    changed: [],
  };

  function persist() {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function fireChanged(changes) {
    setTimeout(() => {
      listeners.changed.forEach((fn) => {
        try {
          fn(changes, 'local');
        } catch (e) {}
      });
    }, 0);
  }

  const storageArea = {
    async get(keys) {
      if (keys == null) return { ...data };
      if (typeof keys === 'string') return { [keys]: data[keys] };
      if (Array.isArray(keys)) {
        const o = {};
        keys.forEach((k) => (o[k] = data[k]));
        return o;
      }
      const o = {};
      for (const [k, def] of Object.entries(keys)) o[k] = data[k] === undefined ? def : data[k];
      return o;
    },
    async set(obj) {
      const changes = {};
      for (const [k, v] of Object.entries(obj)) {
        changes[k] = { oldValue: data[k], newValue: v };
        data[k] = v;
      }
      persist();
      fireChanged(changes);
    },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      const changes = {};
      list.forEach((k) => {
        changes[k] = { oldValue: data[k], newValue: undefined };
        delete data[k];
      });
      persist();
      fireChanged(changes);
    },
    async clear() {
      data = {};
      persist();
    },
  };

  function makeEvent(key) {
    return {
      addListener: (fn) => listeners[key].push(fn),
      removeListener: (fn) => {
        const i = listeners[key].indexOf(fn);
        if (i >= 0) listeners[key].splice(i, 1);
      },
      hasListener: (fn) => listeners[key].includes(fn),
    };
  }

  const alarms = new Map();

  window.chrome = {
    runtime: {
      id: 'preview',
      lastError: null,
      getURL: (p) => p,
      sendMessage(msg) {
        return new Promise((resolve, reject) => {
          if (msg && msg.target === 'offscreen') {
            resolve({ ok: true, note: 'audio skipped in preview' });
            return;
          }
          const subs = listeners.message.filter(
            (fn) => fn.length >= 1
          );
          if (!subs.length) {
            reject(new Error('Could not establish connection.'));
            return;
          }
          let done = false;
          const timer = setTimeout(() => {
            if (!done) resolve(undefined);
          }, 2500);
          subs.forEach((fn) => {
            try {
              fn(msg, { id: 'preview' }, (resp) => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                resolve(resp);
              });
            } catch (e) {}
          });
        });
      },
      onMessage: makeEvent('message'),
      onInstalled: makeEvent('installed'),
      onStartup: makeEvent('startup'),
      onConnect: { addListener() {} },
    },
    storage: {
      local: storageArea,
      onChanged: makeEvent('changed'),
    },
    alarms: {
      async create(name, info) {
        const old = alarms.get(name);
        if (old) {
          clearTimeout(old.t);
          clearInterval(old.i);
        }
        const fire = () => listeners.alarm.forEach((fn) => fn({ name, scheduledTime: Date.now() }));
        const rec = { t: null, i: null };
        if (info.when) {
          rec.t = setTimeout(fire, Math.max(0, info.when - Date.now()));
        }
        if (info.periodInMinutes) {
          rec.i = setInterval(fire, info.periodInMinutes * 60000);
        }
        if (info.delayInMinutes && !info.when) {
          rec.t = setTimeout(fire, info.delayInMinutes * 60000);
        }
        alarms.set(name, rec);
      },
      async clear(name) {
        const rec = alarms.get(name);
        if (rec) {
          clearTimeout(rec.t);
          clearInterval(rec.i);
          alarms.delete(name);
        }
        return true;
      },
      async clearAll() {
        alarms.forEach((r) => {
          clearTimeout(r.t);
          clearInterval(r.i);
        });
        alarms.clear();
      },
      onAlarm: makeEvent('alarm'),
    },
    action: {
      async setBadgeText(o) {
        const el = document.querySelector('.mock-badge');
        if (el) el.textContent = o.text || '';
      },
      async setBadgeBackgroundColor() {},
      async setBadgeTextColor() {},
    },
    notifications: {
      create(opts) {
        console.log('[mock notification]', opts.title, opts.message);
        return 'n1';
      },
      clear() {},
    },
    offscreen: {
      async hasDocument() {
        return false;
      },
      async createDocument() {
        return undefined;
      },
      async closeDocument() {},
    },
    tabs: {
      create(o) {
        console.log('[mock tabs.create]', o.url);
      },
    },
  };

  // 启动真实的后台逻辑
  setTimeout(() => {
    import('/background.js').catch((e) => console.warn('background import failed', e));
  }, 0);
})();
