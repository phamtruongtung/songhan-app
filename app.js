/* Khung ứng dụng + màn hình nhân viên, trưởng ca (M01–M11). Màn hình chủ quán ở admin.js. */
(function () {
  var h = UI.h, money = UI.money;
  var LOGO = window.APP_LOGO || 'logo.svg';

  function session() { try { return JSON.parse(localStorage.getItem('bt_session') || 'null'); } catch (e) { return null; } }
  function setSession(s) { if (s) localStorage.setItem('bt_session', JSON.stringify(s)); else localStorage.removeItem('bt_session'); }
  function user() { var s = session(); return s ? s.user : null; }
  function isLeader() { var u = user(); return u && (u.Role === 'leader' || u.Role === 'admin'); }
  function isAdmin() { var u = user(); return u && u.Role === 'admin'; }
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

  /* Gọi API, báo lỗi chung; trả về data hoặc null. */
  function call(action, payload, opts) {
    opts = opts || {};
    return Api.call(action, payload).then(function (res) {
      if (!res.ok && !opts.raw) {
        if (res.code !== 'AUTH' && res.code !== 'MUST_CHANGE') UI.toast(res.error, 'err');
        return null;
      }
      return opts.raw ? res : res.data;
    });
  }

  function parseHash() {
    var raw = location.hash.replace(/^#\/?/, '');
    var q = {}, qi = raw.indexOf('?');
    if (qi >= 0) { raw.slice(qi + 1).split('&').forEach(function (kv) { var p = kv.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); }); raw = raw.slice(0, qi); }
    return { parts: raw.split('/').filter(String), q: q };
  }

  /* ---------- Khung ---------- */
  var app = document.getElementById('app');
  var lastHome = null;

  function topbar(extra) {
    var u = user();
    return h('header', { class: 'topbar' },
      h('button', { class: 'icon-btn menu-btn' + (extra && extra.menu ? '' : ' hidden'), 'aria-label': 'Menu', onclick: extra && extra.menu }, '☰'),
      h('img', { class: 'logo', src: LOGO, alt: '' }),
      h('div', null, h('div', { class: 'title' }, (window.STORE_NAME || 'Bê Thui Sông Hàn')),
        u ? h('div', { class: 'sub' }, u.DisplayName + ' · ' + u.RoleName) : null),
      h('div', { class: 'spacer' }),
      Api.mode === 'demo' ? h('span', { class: 'demo-flag' }, 'DEMO') : null);
  }

  function tabbar(active) {
    var u = user();
    var tabs = [['home', '🏠', 'Trang chủ']];
    if (u.Role !== 'admin') tabs.push(['my-attendance', '🕒', 'Công']);
    if (u.IsCashier) tabs.push(['my-reports', '🧾', 'Báo cáo']);
    if (isLeader()) tabs.push(['review', '✅', 'Duyệt']);
    if (isAdmin()) tabs.push(['admin', '📊', 'Quản trị']);
    tabs.push(['account', '👤', 'Tài khoản']);
    var badge = lastHome && lastHome.pendingReview ? lastHome.pendingReview : 0;
    return h('nav', { class: 'tabbar' }, tabs.map(function (t) {
      return h('a', { href: '#/' + t[0], class: active === t[0] ? 'on' : '' }, h('span', { class: 'ic' }, t[1]), t[2],
        t[0] === 'review' && badge ? h('span', { class: 'dot' }, badge) : null);
    }));
  }

  function staffLayout(active, content) {
    app.className = '';
    app.innerHTML = '';
    app.appendChild(topbar());
    if (Api.queueLength()) app.appendChild(h('div', { class: 'offline-bar' }, 'Có ' + Api.queueLength() + ' lượt chấm công đang lưu tạm, sẽ tự gửi khi có mạng.'));
    var main = h('main', null, content);
    app.appendChild(main);
    app.appendChild(tabbar(active));
    return main;
  }

  function page(active, title, back) {
    var body = h('div', { class: 'stack' });
    var head = h('div', { class: 'row' },
      back ? h('button', { class: 'icon-btn', 'aria-label': 'Quay lại', onclick: function () { history.length > 1 ? history.back() : go(back); } }, '‹') : null,
      h('h1', { class: 'grow', style: { margin: 0 } }, title));
    staffLayout(active, [head, body]);
    body.appendChild(UI.spinner());
    return body;
  }

  function clear(el) { el.innerHTML = ''; return el; }

  /* ---------- M01 Đăng nhập ---------- */
  function viewLogin() {
    app.className = '';
    var phone = h('input', { type: 'tel', inputmode: 'numeric', autocomplete: 'username', placeholder: '09xx xxx xxx' });
    var pin = h('input', { type: 'password', inputmode: 'numeric', maxlength: 6, autocomplete: 'current-password', placeholder: '6 số' });
    var err = h('div', { class: 'field-err' });
    var btn = h('button', { class: 'btn primary block big', type: 'submit' }, 'Đăng nhập');
    var form = h('form', { onsubmit: function (e) {
      e.preventDefault(); err.textContent = '';
      if (!phone.value.trim() || !pin.value) { err.textContent = 'Nhập số điện thoại và mã PIN'; return; }
      btn.disabled = true;
      Api.call('login', { phone: phone.value, pin: pin.value }).then(function (res) {
        btn.disabled = false;
        if (!res.ok) { err.textContent = res.error; return; }
        setSession(res.data);
        go(res.data.user.MustChange ? '#/change-pin' : (res.data.user.Role === 'admin' ? '#/admin' : '#/home'));
      });
    } },
      UI.field('Số điện thoại', phone), UI.field('Mã PIN', pin), err, btn,
      h('button', { type: 'button', class: 'linkish', onclick: function () {
        UI.promptBox('Quên mã PIN', 'Số điện thoại của bạn', { note: 'Chủ quán sẽ nhận yêu cầu và cấp mã PIN tạm cho bạn.', okLabel: 'Gửi yêu cầu' }).then(function (v) {
          if (!v) return;
          Api.call('requestPinReset', { phone: v }).then(function () { UI.toast('Đã gửi yêu cầu tới chủ quán'); });
        });
      } }, 'Quên mã PIN?'));
    var demo = null;
    if (Api.mode === 'demo' && window.DEMO_ACCOUNTS) {
      demo = h('div', { class: 'demo-box' },
        h('div', { class: 'alert info small', style: { marginBottom: '10px' } }, 'Bản chạy thử. Đã nạp sẵn dữ liệu Excel thật 01/08–12/10/2026. Mọi thao tác chỉ lưu trên trình duyệt của bạn. Gợi ý: đăng nhập Chủ quán để xem Dashboard, hoặc Duyên để thử chấm công và lập báo cáo ca.'),
        h('div', { class: 'small muted' }, 'Chọn tài khoản để điền sẵn, rồi bấm Đăng nhập:'),
        h('div', { class: 'seg', style: { marginTop: '6px' } }, DEMO_ACCOUNTS.map(function (a) {
          return h('button', { type: 'button', onclick: function () { phone.value = a.phone; pin.value = a.pin; } }, a.label);
        })),
        h('button', { type: 'button', class: 'linkish small', onclick: function () {
          UI.confirmBox('Đặt lại dữ liệu demo', 'Xóa mọi thao tác thử, nạp lại dữ liệu lịch sử từ Excel?', 'Đặt lại', true).then(function (ok) {
            if (!ok) return; demoSeed(true); setSession(null); UI.toast('Đã đặt lại dữ liệu demo');
          });
        } }, 'Đặt lại dữ liệu demo'));
    }
    app.innerHTML = '';
    app.appendChild(h('div', { class: 'login-wrap' }, h('div', { class: 'login-card' },
      h('img', { class: 'login-logo', src: LOGO, alt: '' }),
      h('h1', null, window.STORE_NAME || 'Bê Thui Sông Hàn'),
      h('div', { class: 'addr' }, window.STORE_ADDRESS || ''),
      form, demo)));
    setTimeout(function () { phone.focus(); }, 50);
  }

  function viewChangePin() {
    var oldP = h('input', { type: 'password', inputmode: 'numeric', maxlength: 6 });
    var newP = h('input', { type: 'password', inputmode: 'numeric', maxlength: 6 });
    var newP2 = h('input', { type: 'password', inputmode: 'numeric', maxlength: 6 });
    var err = h('div', { class: 'field-err' });
    var u = user();
    app.className = '';
    app.innerHTML = '';
    app.appendChild(h('div', { class: 'login-wrap' }, h('div', { class: 'login-card' },
      h('h1', null, 'Đổi mã PIN'),
      u && u.MustChange ? h('p', { class: 'muted' }, 'Bạn đang dùng mã PIN tạm. Đặt mã PIN riêng 6 số để tiếp tục.') : null,
      UI.field('Mã PIN hiện tại', oldP), UI.field('Mã PIN mới (6 số)', newP), UI.field('Nhập lại mã PIN mới', newP2), err,
      h('button', { class: 'btn primary block big', onclick: function () {
        err.textContent = '';
        if (newP.value !== newP2.value) { err.textContent = 'Hai lần nhập mã PIN mới không khớp'; return; }
        Api.call('changePin', { oldPin: oldP.value, newPin: newP.value }).then(function (res) {
          if (!res.ok) { err.textContent = res.error; return; }
          var s = session(); s.user.MustChange = false; setSession(s);
          UI.toast('Đã đổi mã PIN'); go(s.user.Role === 'admin' ? '#/admin' : '#/home');
        });
      } }, 'Lưu mã PIN'),
      u && !u.MustChange ? h('button', { class: 'btn ghost block', style: { marginTop: '8px' }, onclick: function () { history.back(); } }, 'Hủy') : null)));
  }

  /* ---------- M02 Trang chủ ---------- */
  function viewHome() {
    var body = page('home', 'Trang chủ');
    call('home').then(function (d) {
      if (!d) return;
      lastHome = d;
      var s = session(); if (s) { s.user = d.user; setSession(s); }
      clear(body);
      var u = d.user;
      body.appendChild(h('div', { class: 'status-card' },
        h('div', { class: 'muted small' }, 'Ngày kinh doanh ' + fmtDateVN(d.businessDate)),
        d.open ? [h('div', { class: 'big' }, 'Đang trong ca ' + d.open.ShiftName),
          h('div', { class: 'muted' }, 'Vào lúc ' + String(d.open.CheckInTime).slice(11, 16) + ' · ' + elapsed(d.open.CheckInTime))]
          : h('div', { class: 'big' }, 'Chưa vào ca'),
        h('div', { class: 'small muted', style: { marginTop: '4px' } }, 'Tháng này: ' + d.monthShifts + ' ca')));
      if (u.Role !== 'admin' || d.open) {
        body.appendChild(h('a', { class: 'btn primary block big', href: '#/checkin' }, d.open ? 'RA CA' : 'VÀO CA'));
      }
      var tiles = h('div', { class: 'tile-grid' });
      if (u.IsCashier) {
        var doneN = d.checkpoints.filter(function (c) { return c.status && c.status !== 'draft'; }).length;
        tiles.appendChild(h('a', { class: 'tile', href: '#/report' }, h('div', { class: 'ic' }, '🧾'), h('div', { class: 't' }, 'Báo cáo ca'),
          h('div', { class: 's' }, doneN + '/' + d.checkpoints.length + ' mốc đã nộp')));
        tiles.appendChild(h('a', { class: 'tile', href: '#/handover' }, h('div', { class: 'ic' }, '🤝'), h('div', { class: 't' }, 'Nhận ca'),
          h('div', { class: 's' }, d.handovers ? 'Có két chờ nhận' : 'Không có két chờ'), d.handovers ? h('span', { class: 'dot' }, d.handovers) : null));
      }
      if (isLeader()) tiles.appendChild(h('a', { class: 'tile', href: '#/review' }, h('div', { class: 'ic' }, '✅'), h('div', { class: 't' }, 'Duyệt'),
        h('div', { class: 's' }, 'Báo cáo, chấm công'), d.pendingReview ? h('span', { class: 'dot' }, d.pendingReview) : null));
      if (u.Role !== 'admin') tiles.appendChild(h('a', { class: 'tile', href: '#/attendance-request' }, h('div', { class: 'ic' }, '📝'), h('div', { class: 't' }, 'Báo thiếu công'), h('div', { class: 's' }, 'Quên vào/ra ca')));
      if (isAdmin()) tiles.appendChild(h('a', { class: 'tile', href: '#/admin' }, h('div', { class: 'ic' }, '📊'), h('div', { class: 't' }, 'Quản trị'), h('div', { class: 's' }, 'Dashboard, doanh thu')));
      body.appendChild(tiles);
      if (u.IsCashier) {
        body.appendChild(h('div', { class: 'section-title' }, 'Mốc kiểm két hôm nay'));
        body.appendChild(h('div', { class: 'pills' }, d.checkpoints.map(function (c) {
          var done = c.status && c.status !== 'draft';
          return h('span', { class: 'pill ' + (done ? 'done' : c.IsRequired ? 'need' : '') }, (done ? '✓ ' : '') + c.Name + (c.IsRequired && !done ? ' · hạn ' + c.Deadline : ''));
        })));
      }
      body.appendChild(h('div', { class: 'section-title' }, 'Thông báo'));
      if (!d.notifications.length) body.appendChild(h('div', { class: 'muted small' }, 'Không có thông báo mới.'));
      else body.appendChild(h('div', { class: 'card' }, h('ul', { class: 'list' }, d.notifications.map(function (n) {
        return h('li', { class: 'click', onclick: function () {
          call('markRead', { notificationId: n.NotificationID });
          openRecord(n.RecordRef);
        } }, h('div', { class: 'row between' }, h('span', { class: 'badge ' + levelClass(n.Level) }, n.Code), h('span', { class: 'small muted' }, String(n.CreatedTime).slice(5, 16))),
          h('div', { style: { marginTop: '4px' } }, n.Message));
      }))));
      if (Api.queueLength()) Api.flushQueue();
    });
  }

  function levelClass(l) { return l === 'block' ? 'red' : l === 'warn' ? 'orange' : l === 'explain' ? 'purple' : 'blue'; }

  function openRecord(ref) {
    var p = String(ref || '').split('/');
    if (p[0] === 'ShiftReports') go('#/report-view/' + p[1]);
    else if (p[0] === 'Attendance') go(isLeader() ? '#/review?tab=att' : '#/my-attendance');
    else if (p[0] === 'CashTransactions' && isLeader()) go('#/review');
    else if (p[0] === 'BusinessDays' && isAdmin()) go('#/admin/day/' + p[1]);
    else if (isAdmin() && p[0] === 'Users') go('#/admin/employees');
  }

  function elapsed(ts) {
    var m = Math.max(0, Math.round((Date.now() - parseTs(ts)) / 60000));
    return Math.floor(m / 60) + ' giờ ' + (m % 60) + ' phút';
  }

  /* ---------- M03 Chấm công: định vị, ảnh hiện trạng khi ra ca, chia sẻ vào nhóm Zalo ---------- */
  /* Lấy vị trí kèm lý do khi thất bại, để báo đúng nguyên nhân và hướng dẫn nhân viên bật lại. */
  var LOC_REASON = {
    frame: { short: 'trang đang mở trong khung không được phép dùng định vị',
      long: 'Trang này đang mở bên trong khung của trang khác (link demo claude.ai hoặc link Apps Script), nơi trình duyệt cấm dùng định vị. Hãy mở bằng link chính thức của quán (trang riêng) để lấy được vị trí.' },
    denied: { short: 'nhân viên chưa cho phép trang dùng vị trí',
      long: 'Trình duyệt đang chặn quyền vị trí cho trang này. Bật lại theo hướng dẫn bên dưới rồi bấm Thử lại.' },
    unavailable: { short: 'điện thoại đang tắt Định vị (GPS)', long: 'Điện thoại đang tắt Định vị hoặc không xác định được vị trí. Bật Định vị rồi bấm Thử lại.' },
    timeout: { short: 'không bắt được tín hiệu GPS', long: 'Chưa bắt được tín hiệu GPS. Đứng gần cửa hoặc chỗ thoáng rồi bấm Thử lại.' },
    insecure: { short: 'trang không chạy HTTPS', long: 'Trang không chạy HTTPS nên trình duyệt không cho dùng định vị. Hãy mở bằng link https của quán.' },
    unsupported: { short: 'trình duyệt không hỗ trợ định vị', long: 'Trình duyệt này không hỗ trợ định vị. Hãy dùng Chrome (Android) hoặc Safari (iPhone).' }
  };

  function readLocation() {
    return new Promise(function (resolve) {
      if (!window.isSecureContext) return resolve({ reason: 'insecure' });
      if (!navigator.geolocation) return resolve({ reason: 'unsupported' });
      var framed = false;
      try { framed = window.top !== window.self; } catch (e) { framed = true; }
      if (document.featurePolicy && document.featurePolicy.allowsFeature && !document.featurePolicy.allowsFeature('geolocation')) return resolve({ reason: 'frame' });
      navigator.geolocation.getCurrentPosition(function (p) {
        resolve({ loc: { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy } });
      }, function (e) {
        var code = e && e.code;
        resolve({ reason: code === 1 ? (framed ? 'frame' : 'denied') : code === 3 ? 'timeout' : 'unavailable' });
      }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
    });
  }

  /* Khối trạng thái vị trí trên màn chấm công: thông báo, hướng dẫn bật, nút Thử lại; bản demo có vị trí giả lập. */
  function makeLocator(d) {
    var state = { loc: null, reason: '', simulated: false };
    var el = h('div', { class: 'stack', style: { marginTop: '6px' } });
    var active = d.gpsMode === 'warn' || d.gpsMode === 'block';
    function guide() {
      return h('details', { class: 'small' }, h('summary', null, 'Cách bật vị trí'),
        h('p', null, h('strong', null, 'Android (Chrome): '), 'Kéo thanh thông báo, bật Vị trí. Trong Chrome bấm biểu tượng bên trái địa chỉ trang → Quyền → Vị trí → Cho phép. Tải lại trang.'),
        h('p', null, h('strong', null, 'iPhone (Safari): '), 'Cài đặt → Quyền riêng tư & Bảo mật → Dịch vụ định vị: Bật; mục Trang web Safari: "Khi dùng ứng dụng". Trong Safari bấm "aA" → Cài đặt trang web → Vị trí → Cho phép.'));
    }
    function draw() {
      clear(el);
      if (!active) return;
      if (state.loc) {
        el.appendChild(h('div', { class: 'small muted' }, (state.simulated ? 'Đang dùng vị trí giả lập tại quán (chỉ bản demo)' : 'Đã lấy vị trí') + ' (±' + Math.round(state.loc.acc || 0) + ' m)'));
        return;
      }
      if (!state.reason) { el.appendChild(h('div', { class: 'small muted' }, 'Đang lấy vị trí…')); return; }
      var r = LOC_REASON[state.reason] || LOC_REASON.unavailable;
      el.appendChild(h('div', { class: 'alert warn small' }, h('strong', null, 'Chưa lấy được vị trí. '), r.long,
        h('div', null, 'Vẫn chấm công được, nhưng chủ quán sẽ nhận cảnh báo.')));
      if (state.reason !== 'frame' && state.reason !== 'insecure' && state.reason !== 'unsupported') el.appendChild(guide());
      var row = h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small', onclick: function () { refresh(); } }, '↻ Thử lại'));
      if (Api.mode === 'demo' && d.store && d.store.lat) {
        row.appendChild(h('button', { type: 'button', class: 'btn small', onclick: function () {
          // Lệch ngẫu nhiên vài mét quanh tọa độ quán để bản demo cho thấy tin nhắn đầy đủ.
          state.loc = { lat: d.store.lat + (Math.random() - 0.5) * 0.0002, lng: d.store.lng + (Math.random() - 0.5) * 0.0002, acc: 20 };
          state.simulated = true; draw();
        } }, 'Dùng vị trí giả lập tại quán (bản demo)'));
      }
      el.appendChild(row);
    }
    function refresh() {
      if (!active || state.simulated) return Promise.resolve(state.loc);
      state.reason = ''; draw();
      return readLocation().then(function (r) {
        if (r.loc) { state.loc = r.loc; state.reason = ''; } else if (!state.loc) state.reason = r.reason;
        draw();
        return state.loc;
      });
    }
    draw();
    refresh();
    return {
      el: el, refresh: refresh,
      get: function () { return state.loc; },
      simulated: function () { return state.simulated; },
      reasonShort: function () { return state.loc ? '' : (LOC_REASON[state.reason] || LOC_REASON.unavailable).short; }
    };
  }
  function viewCheckin() {
    var body = page('home', 'Chấm công', '#/home');
    call('home').then(function (d) {
      if (!d) return;
      clear(body);
      var u = user();
      var nowEl = h('div', { class: 'big' }, '');
      var tick = function () { nowEl.textContent = fmtTs(Date.now()).slice(11, 16) + ' · ' + fmtDateVN(fmtTs(Date.now()).slice(0, 10)); };
      tick(); var timer = setInterval(function () { if (!document.body.contains(nowEl)) clearInterval(timer); else tick(); }, 15000);
      // Lấy vị trí ngay khi mở màn hình (để đóng dấu lên ảnh), lấy lại lúc bấm xác nhận.
      var L = makeLocator(d);
      if (d.open) return buildCheckout(body, d, nowEl, L);
      var selected = suggestShift(d.shiftTypes);
      var chips = h('div', { class: 'chips' });
      function drawChips() {
        clear(chips);
        d.shiftTypes.forEach(function (s) {
          chips.appendChild(h('button', { class: 'chip' + (selected === s.ShiftTypeID ? ' on' : ''), onclick: function () { selected = s.ShiftTypeID; drawChips(); } },
            s.Name, h('small', null, s.StartTime + '–' + s.EndTime)));
        });
      }
      drawChips();
      var inBtn = h('button', { class: 'btn primary block big' }, 'XÁC NHẬN VÀO CA');
      inBtn.onclick = function () {
        if (!selected) { UI.toast('Chọn ca làm việc', 'err'); return; }
        inBtn.disabled = true;
        var shift = d.shiftTypes.filter(function (s) { return s.ShiftTypeID === selected; })[0];
        L.refresh().then(function () { return Api.callQueued('checkIn', { shiftTypeId: selected, location: L.get(), locationError: L.reasonShort() }); }).then(function (res) {
          inBtn.disabled = false;
          afterAttendance(res, 'in', d, { shiftName: shift.Name, loc: L.get(), locReason: L.reasonShort(), simulated: L.simulated(), photos: [] });
        });
      };
      body.appendChild(h('div', { class: 'card tint' }, h('div', { class: 'muted small' }, 'Giờ hiện tại (giờ máy chủ được ghi khi bấm)'), nowEl, L.el));
      body.appendChild(h('div', { class: 'section-title' }, 'Chọn ca'));
      body.appendChild(chips);
      body.appendChild(h('p', { class: 'small muted' }, 'Đã gợi ý sẵn ca theo giờ hiện tại. Sau khi vào ca, bấm gửi thông báo vào nhóm Zalo của quán.'));
      body.appendChild(inBtn);
    });
  }

  /* Ra ca: bắt buộc đủ ảnh hiện trạng theo từng góc, ảnh đóng dấu tên – giờ – góc – vị trí. */
  function buildCheckout(body, d, nowEl, L) {
    var getLoc = L.get;
    var u = user();
    var labels = d.photo.labels.slice(0, d.photo.count);
    while (labels.length < d.photo.count) labels.push('Ảnh ' + (labels.length + 1));
    var photos = labels.map(function () { return null; });
    var grid = h('div', { class: 'photo-grid' });
    var btn = h('button', { class: 'btn primary block big' }, 'XÁC NHẬN RA CA');
    function draw() {
      clear(grid);
      labels.forEach(function (lbl, i) {
        var slot = h('button', { type: 'button', class: 'photo-slot' + (photos[i] ? ' done' : ''), onclick: function () { shoot(i); } },
          photos[i] ? h('img', { src: photos[i], alt: lbl }) : h('span', { class: 'ic' }, '📷'),
          h('span', { class: 'lbl' }, (photos[i] ? '✓ ' : '') + lbl), photos[i] ? h('span', { class: 'retake' }, 'Chụp lại') : null);
        grid.appendChild(slot);
      });
      var n = photos.filter(Boolean).length;
      btn.disabled = n < labels.length;
      btn.textContent = n < labels.length ? 'Còn thiếu ' + (labels.length - n) + ' ảnh hiện trạng' : 'XÁC NHẬN RA CA';
    }
    function shoot(i) {
      var l = getLoc();
      var when = fmtTs(Date.now());
      UI.takePhoto({ maxAgeMinutes: d.photo.maxAgeMinutes, stamp: [
        (window.STORE_NAME || d.storeName) + ' · ' + labels[i],
        u.DisplayName + ' · Ra ca ' + d.open.ShiftName + ' · ' + when.slice(11, 16) + ' ' + fmtDateVN(when.slice(0, 10)),
        l ? 'Vị trí ' + l.lat.toFixed(5) + ', ' + l.lng.toFixed(5) : 'Không lấy được vị trí'
      ] }).then(function (r) {
        if (!r) return;
        if (r.error) { UI.modal('Ảnh không hợp lệ', h('div', { class: 'alert err' }, r.error)); return; }
        photos[i] = r.dataUrl; draw();
      });
    }
    body.appendChild(h('div', { class: 'status-card' }, h('div', { class: 'muted small' }, 'Ca đang mở'),
      h('div', { class: 'big' }, d.open.ShiftName), h('div', null, 'Vào lúc ' + String(d.open.CheckInTime).slice(11, 16) + ' ngày ' + fmtDateVN(d.open.BusinessDate)),
      h('div', { class: 'muted' }, 'Đã làm ' + elapsed(d.open.CheckInTime))));
    body.appendChild(h('div', { class: 'card tint' }, h('div', { class: 'muted small' }, 'Giờ hiện tại'), nowEl, L.el));
    body.appendChild(h('div', { class: 'section-title' }, 'Ảnh hiện trạng nhà hàng (bắt buộc ' + labels.length + ' ảnh)'));
    body.appendChild(h('p', { class: 'small muted' }, 'Chụp mới bằng camera, mỗi góc 1 ảnh. Ảnh cũ hơn ' + d.photo.maxAgeMinutes + ' phút sẽ không được nhận.'));
    body.appendChild(grid);
    body.appendChild(btn);
    draw();
    btn.onclick = function () {
      btn.disabled = true;
      L.refresh().then(function () {
        var loc = L.get();
        return Api.callQueued('checkOut', { location: loc, locationError: L.reasonShort(), photos: photos }).then(function (res) {
          draw();
          afterAttendance(res, 'out', d, { shiftName: d.open.ShiftName, loc: loc, locReason: L.reasonShort(), simulated: L.simulated(), photos: photos, labels: labels, checkIn: d.open.CheckInTime });
        });
      });
    };
  }

  function suggestShift(types) {
    var now = fmtTs(Date.now()).slice(11, 16), best = null, bestDiff = 1e9;
    types.forEach(function (s) {
      var a = toMin(s.StartTime), n = toMin(now), diff = Math.abs(n - a);
      if (s.ShiftTypeID === 'TRUATOI') diff += 30; // ưu tiên ca đơn khi giờ bắt đầu trùng nhau
      if (diff < bestDiff) { bestDiff = diff; best = s.ShiftTypeID; }
    });
    return best;
  }
  function toMin(hhmm) { var p = String(hhmm).split(':'); return +p[0] * 60 + +(p[1] || 0); }

  /* Nội dung tin gửi vào nhóm Zalo. */
  function zaloText(kind, d, res, info) {
    var u = user(), a = res.data && res.data.attendance;
    var ts = a ? (kind === 'in' ? a.CheckInTime : a.CheckOutTime) : fmtTs(Date.now());
    var dist = res.data && res.data.distance !== undefined ? res.data.distance : null;
    var lines = [(kind === 'in' ? '🟢 VÀO CA' : '🔴 RA CA') + ' – ' + u.DisplayName,
      'Ca ' + info.shiftName + ' · ' + String(ts).slice(11, 16) + ' ngày ' + fmtDateVN(String(ts).slice(0, 10))];
    if (kind === 'out' && a && a.WorkHours) lines.push('Làm ' + String(a.WorkHours).replace('.', ',') + ' giờ (vào lúc ' + String(info.checkIn).slice(11, 16) + ')');
    if (info.loc) {
      lines.push('Vị trí: ' + (dist !== null ? 'cách quán ' + dist + ' m' : 'đã lấy') + ' (±' + Math.round(info.loc.acc || 0) + ' m)' + (info.simulated ? ' – vị trí giả lập, bản demo' : ''));
      lines.push('https://maps.google.com/?q=' + info.loc.lat.toFixed(6) + ',' + info.loc.lng.toFixed(6));
    } else lines.push('Vị trí: không lấy được – ' + (info.locReason || 'không rõ lý do'));
    if (kind === 'out') {
      lines.push(info.photos.length + ' ảnh hiện trạng: ' + info.labels.join(', '));
      // Bản chính thức: ảnh nằm trên Google Drive → chèn link để dán 1 lần là đủ cả ảnh.
      var urls = (a && a.CheckoutPhotos || []).filter(function (x) { return /^https?:/.test(x); });
      urls.forEach(function (x, i) { lines.push((info.labels[i] || 'Ảnh ' + (i + 1)) + ': ' + x); });
    }
    if (res.queued) lines.push('(Gửi từ máy đang mất mạng, giờ chấm công sẽ được ghi khi có mạng)');
    lines.push(window.STORE_NAME || d.storeName);
    return lines.join('\n');
  }

  function afterAttendance(res, kind, d, info) {
    if (!res.ok) {
      UI.modal('Không chấm công được', h('div', { class: 'alert err' }, res.error));
      return;
    }
    var okText = kind === 'in' ? 'Đã vào ca' : 'Đã ra ca';
    var w = (res.data && res.data.warnings) || [];
    var text = zaloText(kind, d, res, info);
    var att = res.data && res.data.attendance;
    var status = h('div', { class: 'small' });
    var link = String(d.zaloGroupLink || '').trim();
    function shared() { if (att && !res.queued) call('markShared', { attendanceId: att.AttendanceID, kind: kind }); }
    // Nút chính là một đường link thật tới nhóm Zalo: bấm vào thì sao chép nội dung ngay trong lần bấm,
    // rồi trình duyệt mở link (điện thoại tự chuyển sang ứng dụng Zalo, đúng nhóm của quán).
    var mainBtn = link
      ? h('a', { class: 'btn primary block big', href: link, target: '_blank', rel: 'noopener', onclick: function () {
          var ok = UI.copyTextSync(text);
          status.className = ok ? 'alert ok small' : 'alert warn small';
          status.textContent = ok ? 'Đã sao chép nội dung. Trong nhóm Zalo: nhấn giữ ô nhập tin → Dán → Gửi.'
            : 'Không tự sao chép được. Quay lại đây, bấm "Sao chép nội dung" rồi dán vào nhóm.';
          shared();
        } }, '📋 Sao chép & mở nhóm Zalo')
      : h('button', { class: 'btn primary block big', onclick: function () {
          var ok = UI.copyTextSync(text);
          status.className = 'alert warn small';
          status.textContent = (ok ? 'Đã sao chép nội dung. ' : '') + 'Quán chưa cài link nhóm Zalo (chủ quán vào Quản trị → Cấu hình → "Link nhóm Zalo"). Tạm thời hãy tự mở nhóm Zalo và dán.';
          if (ok) shared();
        } }, '📋 Sao chép nội dung gửi Zalo');
    var shareBtn = h('button', { class: 'btn small', onclick: function () {
      UI.shareToZalo(text, []).then(function (r) {
        if (r === 'shared') { status.className = 'small muted'; status.textContent = 'Đã mở bảng chia sẻ. Chọn Zalo → nhóm quán → Gửi.'; shared(); }
        else if (r === 'copied') { status.className = 'small muted'; status.textContent = 'Máy không hỗ trợ chia sẻ. Đã sao chép nội dung.'; }
      });
    } }, '📤 Gửi qua bảng chia sẻ');

    // Ra ca có ảnh: nút chính gửi thẳng ảnh vào Zalo. Zalo bỏ phần chữ khi nhận kèm ảnh, nên app vẽ
    // thêm 1 ảnh thông tin (đứng đầu bộ ảnh) và đồng thời sao chép nội dung để dán thêm nếu cần link bản đồ.
    var hasPhotos = kind === 'out' && info.photos.length > 0;
    var bundle = null;
    if (hasPhotos) {
      var all = text.split('\n'), cardLines = all.slice(1, -1).filter(function (l) { return !/https?:\/\//.test(l); });
      if (info.loc) cardLines.push('Tọa độ: ' + info.loc.lat.toFixed(5) + ', ' + info.loc.lng.toFixed(5));
      bundle = [UI.infoCard(all[0].replace(/^\S+\s/, ''), cardLines, window.STORE_NAME || d.storeName)].concat(info.photos);
      bundle.infoFirst = true;
    }
    var photoBtn = hasPhotos ? h('button', { class: 'btn primary block big', onclick: function () {
      UI.copyTextSync(text); // chạy xong ngay trong lần bấm, trước khi mở bảng chia sẻ
      UI.shareToZalo(text, bundle).then(function (r) {
        if (r === 'shared') {
          status.className = 'alert ok small';
          status.textContent = 'Đã gửi ' + bundle.length + ' ảnh (ảnh đầu là thông tin ra ca). Nội dung chữ cũng đã được sao chép: muốn có link bản đồ, trong Zalo nhấn giữ ô nhập tin → Dán → Gửi.';
          shared();
        } else if (r === 'copied' || r === 'failed') {
          status.className = 'alert warn small';
          status.textContent = 'Điện thoại không gửi được ảnh qua bảng chia sẻ. Dùng nút "Sao chép & mở nhóm Zalo" bên dưới (gửi link ảnh).';
        }
      });
    } }, '📤 Gửi ảnh & thông tin vào Zalo') : null;
    if (hasPhotos) mainBtn.className = 'btn block';

    var body = h('div', { class: 'stack' },
      w.length ? h('div', { class: 'alert warn' }, h('ul', null, w.map(function (x) { return h('li', null, x); }))) : null,
      h('p', { class: 'small' }, hasPhotos ? 'Bấm nút dưới → chọn Zalo → chọn nhóm của quán → Gửi. Ảnh đầu tiên chứa thông tin ra ca của bạn.'
        : link ? 'Bấm nút dưới: nội dung được sao chép và nhóm Zalo của quán mở ra. Trong Zalo nhấn giữ ô nhập tin → Dán → Gửi.'
        : 'Bấm nút dưới để sao chép nội dung, rồi dán vào nhóm Zalo của quán.'),
      hasPhotos ? h('div', { class: 'thumbs' }, bundle.map(function (p) { return h('img', { src: p, alt: '' }); })) : h('pre', { class: 'share-preview' }, text),
      photoBtn, mainBtn, status,
      hasPhotos ? h('details', { class: 'small' }, h('summary', null, 'Xem nội dung chữ'), h('pre', { class: 'share-preview' }, text)) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: function () { var ok = UI.copyTextSync(text); UI.toast(ok ? 'Đã sao chép nội dung' : 'Không sao chép được', ok ? 'ok' : 'err'); } }, 'Sao chép nội dung'),
        hasPhotos ? null : shareBtn));
    UI.modal(okText + (res.queued ? ' (lưu tạm)' : ''), body, [{ label: 'Xong', value: true }]).then(function () { go('#/home'); });
  }
  /* ---------- M04 Công của tôi ---------- */
  function viewMyAttendance(q) {
    var month = q.month || fmtTs(Date.now()).slice(0, 7);
    var body = page('my-attendance', 'Công của tôi');
    call('myAttendance', { month: month }).then(function (d) {
      if (!d) return;
      clear(body);
      var mInput = h('input', { type: 'month', value: month, onchange: function () { go('#/my-attendance?month=' + mInput.value); } });
      body.appendChild(h('div', { class: 'row' }, h('div', { class: 'grow' }, UI.field('Tháng', mInput)),
        h('a', { class: 'btn', href: '#/attendance-request' }, 'Báo thiếu công')));
      var s = d.summary;
      if (s) body.appendChild(h('div', { class: 'card tint' },
        h('div', { class: 'row between' }, h('div', null, h('div', { class: 'muted small' }, 'Tổng ca hoàn thành'), h('div', { style: { fontSize: '1.6rem', fontWeight: 800 } }, s.totalShifts)),
          h('div', { class: 'right' }, h('div', { class: 'muted small' }, 'Giờ làm'), h('div', { style: { fontWeight: 700 } }, s.hours + ' giờ'))),
        h('div', { class: 'pills', style: { marginTop: '8px' } }, d.shiftTypes.map(function (t) { return h('span', { class: 'pill' }, t.Name + ': ' + (s.counts[t.ShiftTypeID] || 0)); })),
        h('dl', { class: 'kv', style: { marginTop: '10px' } },
          h('dt', null, 'Số lần đi muộn'), h('dd', null, s.lateCount),
          h('dt', null, 'Lượt chờ xử lý'), h('dd', null, s.pendingCount),
          h('dt', null, 'Đã ứng lương tháng'), h('dd', null, money(s.advance) + ' đ'))));
      if (!d.rows.length) { body.appendChild(UI.empty('Chưa có lượt chấm công trong tháng.')); return; }
      body.appendChild(h('div', { class: 'card' }, h('ul', { class: 'list' }, d.rows.map(function (a) {
        return h('li', null, h('div', { class: 'row between' }, h('strong', null, fmtDateVN(a.BusinessDate) + ' · ' + a.ShiftName), UI.badge(a.Status, a.StatusName)),
          h('div', { class: 'small muted' }, 'Vào ' + (a.CheckInTime ? String(a.CheckInTime).slice(11, 16) : '—') + ' · Ra ' + (a.CheckOutTime ? String(a.CheckOutTime).slice(11, 16) : '—') +
            (a.WorkHours ? ' · ' + a.WorkHours + ' giờ' : '') + (a.LateMinutes > 0 ? ' · muộn ' + a.LateMinutes + ' phút' : '')),
          a.Note ? h('div', { class: 'small muted' }, a.Note) : null);
      }))));
    });
  }

  /* ---------- M05 Báo thiếu công ---------- */
  function viewAttendanceRequest() {
    var body = page('my-attendance', 'Báo thiếu công', '#/my-attendance');
    call('home').then(function (d) {
      if (!d) return;
      clear(body);
      var today = d.businessDate;
      var date = h('input', { type: 'date', value: today, max: today, min: addDays(today, -7) });
      var shift = UI.select(d.shiftTypes.map(function (s) { return { value: s.ShiftTypeID, label: s.Name + ' (' + s.StartTime + '–' + s.EndTime + ')' }; }), '');
      var tin = h('input', { type: 'time' }), tout = h('input', { type: 'time' });
      var reason = h('textarea', { rows: 3, placeholder: 'Vd: quên bấm vào ca, điện thoại hết pin…' });
      var err = h('div', { class: 'field-err' });
      var btn = h('button', { class: 'btn primary block big' }, 'Gửi yêu cầu');
      btn.onclick = function () {
        err.textContent = '';
        btn.disabled = true;
        call('requestAttendance', { businessDate: date.value, shiftTypeId: shift.value, checkIn: tin.value, checkOut: tout.value, reason: reason.value }, { raw: true }).then(function (res) {
          btn.disabled = false;
          if (!res.ok) { err.textContent = res.error; return; }
          UI.toast('Đã gửi, chờ trưởng ca duyệt'); go('#/my-attendance');
        });
      };
      body.appendChild(h('div', { class: 'card' }, UI.field('Ngày', date, 'Chỉ trong 7 ngày gần nhất'), UI.field('Loại ca', shift),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, UI.field('Giờ vào', tin)), h('div', { class: 'grow' }, UI.field('Giờ ra', tout, 'Để trống nếu chỉ quên vào ca'))),
        UI.field('Lý do (bắt buộc)', reason), err));
      body.appendChild(btn);
    });
  }

  /* ---------- M06 Lập báo cáo ca + M07 Thêm giao dịch ---------- */
  function viewReport(q) {
    var body = page('my-reports', 'Báo cáo ca', '#/home');
    call('reportForm', { checkpointId: q.cp, reportId: q.id }).then(function (d) {
      if (!d) return;
      clear(body);
      body.appendChild(h('div', { class: 'muted small' }, 'Ngày kinh doanh ' + fmtDateVN(d.businessDate) + ' · Người lập: ' + user().DisplayName));
      if (!q.id) body.appendChild(h('div', { class: 'seg' }, d.checkpoints.map(function (c) {
        var lbl = c.Name + (c.ReportStatus && c.ReportStatus !== 'draft' ? ' ✓' : c.ReportStatus === 'draft' ? ' (nháp)' : '');
        return h('button', { class: c.CheckpointID === d.checkpointId ? 'on' : '', onclick: function () { go('#/report?cp=' + c.CheckpointID); } }, lbl);
      })));
      var cp = d.checkpoints.filter(function (c) { return c.CheckpointID === d.checkpointId; })[0];
      if (d.readOnly && d.report) {
        body.appendChild(h('div', { class: 'alert info' }, 'Mốc ' + cp.Name + ' đã có báo cáo của ' + d.report.ReporterName + ' (' + d.report.StatusName + '). Mỗi mốc chỉ có 1 báo cáo (CB-10).'));
        body.appendChild(reportDetail(d.report));
        return;
      }
      buildReportForm(body, d, cp);
    });
  }

  function buildReportForm(body, d, cp) {
    var rep = d.report;
    if (rep && rep.Status === 'returned') body.appendChild(h('div', { class: 'alert warn' }, h('strong', null, 'Bị trả lại: '), rep.ReturnReason));
    var txns = rep ? rep.txns.map(function (t) { return { TxnID: t.TxnID, TxnType: t.TxnType, CategoryID: t.CategoryID, EmployeeID: t.EmployeeID, Amount: t.Amount, Description: t.Description, ReceiptImage: t.ReceiptImage }; }) : [];
    var transferImage = rep ? rep.TransferImage : '';
    var carry = d.cashCarried;

    // 1. Tiền két
    var diffBox = h('div');
    var reasonWrap = h('div', { class: 'hidden' });
    var reason = h('textarea', { rows: 2, placeholder: 'Vd: chủ quán lấy 200.000 tối qua chưa ghi' }, rep ? rep.DifferenceReason : '');
    reason.value = rep ? rep.DifferenceReason || '' : '';
    reasonWrap.appendChild(UI.field('Lý do chênh lệch (bắt buộc)', reason));
    var cash = UI.moneyInput({ value: rep ? rep.CashCounted : '', onchange: function () { refresh(); } });
    var sec1 = h('div', { class: 'card' }, h('h3', null, '1. Tiền két'),
      h('dl', { class: 'kv' }, h('dt', null, 'Két chuyển sang'), h('dd', null, carry === null ? 'Chưa có số ngày trước' : money(carry) + ' đ')),
      h('div', { class: 'small muted' }, d.carrySource === 'F-02' ? 'Số người nhận ca đếm ở mốc trước (F-02)' : 'Két cuối ngày trước − rút quỹ sau đóng cửa (F-01)'),
      UI.field('Tiền mặt đếm được', cash.el), diffBox, reasonWrap);
    body.appendChild(sec1);

    // 2. Chuyển khoản
    var transfer = UI.moneyInput({ value: rep ? rep.TransferAmount : '', onchange: function () { refresh(); } });
    var imgState = h('span', { class: 'small muted' });
    function drawImg() { clear(imgState); if (transferImage) imgState.appendChild(UI.imgLink(transferImage, 'Đã đính kèm ảnh')); }
    drawImg();
    if (!cp.IsOpening) {
      body.appendChild(h('div', { class: 'card' }, h('h3', null, '2. Chuyển khoản từ mốc trước'),
        UI.field('Tiền CK phát sinh', transfer.el, 'Không có thì nhập 0'),
        h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: function () {
          UI.pickImage().then(function (data) {
            if (!data) return;
            imgState.textContent = 'Đang tải ảnh…';
            call('uploadImage', { dataUrl: data, name: 'CK' }).then(function (r) { if (r) { transferImage = r.url; drawImg(); } else drawImg(); });
          });
        } }, '📷 Đính kèm ảnh lịch sử CK'), imgState)));
    }

    // 3. Giao dịch
    var list = h('div');
    var sec3 = h('div', { class: 'card' }, h('h3', null, cp.IsOpening ? '2. Tiền lấy ra / bỏ vào két từ lúc đóng cửa hôm qua' : '3. Giao dịch tiền mặt'),
      cp.IsOpening ? h('div', { class: 'small muted' }, 'Vd chủ quán lấy tiền tối qua chưa ghi. Các khoản này trừ vào két dự kiến, không tính vào doanh thu hôm nay.') : null, list,
      h('button', { class: 'linkish', onclick: function () { txnModal(d).then(function (t) { if (t) { txns.push(t); refresh(); } }); } }, '+ Thêm khoản'));
    body.appendChild(sec3);

    // 4. Tóm tắt
    var summary = h('div', { class: 'card tint' });
    body.appendChild(summary);

    function refresh() {
      clear(list);
      if (!txns.length) list.appendChild(h('div', { class: 'muted small' }, 'Chưa có khoản nào. Không chi thì bỏ qua.'));
      txns.forEach(function (t, i) {
        var cat = d.categories.filter(function (c) { return c.CategoryID === t.CategoryID; })[0];
        var emp = d.employees.filter(function (e) { return e.EmployeeID === t.EmployeeID; })[0];
        list.appendChild(h('div', { class: 'txn', style: { padding: '8px 0', borderBottom: '1px solid var(--line)' } },
          h('div', { class: 'd' }, h('div', null, t.Description), h('div', { class: 'm' }, TXN_TYPES[t.TxnType] + (cat ? ' · ' + cat.Name : '') + (emp ? ' · ' + emp.Name : '') + (t.ReceiptImage ? ' · có ảnh' : ''))),
          h('div', { class: 'a' }, money(t.Amount)),
          h('button', { class: 'icon-btn', 'aria-label': 'Xóa khoản', onclick: function () { txns.splice(i, 1); refresh(); } }, '×')));
      });
      var tot = { expense: 0, advance: 0, withdraw: 0, deposit: 0, refund: 0 };
      txns.forEach(function (t) { tot[t.TxnType] += Number(t.Amount) || 0; });
      // Chênh lệch đầu ngày (F-06)
      clear(diffBox);
      var c = cash.get();
      var expected = carry === null ? null : carry + tot.deposit - tot.expense - tot.advance - tot.withdraw - tot.refund;
      var diff = cp.IsOpening && expected !== null && c !== '' ? c - expected : 0;
      if (cp.IsOpening && expected !== null && expected !== carry) diffBox.appendChild(h('div', { class: 'small muted' }, 'Két dự kiến sau các khoản trên: ' + money(expected) + ' đ'));
      if (diff !== 0) {
        diffBox.appendChild(h('div', { class: 'alert warn' }, 'Lệch ' + money(diff) + ' đ so với két dự kiến.'));
        reasonWrap.classList.remove('hidden');
      } else reasonWrap.classList.add('hidden');
      clear(summary);
      var rows = [h('dt', null, 'Tiền mặt đếm'), h('dd', null, c === '' ? '—' : money(c) + ' đ')];
      if (!cp.IsOpening) rows.push(h('dt', null, 'Tiền CK'), h('dd', null, money(transfer.get() || 0) + ' đ'));
      ['expense', 'advance', 'withdraw', 'deposit', 'refund'].forEach(function (k) { if (tot[k]) rows.push(h('dt', null, TXN_TYPES[k]), h('dd', null, money(tot[k]) + ' đ')); });
      summary.appendChild(h('h3', null, 'Tóm tắt'));
      summary.appendChild(h('dl', { class: 'kv' }, rows));
      if (cp.IsClosing && c !== '') {
        var o = d.dayOthers;
        var opening = o.openingCounted === null ? 0 : o.openingCounted;
        var rev = o.transfer + (transfer.get() || 0) + c + o.totals.expense + tot.expense + o.totals.advance + tot.advance + o.totals.withdraw + tot.withdraw - o.totals.deposit - tot.deposit - opening;
        summary.appendChild(h('div', { style: { marginTop: '10px' } }, h('div', { class: 'muted small' }, 'Doanh thu ngày (tạm tính, F-03)'),
          h('div', { style: { fontSize: '1.4rem', fontWeight: 800 } }, money(rev) + ' đ')));
      }
    }
    refresh();

    var err = h('div', { class: 'field-err' });
    body.appendChild(err);
    var draftBtn = h('button', { class: 'btn' }, 'Lưu nháp');
    var sendBtn = h('button', { class: 'btn primary grow' }, 'Gửi báo cáo');
    body.appendChild(h('div', { class: 'sticky-actions' }, draftBtn, sendBtn));

    function payload(submit, confirmWarnings) {
      return { reportId: rep ? rep.ReportID : '', checkpointId: cp.CheckpointID, cashCounted: cash.get(), transferAmount: cp.IsOpening ? 0 : transfer.get(),
        transferImage: transferImage, differenceReason: reason.value, txns: txns, submit: submit, confirmWarnings: !!confirmWarnings };
    }
    function save(submit, confirmWarnings) {
      err.textContent = '';
      draftBtn.disabled = sendBtn.disabled = true;
      return Api.call('saveReport', payload(submit, confirmWarnings)).then(function (res) {
        draftBtn.disabled = sendBtn.disabled = false;
        if (!res.ok) {
          err.textContent = res.error;
          if (res.code === 'CB-09') { reasonWrap.classList.remove('hidden'); reason.focus(); }
          if (res.code === 'CB-10' && res.extra) go('#/report-view/' + res.extra.reportId);
          return;
        }
        if (res.data.needConfirm) {
          return UI.confirmBox('Kiểm tra lại số tiền', res.data.warnings.map(function (w) { return '⚠ ' + w.text; }).concat(['Số đúng thì bấm Vẫn gửi.']), 'Vẫn gửi').then(function (ok) { if (ok) return save(submit, true); });
        }
        if (!submit) { UI.toast('Đã lưu nháp'); go('#/report?id=' + res.data.report.ReportID); return; }
        var notes = res.data.notes || [];
        var msg = cp.IsClosing ? 'Đã gửi báo cáo Cuối ngày.' : 'Đã gửi. Người nhận ca sẽ đếm lại két trên máy của họ.';
        if (notes.length) UI.modal('Đã gửi báo cáo', h('div', null, h('p', null, msg), h('div', { class: 'alert warn' }, h('ul', null, notes.map(function (n) { return h('li', null, n); }))))).then(function () { go('#/home'); });
        else { UI.toast(msg); go('#/home'); }
      });
    }
    draftBtn.onclick = function () { save(false); };
    sendBtn.onclick = function () {
      var c = cash.get();
      if (c === '') { err.textContent = 'Nhập tiền mặt đếm được'; return; }
      if (!cp.IsOpening && transfer.get() === '') { err.textContent = 'Nhập tiền CK (không có thì nhập 0)'; return; }
      var lines = ['Mốc: ' + cp.Name + ' · ngày ' + fmtDateVN(d.businessDate), 'Tiền mặt: ' + money(c) + ' đ'];
      if (!cp.IsOpening) lines.push('Tiền CK: ' + money(transfer.get()) + ' đ');
      if (txns.length) lines.push(txns.length + ' giao dịch, tổng ' + money(txns.reduce(function (a, t) { return a + Number(t.Amount); }, 0)) + ' đ');
      UI.confirmBox('Gửi báo cáo?', lines, 'Gửi báo cáo').then(function (ok) { if (ok) save(true); });
    };
  }

  function txnModal(d) {
    var type = 'expense';
    var types = ['expense', 'advance', 'refund'].concat(d.canFund ? ['withdraw', 'deposit'] : []);
    var seg = h('div', { class: 'seg' });
    var cat = UI.select([{ value: '', label: '— Chọn nhóm chi —' }].concat(d.categories.map(function (c) { return { value: c.CategoryID, label: c.Name }; })), '');
    var emp = UI.select([{ value: '', label: '— Chọn nhân viên —' }].concat(d.employees.map(function (e) { return { value: e.EmployeeID, label: e.Name }; })), '');
    var empInfo = h('div', { class: 'small muted' });
    var amount = UI.moneyInput({ onchange: function () { hint(); } });
    var desc = h('input', { type: 'text', placeholder: 'Vd: Mua bánh mì' });
    var img = '', imgLbl = h('span', { class: 'small muted' });
    var warn = h('div');
    var err = h('div', { class: 'field-err' });
    var catField = UI.field('Nhóm chi', cat), empField = UI.field('Nhân viên ứng', emp);
    function draw() {
      clear(seg);
      types.forEach(function (t) { seg.appendChild(h('button', { type: 'button', class: t === type ? 'on' : '', onclick: function () { type = t; draw(); } }, TXN_TYPES[t])); });
      catField.classList.toggle('hidden', type !== 'expense');
      empField.classList.toggle('hidden', type !== 'advance');
      desc.placeholder = type === 'withdraw' ? 'Vd: Chủ quán lấy' : type === 'refund' ? 'Vd: Khách CK dư 200k lấy tiền mặt' : type === 'advance' ? 'Vd: Ứng lương' : 'Vd: Mua bánh mì';
      hint();
    }
    function hint() {
      clear(warn);
      var a = amount.get() || 0;
      if (type === 'expense' && a >= d.limits.expenseApproval) warn.appendChild(h('div', { class: 'alert warn' }, 'Khoản chi từ ' + money(d.limits.expenseApproval) + ' đ cần trưởng ca/chủ quán duyệt (CB-13).'));
      if (type === 'advance' && emp.value) {
        var e = d.employees.filter(function (x) { return x.EmployeeID === emp.value; })[0];
        empInfo.textContent = 'Đã ứng tháng này: ' + money(e.advanceMonth) + ' đ · hạn mức ' + money(d.limits.advanceLimit) + ' đ';
        if (e.advanceMonth + a > d.limits.advanceLimit) warn.appendChild(h('div', { class: 'alert warn' }, 'Vượt hạn mức ứng lương tháng (CB-14); chủ quán sẽ được báo.'));
      } else empInfo.textContent = '';
    }
    emp.onchange = hint;
    draw();
    var body = h('div', null, seg, catField, empField, empInfo, UI.field('Số tiền', amount.el), UI.field('Nội dung (bắt buộc)', desc),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small', onclick: function () {
        UI.pickImage().then(function (data) {
          if (!data) return; imgLbl.textContent = 'Đang tải ảnh…';
          call('uploadImage', { dataUrl: data, name: 'HD' }).then(function (r) { img = r ? r.url : ''; imgLbl.textContent = r ? 'Đã đính kèm' : ''; });
        });
      } }, '📷 Ảnh hóa đơn'), imgLbl), warn, err);
    return UI.modal('Thêm giao dịch tiền mặt', body, [{ label: 'Hủy', value: null }, { label: 'Thêm', primary: true,
      validate: function () {
        var e = [];
        if (!(amount.get() > 0)) e.push('Nhập số tiền');
        if (!desc.value.trim()) e.push('Nhập nội dung');
        if (type === 'expense' && !cat.value) e.push('Chọn nhóm chi');
        if (type === 'advance' && !emp.value) e.push('Chọn nhân viên');
        err.textContent = e.join('\n');
        return !e.length;
      },
      value: function () { return { TxnType: type, CategoryID: type === 'expense' ? cat.value : '', EmployeeID: type === 'advance' ? emp.value : '', Amount: amount.get(), Description: desc.value.trim(), ReceiptImage: img }; } }]);
  }

  /* ---------- Chi tiết báo cáo (dùng chung M09, M10, W02) ---------- */
  function reportDetail(r, opts) {
    opts = opts || {};
    var rows = [h('dt', null, 'Người lập'), h('dd', null, r.ReporterName), h('dt', null, 'Gửi lúc'), h('dd', null, r.SubmittedTime || '—'),
      h('dt', null, 'Két chuyển sang'), h('dd', null, money(r.CashCarried) + ' đ'), h('dt', null, 'Tiền mặt đếm'), h('dd', null, money(r.CashCounted) + ' đ')];
    if (!r.IsOpening) rows.push(h('dt', null, 'Tiền CK'), h('dd', null, money(r.TransferAmount) + ' đ'));
    if (r.Difference) rows.push(h('dt', null, 'Lệch đầu ngày'), h('dd', null, money(r.Difference) + ' đ'));
    if (r.ReceiverID) rows.push(h('dt', null, 'Người nhận ca'), h('dd', null, r.ReceiverName + ' đếm ' + money(r.CashHandedOver) + ' đ'));
    if (r.HandoverDifference) rows.push(h('dt', null, 'Lệch bàn giao'), h('dd', null, money(r.HandoverDifference) + ' đ'));
    if (r.ApproverName) rows.push(h('dt', null, r.Status === 'returned' ? 'Người trả lại' : 'Người duyệt'), h('dd', null, r.ApproverName));
    return h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h3', { style: { margin: 0 } }, r.CheckpointName + ' · ' + fmtDateVN(r.BusinessDate)), UI.badge(r.Status, r.StatusName)),
      h('dl', { class: 'kv', style: { marginTop: '10px' } }, rows),
      r.DifferenceReason ? h('div', { class: 'alert warn', style: { marginTop: '8px' } }, 'Lý do lệch đầu ngày: ' + r.DifferenceReason) : null,
      r.HandoverReason ? h('div', { class: 'alert warn', style: { marginTop: '8px' } }, 'Lý do lệch bàn giao: ' + r.HandoverReason) : null,
      r.ReturnReason && r.Status === 'returned' ? h('div', { class: 'alert err', style: { marginTop: '8px' } }, 'Lý do trả lại: ' + r.ReturnReason) : null,
      r.TransferImage ? h('p', null, UI.imgLink(r.TransferImage, 'Ảnh lịch sử CK')) : null,
      h('div', { class: 'section-title' }, 'Giao dịch tiền mặt (' + r.txns.length + ')'),
      r.txns.length ? h('ul', { class: 'list' }, r.txns.map(function (t) {
        return h('li', null, h('div', { class: 'txn' },
          h('div', { class: 'd' }, h('div', null, t.Description), h('div', { class: 'm' }, t.TxnTypeName + (t.CategoryName ? ' · ' + t.CategoryName : '') + (t.EmployeeName ? ' · ' + t.EmployeeName : '') + (t.Note ? ' · ' + t.Note : '')),
            t.ReceiptImage ? UI.imgLink(t.ReceiptImage, 'Ảnh hóa đơn') : null),
          h('div', { class: 'right' }, h('div', { class: 'a' }, money(t.Amount)),
            t.ApprovalStatus === 'pending' ? (opts.onApproveTxn ? h('button', { class: 'btn small primary', onclick: function () { opts.onApproveTxn(t); } }, 'Duyệt khoản') : UI.badge('pending', 'Chờ duyệt')) : null,
            opts.onAdjustTxn ? h('button', { class: 'linkish small', onclick: function () { opts.onAdjustTxn(t); } }, 'Điều chỉnh') : null)));
      })) : h('div', { class: 'muted small' }, 'Không có.'));
  }

  function viewReportView(id) {
    var body = page(isLeader() ? 'review' : 'my-reports', 'Chi tiết báo cáo', '#/my-reports');
    call('getReport', { reportId: id }).then(function (r) {
      if (!r) return;
      clear(body);
      body.appendChild(reportDetail(r, r.canReview ? { onApproveTxn: function (t) { call('approveTxn', { txnId: t.TxnID }).then(function (x) { if (x) { UI.toast('Đã duyệt khoản chi'); render(); } }); } } : {}));
      var acts = [];
      if (r.canEdit) acts.push(h('a', { class: 'btn primary grow', href: '#/report?id=' + r.ReportID }, r.Status === 'returned' ? 'Sửa và gửi lại' : 'Sửa báo cáo'));
      if (r.canReview) {
        acts.push(h('button', { class: 'btn', onclick: function () {
          UI.promptBox('Trả lại báo cáo', 'Lý do (người lập sẽ thấy)', { multiline: true, okLabel: 'Trả lại' }).then(function (v) {
            if (v) call('returnReport', { reportId: r.ReportID, reason: v }).then(function (x) { if (x) { UI.toast('Đã trả lại'); go('#/review'); } });
          });
        } }, 'Trả lại'));
        acts.push(h('button', { class: 'btn primary grow', onclick: function () {
          UI.confirmBox('Duyệt báo cáo?', ['Báo cáo sẽ bị khóa, chỉ chủ quán sửa được.'], 'Duyệt').then(function (ok) {
            if (ok) call('approveReport', { reportId: r.ReportID }).then(function (x) { if (x) { UI.toast('Đã duyệt'); go('#/review'); } });
          });
        } }, 'Duyệt báo cáo'));
      }
      if (acts.length) body.appendChild(h('div', { class: 'sticky-actions' }, acts));
    });
  }

  /* ---------- M08 Nhận ca ---------- */
  function viewHandover(q) {
    var body = page('home', 'Nhận ca', '#/home');
    call('pendingHandovers').then(function (list) {
      if (!list) return;
      clear(body);
      if (!list.length) { body.appendChild(UI.empty('Không có két nào chờ nhận.')); return; }
      var r = list.filter(function (x) { return x.ReportID === q.id; })[0] || list[0];
      if (list.length > 1) body.appendChild(h('div', { class: 'seg' }, list.map(function (x) {
        return h('button', { class: x.ReportID === r.ReportID ? 'on' : '', onclick: function () { go('#/handover?id=' + x.ReportID); } }, x.CheckpointName + ' ' + fmtDateVN(x.BusinessDate).slice(0, 5));
      })));
      body.appendChild(h('div', { class: 'status-card' }, h('div', { class: 'big' }, r.ReporterName + ' giao két'),
        h('div', { class: 'muted' }, 'Mốc ' + r.CheckpointName + ' · ' + fmtDateVN(r.BusinessDate) + ' · gửi lúc ' + String(r.SubmittedTime).slice(11, 16))));
      var counted = UI.moneyInput();
      var extra = h('div');
      var reason = h('textarea', { rows: 2 });
      var btn = h('button', { class: 'btn primary block big' }, 'Xác nhận nhận ca');
      body.appendChild(h('div', { class: 'card' }, UI.field('Tiền tôi đếm được', counted.el),
        h('div', { class: 'small muted' }, 'Hãy tự đếm két. Số người giao khai chỉ hiện sau khi bạn nhập số của mình.'), extra));
      body.appendChild(btn);
      var needReason = false;
      function submit(confirmWarnings) {
        if (counted.get() === '') { UI.toast('Nhập số tiền bạn đếm được', 'err'); return; }
        if (needReason && !reason.value.trim()) { UI.toast('Nhập lý do chênh lệch', 'err'); return; }
        btn.disabled = true;
        call('receiveHandover', { reportId: r.ReportID, cashCounted: counted.get(), reason: reason.value, confirmWarnings: confirmWarnings }).then(function (res) {
          btn.disabled = false;
          if (!res) return;
          if (res.needReason) {
            needReason = true;
            clear(extra);
            extra.appendChild(h('div', { class: 'alert warn' }, h('strong', null, 'Lệch ' + money(res.diff) + ' đ'), h('div', null, res.reporterName + ' khai ' + money(res.reporterCount) + ' đ')));
            extra.appendChild(UI.field('Lý do chênh lệch (bắt buộc)', reason));
            reason.focus();
            return;
          }
          if (res.needConfirm) {
            UI.confirmBox('Kiểm tra lại số tiền', res.warnings.map(function (w) { return '⚠ ' + w.text; }), 'Vẫn xác nhận').then(function (ok) { if (ok) submit(true); });
            return;
          }
          UI.toast(res.diff ? 'Đã nhận ca, chênh lệch đã được ghi lại' : 'Đã nhận ca, két khớp');
          go('#/home');
        });
      }
      btn.onclick = function () { submit(false); };
    });
  }

  /* ---------- M09 Báo cáo của tôi ---------- */
  function viewMyReports(q) {
    var month = q.month || fmtTs(Date.now()).slice(0, 7);
    var body = page('my-reports', 'Báo cáo của tôi');
    call('myReports', { month: month }).then(function (list) {
      if (!list) return;
      clear(body);
      var mInput = h('input', { type: 'month', value: month, onchange: function () { go('#/my-reports?month=' + mInput.value); } });
      body.appendChild(h('div', { class: 'row' }, h('div', { class: 'grow' }, UI.field('Tháng', mInput)), user().IsCashier ? h('a', { class: 'btn primary', href: '#/report' }, '+ Lập báo cáo') : null));
      if (!list.length) { body.appendChild(UI.empty('Chưa có báo cáo trong tháng.')); return; }
      body.appendChild(h('div', { class: 'card' }, h('ul', { class: 'list' }, list.map(function (r) {
        return h('li', { class: 'click', onclick: function () { go('#/report-view/' + r.ReportID); } },
          h('div', { class: 'row between' }, h('strong', null, r.CheckpointName + ' · ' + fmtDateVN(r.BusinessDate)), UI.badge(r.Status, r.StatusName)),
          h('div', { class: 'small muted' }, 'Két ' + money(r.CashCounted) + ' đ' + (r.IsOpening ? '' : ' · CK ' + money(r.TransferAmount) + ' đ') + ' · ' + r.txns.length + ' giao dịch' +
            (r.ReceiverID === user().EmployeeID ? ' · bạn nhận ca' : '')));
      }))));
    });
  }

  /* ---------- M10 + M11 Duyệt ---------- */
  function viewReview(q) {
    var tab = q.tab || 'reports';
    var body = page('review', 'Duyệt');
    var seg = h('div', { class: 'seg' },
      h('button', { class: tab === 'reports' ? 'on' : '', onclick: function () { go('#/review'); } }, 'Báo cáo ca'),
      h('button', { class: tab === 'att' ? 'on' : '', onclick: function () { go('#/review?tab=att'); } }, 'Chấm công'));
    if (tab === 'reports') {
      call('pendingReports').then(function (list) {
        if (!list) return;
        clear(body); body.appendChild(seg);
        if (!list.length) { body.appendChild(UI.empty('Không có báo cáo chờ duyệt.')); return; }
        body.appendChild(h('div', { class: 'card' }, h('ul', { class: 'list' }, list.map(function (r) {
          var flag = r.pendingTxns || r.Difference || r.HandoverDifference;
          return h('li', { class: 'click', onclick: function () { go('#/report-view/' + r.ReportID); } },
            h('div', { class: 'row between' }, h('strong', null, r.CheckpointName + ' · ' + fmtDateVN(r.BusinessDate)), flag ? UI.badge('pending', 'Cần xem') : UI.badge(r.Status, r.StatusName)),
            h('div', { class: 'small muted' }, r.ReporterName + ' · két ' + money(r.CashCounted) + ' đ' + (r.IsOpening ? '' : ' · CK ' + money(r.TransferAmount) + ' đ') +
              (r.pendingTxns ? ' · ' + r.pendingTxns + ' khoản chờ duyệt' : '') + (r.Difference ? ' · lệch đầu ngày ' + money(r.Difference) : '') + (r.HandoverDifference ? ' · lệch bàn giao ' + money(r.HandoverDifference) : '')));
        }))));
      });
    } else {
      call('pendingAttendance').then(function (list) {
        if (!list) return;
        clear(body); body.appendChild(seg);
        if (!list.length) { body.appendChild(UI.empty('Không có lượt chấm công cần duyệt.')); return; }
        body.appendChild(h('div', { class: 'card' }, h('ul', { class: 'list' }, list.map(function (a) {
          return h('li', null,
            h('div', { class: 'row between' }, h('strong', null, a.EmployeeName + ' · ' + fmtDateVN(a.BusinessDate) + ' · ' + a.ShiftName), UI.badge(a.Status, a.StatusName)),
            h('div', { class: 'small muted' }, 'Vào ' + (a.CheckInTime ? String(a.CheckInTime).slice(11, 16) : '—') + ' · Ra ' + (a.CheckOutTime ? String(a.CheckOutTime).slice(11, 16) : '—') + (a.WorkHours ? ' · ' + a.WorkHours + ' giờ' : '')),
            a.RequestReason ? h('div', { class: 'small' }, 'Lý do: ' + a.RequestReason) : null,
            a.Note ? h('div', { class: 'small muted' }, a.Note) : null,
            h('div', { class: 'row', style: { marginTop: '8px' } },
              a.CheckOutTime && a.CheckInTime ? h('button', { class: 'btn small primary', onclick: function () { call('approveAttendance', { attendanceId: a.AttendanceID }).then(function (x) { if (x) { UI.toast('Đã duyệt'); render(); } }); } }, 'Duyệt') : null,
              h('button', { class: 'btn small', onclick: function () { editAttModal(a); } }, 'Sửa giờ'),
              h('button', { class: 'btn small', onclick: function () {
                UI.promptBox('Từ chối lượt công', 'Lý do', { okLabel: 'Từ chối' }).then(function (v) { if (v) call('rejectAttendance', { attendanceId: a.AttendanceID, reason: v }).then(function (x) { if (x) { UI.toast('Đã từ chối'); render(); } }); });
              } }, 'Từ chối')));
        }))));
      });
    }
  }

  function editAttModal(a) {
    var tin = h('input', { type: 'time', value: a.CheckInTime ? String(a.CheckInTime).slice(11, 16) : '' });
    var tout = h('input', { type: 'time', value: a.CheckOutTime ? String(a.CheckOutTime).slice(11, 16) : '' });
    var reason = h('input', { type: 'text', placeholder: 'Vd: quên bấm ra ca, xác nhận với camera' });
    var err = h('div', { class: 'field-err' });
    UI.modal('Sửa giờ – ' + a.EmployeeName + ' ' + fmtDateVN(a.BusinessDate), h('div', null,
      h('div', { class: 'row' }, h('div', { class: 'grow' }, UI.field('Giờ vào', tin)), h('div', { class: 'grow' }, UI.field('Giờ ra', tout))), UI.field('Lý do (bắt buộc)', reason), err),
      [{ label: 'Hủy', value: null }, { label: 'Lưu', primary: true, value: true, validate: function () { if (!tin.value || !tout.value || !reason.value.trim()) { err.textContent = 'Nhập đủ giờ vào, giờ ra và lý do'; return false; } return true; } }])
      .then(function (ok) {
        if (ok) call('editAttendance', { attendanceId: a.AttendanceID, checkIn: tin.value, checkOut: tout.value, reason: reason.value }).then(function (x) { if (x) { UI.toast('Đã sửa và duyệt'); render(); } });
      });
  }

  /* ---------- Tài khoản ---------- */
  function viewAccount() {
    var u = user();
    var body = page('account', 'Tài khoản');
    clear(body);
    body.appendChild(h('div', { class: 'card' }, h('dl', { class: 'kv' },
      h('dt', null, 'Tên'), h('dd', null, u.DisplayName), h('dt', null, 'Mã nhân viên'), h('dd', null, u.EmployeeID),
      h('dt', null, 'Vai trò'), h('dd', null, u.RoleName), h('dt', null, 'Quyền thu ngân'), h('dd', null, u.IsCashier ? 'Có' : 'Không'))));
    body.appendChild(h('a', { class: 'btn block', href: '#/change-pin' }, 'Đổi mã PIN'));
    body.appendChild(h('div', { class: 'card tint' }, h('h3', null, 'Cài lên màn hình chính'),
      h('p', { class: 'small' }, 'Android (Chrome): bấm ⋮ → "Thêm vào màn hình chính".'),
      h('p', { class: 'small' }, 'iPhone (Safari): bấm nút Chia sẻ → "Thêm vào MH chính".')));
    body.appendChild(h('button', { class: 'btn block danger', onclick: function () {
      Api.call('logout').then(function () { setSession(null); go('#/login'); });
    } }, 'Đăng xuất'));
    body.appendChild(h('p', { class: 'small muted', style: { textAlign: 'center' } }, 'Phiên bản ' + APP.version + (Api.mode === 'demo' ? ' · chế độ demo' : '')));
  }

  /* ---------- Bộ định tuyến ---------- */
  function render() {
    var r = parseHash(), p = r.parts, u = user();
    if (p[0] === 'login' || !u) { if (u && p[0] === 'login') return go('#/home'); return viewLogin(); }
    if (p[0] === 'change-pin') return viewChangePin();
    if (u.MustChange) return go('#/change-pin');
    switch (p[0]) {
      case undefined: case 'home': return viewHome();
      case 'checkin': return viewCheckin();
      case 'my-attendance': return viewMyAttendance(r.q);
      case 'attendance-request': return viewAttendanceRequest();
      case 'report': return viewReport(r.q);
      case 'report-view': return viewReportView(p[1]);
      case 'handover': return viewHandover(r.q);
      case 'my-reports': return viewMyReports(r.q);
      case 'review': return isLeader() ? viewReview(r.q) : go('#/home');
      case 'account': return viewAccount();
      case 'admin': return isAdmin() && window.Admin ? Admin.render(p.slice(1), r.q) : go('#/home');
      default: return go('#/home');
    }
  }

  window.App = {
    refresh: render, go: go, call: call, user: user, reportDetail: reportDetail, topbar: topbar, levelClass: levelClass, openRecord: openRecord, clear: clear
  };
  window.addEventListener('hashchange', render);
  call('config').then(function (c) { if (c) { window.STORE_NAME = c.storeName; window.STORE_ADDRESS = c.storeAddress; document.title = c.storeName; } render(); });
})();
