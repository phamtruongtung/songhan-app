/* Kết nối giao diện ↔ máy chủ.
 *  - 'gas'  : trang chạy trong Google Apps Script → google.script.run.api(...)
 *  - 'http' : trang đặt nơi khác → POST tới URL web app Apps Script (APP_CONFIG.apiUrl)
 *  - 'demo' : chạy toàn bộ lõi nghiệp vụ ngay trong trình duyệt, dữ liệu ở localStorage
 * Chấm công khi mất mạng: xếp hàng trên máy, giữ giờ bấm thật, tự gửi lại khi có mạng (NFR-04). */
(function () {
  var cfg = window.APP_CONFIG || {};
  var mode = cfg.mode || (window.google && google.script && google.script.run ? 'gas' : 'demo');
  var QUEUE_KEY = 'bt_offline_queue';

  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function token() { var s = store('bt_session'); return s ? s.token : ''; }

  function transport(action, payload) {
    var tk = token();
    if (mode === 'demo') {
      return new Promise(function (resolve) { setTimeout(function () { resolve(runApiRequest(action, payload, tk)); }, 60); });
    }
    if (mode === 'gas') {
      return new Promise(function (resolve, reject) {
        google.script.run.withSuccessHandler(function (s) { resolve(JSON.parse(s)); }).withFailureHandler(reject).api(action, payload, tk);
      });
    }
    return fetch(cfg.apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, payload: payload, token: tk }) })
      .then(function (r) { return r.json(); });
  }

  function isNetworkError(e) { return !navigator.onLine || (e && /network|failed to fetch|NetworkError|Load failed/i.test(String(e.message || e))); }

  function call(action, payload) {
    return transport(action, payload || {}).then(function (res) {
      if (!res.ok && res.code === 'AUTH') { localStorage.removeItem('bt_session'); location.hash = '#/login'; }
      if (!res.ok && res.code === 'MUST_CHANGE') location.hash = '#/change-pin';
      return res;
    }, function (e) {
      return { ok: false, code: isNetworkError(e) ? 'OFFLINE' : 'SERVER', error: isNetworkError(e) ? 'Mất kết nối mạng.' : 'Lỗi kết nối: ' + (e && e.message ? e.message : e) };
    });
  }

  /* Chấm công: mất mạng thì lưu hàng đợi kèm giờ bấm thật. */
  function callQueued(action, payload) {
    payload = payload || {};
    return call(action, payload).then(function (res) {
      if (res.code !== 'OFFLINE') return res;
      var q = store(QUEUE_KEY) || [];
      payload.offlineAt = Date.now();
      q.push({ action: action, payload: payload });
      store(QUEUE_KEY, q);
      return { ok: true, queued: true, data: { warnings: ['Đang lưu tạm trên máy, sẽ tự gửi khi có mạng'] } };
    });
  }

  function flushQueue() {
    var q = store(QUEUE_KEY) || [];
    if (!q.length) return Promise.resolve(0);
    var item = q[0];
    return call(item.action, item.payload).then(function (res) {
      if (res.code === 'OFFLINE') return 0;
      q.shift(); store(QUEUE_KEY, q);
      if (!res.ok) UI.toast('Gửi chấm công lưu tạm thất bại: ' + res.error, 'err');
      else UI.toast('Đã gửi chấm công lưu tạm', 'ok');
      return flushQueue().then(function (n) { return n + 1; });
    });
  }
  window.addEventListener('online', function () { flushQueue().then(function (n) { if (n && window.App) App.refresh(); }); });

  window.Api = { call: call, callQueued: callQueued, flushQueue: flushQueue, mode: mode, queueLength: function () { return (store(QUEUE_KEY) || []).length; } };
})();
