/* Web quản trị – chủ quán (W01–W09) + nhập dữ liệu Excel. */
(function () {
  var h = UI.h, money = UI.money, call = function (a, p, o) { return App.call(a, p, o); }, clear = function (e) { return App.clear(e); };
  var app = document.getElementById('app');

  var MENU = [
    ['', '📊', 'Dashboard'], ['shifts', '📍', 'Nhật ký ca'], ['days', '📅', 'Doanh thu ngày'], ['expenses', '💸', 'Chi phí'], ['attendance', '🕒', 'Chấm công'],
    ['funds', '🏦', 'Quỹ & ứng lương'], ['alerts', '🔔', 'Cảnh báo'], ['employees', '👥', 'Nhân viên'], ['config', '⚙️', 'Cấu hình'],
    ['audit', '📜', 'Nhật ký'], ['import', '📥', 'Nhập dữ liệu Excel']
  ];

  function menuLinks(active, onClick) {
    return MENU.map(function (m) {
      return h('a', { href: '#/admin' + (m[0] ? '/' + m[0] : ''), class: active === m[0] ? 'on' : '', onclick: onClick }, h('span', null, m[1]), m[2]);
    }).concat([h('div', { class: 'sep' }), h('a', { href: '#/home', onclick: onClick }, h('span', null, '📱'), 'Ứng dụng nhân viên'),
      h('a', { href: '#/review', onclick: onClick }, h('span', null, '✅'), 'Duyệt báo cáo / công'), h('a', { href: '#/account', onclick: onClick }, h('span', null, '👤'), 'Tài khoản')]);
  }

  function layout(active, title, actions) {
    app.className = 'layout-admin';
    app.innerHTML = '';
    var openDrawer = function () {
      var back = h('div', { class: 'drawer-back', onclick: function () { back.remove(); dr.remove(); } });
      var dr = h('nav', { class: 'drawer' }, menuLinks(active, function () { back.remove(); dr.remove(); }));
      document.body.appendChild(back); document.body.appendChild(dr);
    };
    var tb = App.topbar({ menu: openDrawer });
    app.appendChild(tb);
    app.appendChild(h('nav', { class: 'side' }, menuLinks(active)));
    var body = h('div', { class: 'stack' });
    app.appendChild(h('main', null, h('div', { class: 'row between' }, h('h1', { style: { margin: 0 } }, title), actions ? h('div', { class: 'row' }, actions) : null), body));
    body.appendChild(UI.spinner());
    return body;
  }

  function pct(cur, prev, lowerIsBetter) {
    if (!prev) return null;
    var p = Math.round((cur - prev) / Math.abs(prev) * 100);
    var good = lowerIsBetter ? p <= 0 : p >= 0;
    return h('div', { class: 'c ' + (good ? 'up' : 'down') }, (p >= 0 ? '▲ ' : '▼ ') + Math.abs(p) + '% so với kỳ trước');
  }

  function periodSeg(cur, onPick) {
    var opts = [['today', 'Hôm nay'], ['week', 'Tuần'], ['month', 'Tháng'], ['year', 'Năm'], ['custom', 'Tùy chọn']];
    return h('div', { class: 'seg' }, opts.map(function (o) { return h('button', { class: cur === o[0] ? 'on' : '', onclick: function () { onPick(o[0]); } }, o[1]); }));
  }

  function qs(q) { return Object.keys(q).filter(function (k) { return q[k] !== '' && q[k] !== undefined; }).map(function (k) { return k + '=' + encodeURIComponent(q[k]); }).join('&'); }

  /* ---- Biểu đồ SVG ---- */
  var PALETTE = ['#6b2e1d', '#b9853a', '#2e7d4f', '#2459a6', '#8c5bb3', '#c0582d', '#5f8a8b', '#9b8f7a'];

  function barChart(series) {
    var W = 720, H = 260, L = 56, R = 12, T = 16, B = 34;
    var max = Math.max.apply(null, series.map(function (s) { return s.revenue; }).concat([1]));
    var step = niceStep(max / 4), top = Math.ceil(max / step) * step;
    var bw = (W - L - R) / series.length;
    var y = function (v) { return T + (H - T - B) * (1 - Math.max(0, v) / top); };
    var parts = [];
    for (var g = 0; g <= top + 1; g += step) {
      parts.push('<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(g) + '" y2="' + y(g) + '" stroke="#eee3d1"/>');
      parts.push('<text x="' + (L - 6) + '" y="' + (y(g) + 4) + '" text-anchor="end" font-size="11" fill="#7a6a60">' + short(g) + '</text>');
    }
    series.forEach(function (s, i) {
      var x = L + i * bw + 2, v = s.revenue;
      var color = !s.hasData ? '#e6dccb' : s.hasClosing ? '#6b2e1d' : '#c99a6b';
      parts.push('<rect x="' + x + '" y="' + y(v) + '" width="' + Math.max(2, bw - 4) + '" height="' + Math.max(0, H - B - y(v)) + '" rx="2" fill="' + color + '"><title>' + fmtDateVN(s.date) + ': ' + fmtMoney(v) + ' đ' + (s.hasClosing ? '' : ' (chưa chốt)') + '</title></rect>');
      if (i % 5 === 0 || i === series.length - 1) parts.push('<text x="' + (x + bw / 2 - 2) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="11" fill="#7a6a60">' + s.date.slice(8, 10) + '/' + s.date.slice(5, 7) + '</text>');
    });
    // Đường trung bình 7 ngày (chỉ ngày có số liệu).
    var pts = [];
    series.forEach(function (s, i) {
      var win = series.slice(Math.max(0, i - 6), i + 1).filter(function (x) { return x.hasData; });
      if (win.length >= 3) pts.push((L + i * bw + bw / 2) + ',' + y(win.reduce(function (a, x) { return a + x.revenue; }, 0) / win.length));
    });
    if (pts.length > 1) parts.push('<polyline points="' + pts.join(' ') + '" fill="none" stroke="#b9853a" stroke-width="2.5" stroke-linejoin="round"/>');
    var svg = h('div');
    svg.innerHTML = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Doanh thu 30 ngày">' + parts.join('') + '</svg>';
    return svg.firstChild;
  }
  function niceStep(x) { var p = Math.pow(10, Math.floor(Math.log10(Math.max(x, 1)))); var n = x / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
  function short(v) { return v >= 1e6 ? (v / 1e6).toFixed(v % 1e6 ? 1 : 0).replace('.', ',') + 'tr' : v >= 1e3 ? Math.round(v / 1e3) + 'k' : String(v); }

  function donut(mix) {
    var total = mix.reduce(function (a, m) { return a + m.amount; }, 0);
    var wrap = h('div', { class: 'row', style: { alignItems: 'center', gap: '16px' } });
    if (!total) { wrap.appendChild(UI.empty('Không có chi phí trong kỳ.')); return wrap; }
    var R = 60, C = 2 * Math.PI * R, off = 0, segs = [];
    mix.forEach(function (m, i) {
      var len = m.amount / total * C;
      segs.push('<circle cx="80" cy="80" r="' + R + '" fill="none" stroke="' + PALETTE[i % PALETTE.length] + '" stroke-width="26" stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 80 80)"><title>' + m.Name + ': ' + m.share + '%</title></circle>');
      off += len;
    });
    var d = h('div'); d.innerHTML = '<svg viewBox="0 0 160 160" width="140" height="140" role="img" aria-label="Cơ cấu chi phí">' + segs.join('') +
      '<text x="80" y="78" text-anchor="middle" font-size="12" fill="#7a6a60">Tổng chi</text><text x="80" y="96" text-anchor="middle" font-size="15" font-weight="700" fill="#2a1a14">' + short(total) + '</text></svg>';
    wrap.appendChild(d.firstChild);
    wrap.appendChild(h('div', { class: 'grow' }, mix.map(function (m, i) {
      return h('div', { class: 'row between small', style: { padding: '3px 0' } }, h('span', null, h('i', { style: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: PALETTE[i % PALETTE.length], marginRight: '6px' } }), m.Name),
        h('span', { class: 'num' }, money(m.amount) + ' · ' + m.share + '%'));
    })));
    return wrap;
  }

  /* ---- W01 Dashboard ---- */
  function viewDashboard(q) {
    var period = q.period || 'today';
    var body = layout('', 'Dashboard');
    var fromI = h('input', { type: 'date', value: q.from || '' }), toI = h('input', { type: 'date', value: q.to || '' });
    call('dashboard', { period: period, from: q.from, to: q.to }).then(function (d) {
      if (!d) return;
      clear(body);
      body.appendChild(h('div', { class: 'row between' }, periodSeg(period, function (p) { App.go('#/admin?' + qs({ period: p })); }),
        h('span', { class: 'small muted' }, 'Kỳ: ' + fmtDateVN(d.range.from) + ' – ' + fmtDateVN(d.range.to))));
      if (period === 'custom') body.appendChild(h('div', { class: 'filters' }, UI.field('Từ ngày', fromI), UI.field('Đến ngày', toI),
        h('button', { class: 'btn', onclick: function () { App.go('#/admin?' + qs({ period: 'custom', from: fromI.value, to: toI.value })); } }, 'Xem')));
      var c = d.current, p = d.previous;
      var kpi = function (label, value, prev, href, note, lowerIsBetter) {
        return h('div', { class: 'kpi', onclick: function () { if (href) App.go(href); } }, h('div', { class: 'l' }, label), h('div', { class: 'v' }, money(value) + ' đ'), prev === undefined ? (note ? h('div', { class: 'c muted' }, note) : null) : pct(value, prev, lowerIsBetter));
      };
      body.appendChild(h('div', { class: 'kpis' },
        kpi('Doanh thu hôm nay', d.revenueToday, undefined, '#/admin/day/' + d.today, 'Ngày ' + fmtDateVN(d.today)),
        kpi('Doanh thu tháng', d.revenueMonth, undefined, '#/admin/days', 'Từ đầu tháng'),
        kpi('Doanh thu năm', d.revenueYear, undefined, '#/admin/days', 'Từ đầu năm'),
        kpi('Lợi nhuận (kỳ)', c.profit, p.profit, '#/admin/days'),
        kpi('Tiền chuyển khoản (kỳ)', c.transfer, p.transfer, '#/admin/days'),
        kpi('Tiền mặt bán hàng (kỳ)', c.cash, p.cash, '#/admin/days'),
        kpi('Tổng chi phí (kỳ)', c.expense, p.expense, '#/admin/expenses?' + qs({ period: period }), null, true),
        kpi('Tồn két hiện tại', d.cashOnHand.amount, undefined, '#/admin/funds', d.cashOnHand.label)));
      body.appendChild(h('div', { class: 'grid2' },
        h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h3', null, 'Doanh thu 30 ngày gần nhất'),
          h('div', { class: 'legend' }, h('span', null, h('i', { style: { background: '#6b2e1d' } }), 'Đã chốt'), h('span', null, h('i', { style: { background: '#c99a6b' } }), 'Tạm tính'), h('span', null, h('i', { style: { background: '#b9853a', height: '3px' } }), 'TB 7 ngày'))),
          barChart(d.series)),
        h('div', { class: 'card' }, h('h3', null, 'Cơ cấu chi phí (kỳ)'), donut(d.expenseMix))));
      body.appendChild(h('div', { class: 'grid2 even' },
        h('div', { class: 'card' }, h('h3', null, 'Tình trạng hôm nay'),
          h('div', { class: 'pills' }, d.checkpoints.map(function (cp) {
            var done = cp.status && cp.status !== 'draft';
            return h('span', { class: 'pill ' + (done ? 'done' : cp.IsRequired ? 'need' : '') }, (done ? '✓ ' : '') + cp.Name + (done ? ' · ' + cp.reporter : cp.IsRequired ? ' · hạn ' + cp.Deadline : ''));
          })),
          h('div', { class: 'section-title' }, 'Đang trong ca (' + d.working.length + ')'),
          d.working.length ? h('div', { class: 'small' }, d.working.map(function (w) { return w.EmployeeName + ' (' + w.ShiftName + ', vào ' + String(w.CheckInTime).slice(11, 16) + ')'; }).join(' · ')) : h('div', { class: 'small muted' }, 'Không có ai.')),
        h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h3', null, 'Cảnh báo mới'), h('a', { href: '#/admin/alerts', class: 'small' }, 'Xem tất cả')),
          d.alerts.length ? h('ul', { class: 'list' }, d.alerts.map(function (n) {
            return h('li', { class: 'click', onclick: function () { App.openRecord(n.RecordRef); } }, h('span', { class: 'badge ' + App.levelClass(n.Level) }, n.Code), ' ', h('span', { class: 'small' }, n.Message));
          })) : h('div', { class: 'small muted' }, 'Không có cảnh báo.'))));
    });
  }

  /* ---- W02 Doanh thu theo ngày ---- */
  function viewDays(q) {
    var month = q.month || fmtTs(Date.now()).slice(0, 7);
    var mInput = h('input', { type: 'month', value: month, onchange: function () { App.go('#/admin/days?month=' + mInput.value); } });
    var rowsCache = [];
    var exportBtn = h('button', { class: 'btn small', onclick: function () {
      UI.downloadCsv('doanh-thu-' + month + '.csv', [['Ngày', 'Két đầu', 'CK', 'Két cuối', 'Chi phí', 'Ứng lương', 'Rút quỹ', 'Nộp quỹ', 'Doanh thu', 'Lợi nhuận', 'Chênh lệch', 'Trạng thái']]
        .concat(rowsCache.map(function (r) { return [r.BusinessDate, r.OpeningCounted, r.TotalTransfer, r.ClosingCash, r.TotalExpense, r.TotalAdvance, r.TotalWithdraw, r.TotalDeposit, r.Revenue, r.Profit, r.TotalDifference, r.Status]; })));
    } }, '⬇ Xuất Excel');
    var body = layout('days', 'Doanh thu theo ngày', exportBtn);
    call('businessDays', { month: month }).then(function (rows) {
      if (!rows) return;
      rowsCache = rows;
      clear(body);
      body.appendChild(h('div', { class: 'filters' }, UI.field('Tháng', mInput)));
      if (!rows.length) { body.appendChild(UI.empty('Không có số liệu trong tháng.')); return; }
      var cols = [['Ngày', null], ['Két đầu', 'OpeningCounted'], ['CK', 'TotalTransfer'], ['Két cuối', 'ClosingCash'], ['Chi phí', 'TotalExpense'], ['Ứng lương', 'TotalAdvance'], ['Rút quỹ', 'TotalWithdraw'], ['Nộp quỹ', 'TotalDeposit'], ['Doanh thu', 'Revenue'], ['Lợi nhuận', 'Profit'], ['Chênh lệch', 'TotalDifference']];
      var tot = {};
      rows.forEach(function (r) { cols.forEach(function (c) { if (c[1]) tot[c[1]] = (tot[c[1]] || 0) + toNum(r[c[1]]); }); });
      body.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 't' },
        h('thead', null, h('tr', null, cols.map(function (c) { return h('th', { class: c[1] ? 'num' : '' }, c[0]); }), h('th', null, 'Trạng thái'))),
        h('tbody', null, rows.map(function (r) {
          return h('tr', { class: 'click' + (r.missingClosing || toNum(r.Revenue) < 0 ? ' bad' : ''), onclick: function () { App.go('#/admin/day/' + r.BusinessDate); } },
            cols.map(function (c) { return c[1] ? h('td', { class: 'num' }, money(r[c[1]])) : h('td', null, fmtDateVN(r.BusinessDate)); }),
            h('td', null, r.missingClosing ? UI.badge('rejected', 'Thiếu cuối ngày') : UI.badge(r.Status, { open: 'Đang mở', submitted: 'Chờ duyệt', closed: 'Đã chốt', adjusted: 'Đã điều chỉnh' }[r.Status] || r.Status)));
        })),
        h('tfoot', null, h('tr', null, cols.map(function (c) {
          if (!c[1]) return h('td', null, 'Cộng');
          return h('td', { class: 'num' }, ['OpeningCounted', 'ClosingCash'].indexOf(c[1]) >= 0 ? '' : money(tot[c[1]]));
        }), h('td', null))))));
      body.appendChild(h('p', { class: 'small muted' }, 'Doanh thu = CK + Két cuối + Chi phí + Ứng lương + Rút quỹ − Nộp quỹ − Két đầu (F-03). Hoàn tiền khách không cộng lại. Lợi nhuận = Doanh thu − Chi phí.'));
    });
  }

  function viewDay(bd) {
    var body = layout('days', 'Chi tiết ngày ' + fmtDateVN(bd), h('a', { class: 'btn small', href: '#/admin/days?month=' + bd.slice(0, 7) }, '‹ Danh sách'));
    call('dayDetail', { businessDate: bd }).then(function (d) {
      if (!d) return;
      clear(body);
      var day = d.day;
      body.appendChild(h('div', { class: 'kpis' },
        tile('Doanh thu', day.Revenue), tile('Lợi nhuận', day.Profit), tile('Tiền CK', day.TotalTransfer), tile('Tổng chênh lệch', day.TotalDifference)));
      body.appendChild(h('div', { class: 'card' }, h('dl', { class: 'kv' },
        h('dt', null, 'Két chuyển sang (F-01)'), h('dd', null, d.carried === null ? '—' : money(d.carried) + ' đ'),
        h('dt', null, 'Két đầu ngày'), h('dd', null, money(day.OpeningCounted) + ' đ'),
        h('dt', null, 'Két cuối ngày'), h('dd', null, money(day.ClosingCash) + ' đ' + (toBool(day.HasClosing) ? '' : ' (tạm, chưa có Cuối ngày)')),
        h('dt', null, 'Chi phí / Ứng lương'), h('dd', null, money(day.TotalExpense) + ' / ' + money(day.TotalAdvance) + ' đ'),
        h('dt', null, 'Rút quỹ / Nộp quỹ'), h('dd', null, money(day.TotalWithdraw) + ' / ' + money(day.TotalDeposit) + ' đ'),
        h('dt', null, 'Hoàn tiền khách'), h('dd', null, money(day.TotalRefund) + ' đ'))));
      if (!d.reports.length) body.appendChild(UI.empty('Chưa có báo cáo ca.'));
      d.reports.forEach(function (r) {
        var card = App.reportDetail(r, { onAdjustTxn: adjustTxnModal, onApproveTxn: function (t) { call('approveTxn', { txnId: t.TxnID }).then(function (x) { if (x) { UI.toast('Đã duyệt khoản'); App.refresh(); } }); } });
        card.appendChild(h('div', { class: 'row', style: { marginTop: '10px' } },
          h('button', { class: 'btn small', onclick: function () { adjustReportModal(r); } }, 'Điều chỉnh số'),
          r.Status === 'submitted' ? h('a', { class: 'btn small primary', href: '#/report-view/' + r.ReportID }, 'Duyệt / trả lại') : null));
        body.appendChild(card);
      });
      if (d.afterClose.length) body.appendChild(h('div', { class: 'card' }, h('h3', null, 'Rút/nộp quỹ sau đóng cửa'), h('ul', { class: 'list' }, d.afterClose.map(function (t) {
        return h('li', { class: 'txn' }, h('div', { class: 'd' }, t.Description, h('div', { class: 'm' }, t.TxnTypeName + ' · ' + t.CreatedByName)), h('div', { class: 'a' }, money(t.Amount)));
      }))));
      body.appendChild(h('div', { class: 'card' }, h('h3', null, 'Chấm công trong ngày (' + d.attendance.length + ')'),
        d.attendance.length ? h('div', { class: 'small' }, d.attendance.map(function (a) {
          return a.EmployeeName + ' ' + a.ShiftName + ' (' + (a.CheckInTime ? String(a.CheckInTime).slice(11, 16) : '—') + '–' + (a.CheckOutTime ? String(a.CheckOutTime).slice(11, 16) : '—') + ')';
        }).join(' · ')) : h('div', { class: 'small muted' }, 'Không có.')));
    });
  }
  function tile(l, v) { return h('div', { class: 'kpi' }, h('div', { class: 'l' }, l), h('div', { class: 'v' }, money(v) + ' đ')); }

  function adjustReportModal(r) {
    var cash = UI.moneyInput({ value: r.CashCounted }), tr = UI.moneyInput({ value: r.TransferAmount }), ho = UI.moneyInput({ value: r.ReceiverID ? r.CashHandedOver : '' });
    var reason = h('input', { type: 'text', placeholder: 'Vd: nhân viên gõ thiếu số 0, đã xác nhận' });
    var err = h('div', { class: 'field-err' });
    UI.modal('Điều chỉnh ' + r.CheckpointName + ' ' + fmtDateVN(r.BusinessDate), h('div', null,
      h('div', { class: 'alert info' }, 'Mọi điều chỉnh được ghi nhật ký kèm giá trị cũ và lý do. Doanh thu ngày này và két chuyển sang ngày sau được tính lại.'),
      UI.field('Tiền mặt đếm', cash.el), r.IsOpening ? null : UI.field('Tiền CK', tr.el), r.ReceiverID ? UI.field('Người nhận ca đếm', ho.el) : null,
      UI.field('Lý do (bắt buộc)', reason), err),
      [{ label: 'Hủy', value: null }, { label: 'Lưu điều chỉnh', primary: true, value: true, validate: function () { if (!reason.value.trim()) { err.textContent = 'Nhập lý do'; return false; } return true; } }])
      .then(function (ok) {
        if (!ok) return;
        call('adjustReport', { reportId: r.ReportID, reason: reason.value, fields: { CashCounted: cash.get(), TransferAmount: r.IsOpening ? undefined : tr.get(), CashHandedOver: r.ReceiverID ? ho.get() : undefined } })
          .then(function (x) { if (x) { UI.toast('Đã điều chỉnh'); App.refresh(); } });
      });
  }

  var cfgCache = null;
  function getCfg() { return cfgCache ? Promise.resolve(cfgCache) : call('getConfig').then(function (c) { cfgCache = c; return c; }); }
  var empCache = null;
  function getEmps() { return empCache ? Promise.resolve(empCache) : call('listEmployees').then(function (e) { empCache = e; return e; }); }

  function adjustTxnModal(t) {
    Promise.all([getCfg(), getEmps()]).then(function (res) {
      var cfg = res[0], emps = res[1];
      var type = UI.select(Object.keys(TXN_TYPES).map(function (k) { return { value: k, label: TXN_TYPES[k] }; }), t.TxnType);
      var cat = UI.select([{ value: '', label: '—' }].concat(cfg.categories.map(function (c) { return { value: c.CategoryID, label: c.Name }; })), t.CategoryID);
      var emp = UI.select([{ value: '', label: '—' }].concat(emps.map(function (e) { return { value: e.EmployeeID, label: e.DisplayName }; })), t.EmployeeID);
      var amt = UI.moneyInput({ value: t.Amount });
      var del = h('input', { type: 'checkbox' });
      var reason = h('input', { type: 'text' });
      var err = h('div', { class: 'field-err' });
      UI.modal('Điều chỉnh giao dịch', h('div', null, h('p', { class: 'small muted' }, t.Description + (t.Note ? ' · ' + t.Note : '')),
        UI.field('Loại', type), UI.field('Nhóm chi (khi Chi phí)', cat), UI.field('Nhân viên (khi Ứng lương)', emp), UI.field('Số tiền', amt.el),
        h('label', { class: 'row small' }, del, 'Đánh dấu xóa (nhập trùng / sai)'), UI.field('Lý do (bắt buộc)', reason), err),
        [{ label: 'Hủy', value: null }, { label: 'Lưu', primary: true, value: true, validate: function () { if (!reason.value.trim()) { err.textContent = 'Nhập lý do'; return false; } return true; } }])
        .then(function (ok) {
          if (!ok) return;
          call('adjustTxn', { txnId: t.TxnID, reason: reason.value, fields: { TxnType: type.value, CategoryID: type.value === 'expense' ? cat.value : '', EmployeeID: type.value === 'advance' ? emp.value : '', Amount: amt.get(), Deleted: del.checked } })
            .then(function (x) { if (x) { UI.toast('Đã điều chỉnh giao dịch'); App.refresh(); } });
        });
    });
  }

  /* ---- W10 Nhật ký ca: vị trí vào/ra, ảnh hiện trạng, đã bấm gửi Zalo ---- */
  function imgSrc(u) { return window.resolveImage ? window.resolveImage(u) : u; }
  function mapLink(locStr, dist) {
    if (!locStr) return h('span', { class: 'badge orange' }, 'Không có vị trí');
    var ll = String(locStr).split(' ')[0];
    return h('a', { href: 'https://maps.google.com/?q=' + ll, target: '_blank', rel: 'noopener' }, dist === null || dist === undefined ? 'Xem bản đồ' : 'cách quán ' + dist + ' m');
  }
  function viewShifts(q) {
    var today = fmtTs(Date.now() - 4 * 3600000).slice(0, 10);
    var from = q.from || addDays(today, -6), to = q.to || today;
    var body = layout('shifts', 'Nhật ký ca');
    Promise.all([getEmps(), call('shiftLog', { from: from, to: to, employeeId: q.emp })]).then(function (res) {
      var emps = res[0], list = res[1];
      if (!list) return;
      clear(body);
      var fr = h('input', { type: 'date', value: from }), tt = h('input', { type: 'date', value: to });
      var es = UI.select([{ value: '', label: 'Tất cả nhân viên' }].concat((emps || []).map(function (e) { return { value: e.EmployeeID, label: e.DisplayName }; })), q.emp || '');
      body.appendChild(h('div', { class: 'filters' }, UI.field('Từ', fr), UI.field('Đến', tt), UI.field('Nhân viên', es),
        h('button', { class: 'btn', onclick: function () { App.go('#/admin/shifts?' + qs({ from: fr.value, to: tt.value, emp: es.value })); } }, 'Lọc')));
      var radius = '';
      body.appendChild(h('p', { class: 'small muted' }, 'Nhân viên gửi tin vào nhóm Zalo bằng nút chia sẻ trên điện thoại. Cột Zalo cho biết họ đã bấm chia sẻ hay chưa; hãy đối chiếu với tin trong nhóm.'));
      if (!list.length) { body.appendChild(UI.empty('Không có lượt chấm công trong khoảng này.')); return; }
      body.appendChild(h('div', { class: 'stack' }, list.map(function (a) {
        var far = function (dd) { return dd !== null && dd !== undefined && dd > 150; };
        return h('div', { class: 'card' },
          h('div', { class: 'row between' }, h('strong', null, a.EmployeeName + ' · ' + a.ShiftName + ' · ' + fmtDateVN(a.BusinessDate)), UI.badge(a.Status, a.StatusName)),
          h('dl', { class: 'kv', style: { marginTop: '8px' } },
            h('dt', null, 'Vào ca ' + (a.CheckInTime ? String(a.CheckInTime).slice(11, 16) : '—')), h('dd', null, mapLink(a.CheckInLocation, a.CheckInDistance), far(a.CheckInDistance) ? ' ⚠' : ''),
            h('dt', null, 'Ra ca ' + (a.CheckOutTime ? String(a.CheckOutTime).slice(11, 16) : '—')), h('dd', null, a.CheckOutTime ? mapLink(a.CheckOutLocation, a.CheckOutDistance) : '—', far(a.CheckOutDistance) ? ' ⚠' : ''),
            h('dt', null, 'Zalo'), h('dd', null, (a.SharedIn ? '✓ vào ca ' : '✗ vào ca ') + ' · ' + (a.CheckOutTime ? (a.SharedOut ? '✓ ra ca' : '✗ ra ca') : '—'))),
          a.CheckoutPhotos.length ? h('div', { class: 'photo-row', style: { marginTop: '8px' } }, a.CheckoutPhotos.map(function (u, i) {
            return h('img', { src: imgSrc(u), alt: 'Ảnh hiện trạng ' + (i + 1), loading: 'lazy', onclick: function () { UI.modal('Ảnh hiện trạng ' + (i + 1), h('img', { src: imgSrc(u), class: 'preview' })); } });
          })) : (a.CheckOutTime ? h('div', { class: 'small muted' }, 'Không có ảnh hiện trạng') : null));
      })));
    });
  }

  /* ---- W03 Báo cáo chi phí ---- */
  function viewExpenses(q) {
    var period = q.period || 'month';
    var data = null;
    var exportBtn = h('button', { class: 'btn small', onclick: function () {
      if (!data) return;
      UI.downloadCsv('chi-phi-' + data.range.from + '_' + data.range.to + '.csv', [['Ngày', 'Nhóm chi', 'Số tiền', 'Nội dung', 'Người chi', 'Ghi chú']]
        .concat(data.rows.map(function (t) { return [t.BusinessDate, t.CategoryName, t.Amount, t.Description, t.CreatedByName, t.Note]; })));
    } }, '⬇ Xuất Excel');
    var body = layout('expenses', 'Báo cáo chi phí', exportBtn);
    call('expenseReport', { period: period, from: q.from, to: q.to, categoryId: q.cat }).then(function (d) {
      if (!d) return;
      data = d;
      clear(body);
      var fromI = h('input', { type: 'date', value: d.range.from }), toI = h('input', { type: 'date', value: d.range.to });
      var catS = UI.select([{ value: '', label: 'Tất cả nhóm' }].concat(d.categories.map(function (c) { return { value: c.CategoryID, label: c.Name }; })), q.cat || '');
      body.appendChild(periodSeg(period, function (p) { App.go('#/admin/expenses?' + qs({ period: p, cat: q.cat })); }));
      body.appendChild(h('div', { class: 'filters' }, UI.field('Từ', fromI), UI.field('Đến', toI), UI.field('Nhóm chi', catS),
        h('button', { class: 'btn', onclick: function () { App.go('#/admin/expenses?' + qs({ period: 'custom', from: fromI.value, to: toI.value, cat: catS.value })); } }, 'Lọc')));
      body.appendChild(h('div', { class: 'grid2 even' },
        h('div', { class: 'card' }, h('h3', null, 'Theo nhóm'), h('div', { class: 'table-wrap' }, h('table', { class: 't' },
          h('thead', null, h('tr', null, h('th', null, 'Nhóm'), h('th', { class: 'num' }, 'Số tiền'), h('th', { class: 'num' }, 'Tỷ trọng'), h('th', { class: 'num' }, 'Kỳ trước'))),
          h('tbody', null, d.mix.map(function (m) { return h('tr', null, h('td', null, m.Name), h('td', { class: 'num' }, money(m.amount)), h('td', { class: 'num' }, m.share + '%'), h('td', { class: 'num' }, money(m.previous))); })),
          h('tfoot', null, h('tr', null, h('td', null, 'Cộng'), h('td', { class: 'num' }, money(d.total)), h('td', { class: 'num' }, '100%'), h('td', { class: 'num' }, money(d.previousTotal))))))),
        h('div', { class: 'card' }, h('h3', null, 'Tỷ trọng'), donut(d.mix))));
      body.appendChild(h('div', { class: 'card' }, h('h3', null, 'Giao dịch (' + d.rows.length + ')'),
        d.rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 't' },
          h('thead', null, h('tr', null, h('th', null, 'Ngày'), h('th', null, 'Nội dung'), h('th', null, 'Nhóm'), h('th', null, 'Người chi'), h('th', { class: 'num' }, 'Số tiền'), h('th', null, ''))),
          h('tbody', null, d.rows.map(function (t) {
            return h('tr', null, h('td', null, fmtDateVN(t.BusinessDate)), h('td', null, t.Description, t.Note ? h('div', { class: 'small muted' }, t.Note) : null, t.ReceiptImage ? UI.imgLink(t.ReceiptImage, 'Ảnh') : null),
              h('td', null, t.CategoryName), h('td', null, t.CreatedByName), h('td', { class: 'num' }, money(t.Amount)),
              h('td', null, h('button', { class: 'btn small', onclick: function () { adjustTxnModal(t); } }, 'Đổi nhóm / sửa')));
          })))) : UI.empty('Không có khoản chi.')));
    });
  }

  /* ---- W04 Tổng hợp chấm công ---- */
  function viewAttendance(q) {
    var month = q.month || fmtTs(Date.now()).slice(0, 7);
    var data = null;
    var mInput = h('input', { type: 'month', value: month, onchange: function () { App.go('#/admin/attendance?month=' + mInput.value); } });
    var exportBtn = h('button', { class: 'btn small', onclick: function () {
      if (!data) return;
      UI.downloadCsv('cham-cong-' + month + '.csv', [['Mã NV', 'Tên', 'Họ tên'].concat(data.shiftTypes.map(function (t) { return 'Ca ' + t.Name; }), ['Tổng ca', 'Công quy đổi', 'Giờ làm', 'Lần muộn', 'Lượt chờ xử lý', 'Ứng lương'])]
        .concat(data.rows.map(function (r) { return [r.EmployeeID, r.Name, r.FullName].concat(data.shiftTypes.map(function (t) { return r.counts[t.ShiftTypeID] || 0; }), [r.totalShifts, r.workUnits, r.hours, r.lateCount, r.pendingCount, r.advance]); })));
    } }, '⬇ Xuất Excel tính lương');
    var body = layout('attendance', 'Tổng hợp chấm công', exportBtn);
    call('attendanceMonth', { month: month }).then(function (d) {
      if (!d) return;
      data = d;
      clear(body);
      body.appendChild(h('div', { class: 'filters' }, UI.field('Tháng', mInput),
        d.locked ? h('span', { class: 'badge green' }, 'Đã chốt công ' + d.locked.LockedTime.slice(0, 10)) :
          h('button', { class: 'btn', onclick: function () {
            UI.confirmBox('Chốt công tháng ' + month + '?', ['Sau khi chốt, không sửa được chấm công trong tháng.'], 'Chốt công').then(function (ok) {
              if (ok) call('lockPayroll', { month: month }).then(function (x) { if (x) { UI.toast('Đã chốt công'); App.refresh(); } });
            });
          } }, 'Chốt công tháng')));
      body.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 't' },
        h('thead', null, h('tr', null, h('th', null, 'Nhân viên'), d.shiftTypes.map(function (t) { return h('th', { class: 'num' }, t.Name); }),
          h('th', { class: 'num' }, 'Tổng ca'), h('th', { class: 'num' }, 'Công quy đổi'), h('th', { class: 'num' }, 'Giờ'), h('th', { class: 'num' }, 'Muộn'), h('th', { class: 'num' }, 'Chờ xử lý'), h('th', { class: 'num' }, 'Ứng lương'))),
        h('tbody', null, d.rows.map(function (r) {
          return h('tr', { class: 'click' + (r.pendingCount ? ' bad' : ''), onclick: function () { detail(r); } }, h('td', null, r.Name, h('div', { class: 'small muted' }, r.EmployeeID)),
            d.shiftTypes.map(function (t) { return h('td', { class: 'num' }, r.counts[t.ShiftTypeID] || 0); }),
            h('td', { class: 'num' }, h('strong', null, r.totalShifts)), h('td', { class: 'num' }, r.workUnits), h('td', { class: 'num' }, r.hours), h('td', { class: 'num' }, r.lateCount),
            h('td', { class: 'num' }, r.pendingCount ? UI.badge('pending', r.pendingCount) : 0), h('td', { class: 'num' }, money(r.advance)));
        })))));
      body.appendChild(h('p', { class: 'small muted' }, 'Chỉ tính lượt Hoàn thành (F-13); mỗi lượt Vào–Ra = 1 ca đúng loại đã chọn. Dòng tô đỏ còn lượt chờ duyệt ở màn Duyệt → Chấm công.'));
      function detail(r) {
        call('attendanceDetail', { employeeId: r.EmployeeID, month: month }).then(function (list) {
          if (!list) return;
          UI.modal(r.Name + ' – tháng ' + month, list.length ? h('ul', { class: 'list' }, list.map(function (a) {
            return h('li', null, h('div', { class: 'row between' }, h('span', null, fmtDateVN(a.BusinessDate) + ' · ' + a.ShiftName), UI.badge(a.Status, a.StatusName)),
              h('div', { class: 'small muted' }, (a.CheckInTime ? String(a.CheckInTime).slice(11, 16) : '—') + ' – ' + (a.CheckOutTime ? String(a.CheckOutTime).slice(11, 16) : '—') + (a.WorkHours ? ' · ' + a.WorkHours + 'h' : '') + (a.Note ? ' · ' + a.Note : '')));
          })) : UI.empty('Không có.'));
        });
      }
    });
  }

  /* ---- W05 Nhân viên ---- */
  function viewEmployees() {
    var body = layout('employees', 'Nhân viên', h('button', { class: 'btn primary small', onclick: function () { empModal({}); } }, '+ Thêm nhân viên'));
    empCache = null;
    getEmps().then(function (list) {
      if (!list) return;
      clear(body);
      body.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 't' },
        h('thead', null, h('tr', null, h('th', null, 'Mã'), h('th', null, 'Tên gọi'), h('th', null, 'Họ tên'), h('th', null, 'SĐT'), h('th', null, 'Vai trò'), h('th', null, 'Thu ngân'), h('th', null, 'Trạng thái'), h('th', null, ''))),
        h('tbody', null, list.map(function (e) {
          return h('tr', null, h('td', null, e.EmployeeID), h('td', null, h('strong', null, e.DisplayName), e.Working ? h('div', null, UI.badge('open', 'Đang trong ca')) : null),
            h('td', null, e.FullName || h('span', { class: 'muted' }, 'chưa có')), h('td', null, e.Phone || h('span', { class: 'muted' }, 'chưa có')), h('td', null, e.RoleName),
            h('td', null, e.IsCashier ? 'Có' : '—'), h('td', null, e.Status === 'active' ? (e.HasAccount ? UI.badge('done', 'Hoạt động') : UI.badge('pending', 'Chưa có tài khoản')) : UI.badge('rejected', 'Đã khóa')),
            h('td', null, h('div', { class: 'row' },
              h('button', { class: 'btn small', onclick: function () { empModal(e); } }, 'Sửa'),
              e.Phone ? h('button', { class: 'btn small', onclick: function () {
                UI.confirmBox('Đặt lại mã PIN', 'Cấp mã PIN tạm mới cho ' + e.DisplayName + '?', 'Đặt lại').then(function (ok) { if (ok) call('resetPin', { employeeId: e.EmployeeID }).then(function (x) { if (x) showPin(e.DisplayName, x.tempPin); }); });
              } }, 'Đặt lại PIN') : null,
              e.EmployeeID !== 'ADMIN' ? h('button', { class: 'btn small', onclick: function () {
                call('setEmployeeActive', { employeeId: e.EmployeeID, active: e.Status !== 'active' }).then(function (x) { if (x) { UI.toast('Đã cập nhật'); App.refresh(); } });
              } }, e.Status === 'active' ? 'Khóa' : 'Mở khóa') : null)));
        })))));
      body.appendChild(h('p', { class: 'small muted' }, 'Nhân viên đăng nhập bằng SĐT + mã PIN. Có SĐT thì hệ thống tự cấp PIN tạm; nhân viên phải đổi PIN ở lần đăng nhập đầu.'));
    });
  }
  function showPin(name, pin) {
    UI.modal('Mã PIN tạm của ' + name, h('div', null, h('div', { class: 'pin-temp' }, pin), h('p', { class: 'small muted' }, 'Mã chỉ hiển thị 1 lần. Đưa cho nhân viên; họ sẽ phải đổi mã ở lần đăng nhập đầu.')));
  }
  function empModal(e) {
    var name = h('input', { type: 'text', value: e.DisplayName || '' }), full = h('input', { type: 'text', value: e.FullName || '' });
    var phone = h('input', { type: 'tel', value: e.Phone || '', inputmode: 'numeric' });
    var role = UI.select(Object.keys(ROLES).map(function (k) { return { value: k, label: ROLES[k] }; }), e.Role || 'staff');
    var cashier = h('input', { type: 'checkbox' }); cashier.checked = !!e.IsCashier;
    var start = h('input', { type: 'date', value: e.StartDate || '' });
    var aliases = h('input', { type: 'text', value: e.Aliases || '', placeholder: 'Tên khác từng dùng, cách nhau dấu phẩy' });
    var err = h('div', { class: 'field-err' });
    UI.modal(e.EmployeeID ? 'Sửa ' + e.EmployeeID : 'Thêm nhân viên', h('div', null, UI.field('Tên gọi (hiện trong app)', name), UI.field('Họ và tên', full), UI.field('Số điện thoại (đăng nhập)', phone),
      UI.field('Vai trò', role), h('label', { class: 'row' }, cashier, 'Được lập báo cáo ca (thu ngân)'), UI.field('Ngày vào làm', start), UI.field('Tên khác', aliases), err),
      [{ label: 'Hủy', value: null }, { label: 'Lưu', primary: true, value: true, validate: function () { if (!name.value.trim()) { err.textContent = 'Nhập tên gọi'; return false; } return true; } }])
      .then(function (ok) {
        if (!ok) return;
        call('saveEmployee', { employee: { EmployeeID: e.EmployeeID, DisplayName: name.value, FullName: full.value, Phone: phone.value, Role: role.value, IsCashier: cashier.checked, StartDate: start.value, Aliases: aliases.value } })
          .then(function (x) {
            if (!x) return;
            (x.warnings || []).forEach(function (w) { UI.toast(w, 'warn'); });
            if (x.tempPin) showPin(x.employee.DisplayName, x.tempPin); else UI.toast('Đã lưu');
            App.refresh();
          });
      });
  }

  /* ---- W06 Cấu hình ---- */
  function viewConfig() {
    var body = layout('config', 'Cấu hình');
    cfgCache = null;
    getCfg().then(function (cfg) {
      if (!cfg) return;
      clear(body);
      var inputs = {};
      var form = h('div', { class: 'card' }, h('h3', null, 'Tham số & ngưỡng cảnh báo'), cfg.settings.map(function (s) {
        var inp = s.Key === 'gpsMode' ? UI.select([{ value: 'off', label: 'Tắt' }, { value: 'warn', label: 'Chỉ cảnh báo' }, { value: 'block', label: 'Chặn chấm công ngoài quán' }], s.Value) : h('input', { type: 'text', value: s.Value });
        inputs[s.Key] = inp;
        if (s.Key === 'storeLng') return h('div', null, UI.field(s.Label, inp), h('button', { type: 'button', class: 'btn small', onclick: function () {
          if (!navigator.geolocation) { UI.toast('Thiết bị không hỗ trợ định vị', 'err'); return; }
          navigator.geolocation.getCurrentPosition(function (pos) {
            inputs.storeLat.value = pos.coords.latitude.toFixed(6); inputs.storeLng.value = pos.coords.longitude.toFixed(6);
            UI.toast('Đã lấy vị trí (±' + Math.round(pos.coords.accuracy) + ' m). Bấm Lưu tham số.');
          }, function () { UI.toast('Không lấy được vị trí. Hãy cho phép trình duyệt dùng vị trí.', 'err'); }, { enableHighAccuracy: true, timeout: 10000 });
        } }, '📍 Lấy vị trí hiện tại làm vị trí quán (đứng tại quán khi bấm)'));
        return UI.field(s.Label, inp);
      }), h('button', { class: 'btn primary', onclick: function () {
        var v = {}; Object.keys(inputs).forEach(function (k) { v[k] = inputs[k].value; });
        call('saveSettings', { values: v }).then(function (x) { if (x) { cfgCache = x; UI.toast('Đã lưu cấu hình'); } });
      } }, 'Lưu tham số'));
      var shiftCard = h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h3', null, 'Loại ca'), h('button', { class: 'btn small', onclick: function () { shiftModal({ IsActive: true, WorkUnits: 1, SortOrder: cfg.shiftTypes.length + 1 }); } }, '+ Thêm ca')),
        h('div', { class: 'table-wrap' }, h('table', { class: 't' }, h('thead', null, h('tr', null, h('th', null, 'Tên'), h('th', null, 'Giờ'), h('th', { class: 'num' }, 'Công quy đổi'), h('th', null, 'Dùng'), h('th', null, ''))),
          h('tbody', null, cfg.shiftTypes.map(function (s) { return h('tr', null, h('td', null, s.Name), h('td', null, s.StartTime + '–' + s.EndTime), h('td', { class: 'num' }, s.WorkUnits), h('td', null, toBool(s.IsActive) ? 'Có' : 'Tắt'), h('td', null, h('button', { class: 'btn small', onclick: function () { shiftModal(s); } }, 'Sửa'))); })))));
      var cpCard = h('div', { class: 'card' }, h('h3', null, 'Mốc kiểm két'),
        h('div', { class: 'table-wrap' }, h('table', { class: 't' }, h('thead', null, h('tr', null, h('th', null, 'Mốc'), h('th', null, 'Giờ hạn'), h('th', null, 'Bắt buộc'), h('th', null, ''))),
          h('tbody', null, cfg.checkpoints.map(function (c) { return h('tr', null, h('td', null, c.Name), h('td', null, c.Deadline), h('td', null, toBool(c.IsRequired) ? 'Có' : '—'), h('td', null, h('button', { class: 'btn small', onclick: function () { cpModal(c); } }, 'Sửa'))); })))));
      var catCard = h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h3', null, 'Nhóm chi phí'), h('button', { class: 'btn small', onclick: function () { catModal({ IsActive: true }); } }, '+ Thêm nhóm')),
        h('ul', { class: 'list' }, cfg.categories.map(function (c) { return h('li', { class: 'row between' }, h('span', null, c.Name, toBool(c.IsActive) ? '' : ' (tắt)'), h('button', { class: 'btn small', onclick: function () { catModal(c); } }, 'Sửa')); })));
      body.appendChild(h('div', { class: 'grid2 even' }, form, h('div', { class: 'stack' }, shiftCard, cpCard, catCard)));
    });
    function save(table, row) { call('saveCatalog', { table: table, row: row }).then(function (x) { if (x) { cfgCache = x; UI.toast('Đã lưu'); App.refresh(); } }); }
    function shiftModal(s) {
      var n = h('input', { type: 'text', value: s.Name || '' }), a = h('input', { type: 'time', value: s.StartTime || '' }), b = h('input', { type: 'time', value: s.EndTime || '' });
      var u = h('input', { type: 'number', step: '0.5', min: '0.5', value: s.WorkUnits || 1 }), act = h('input', { type: 'checkbox' }); act.checked = toBool(s.IsActive);
      UI.modal(s.ShiftTypeID ? 'Sửa ca' : 'Thêm ca', h('div', null, UI.field('Tên ca', n), h('div', { class: 'row' }, h('div', { class: 'grow' }, UI.field('Bắt đầu', a)), h('div', { class: 'grow' }, UI.field('Kết thúc', b))),
        UI.field('Công quy đổi (D4)', u, 'Vd ca Trưa – tối tính 1 hay 2 công'), h('label', { class: 'row' }, act, 'Đang dùng')), [{ label: 'Hủy', value: null }, { label: 'Lưu', primary: true, value: true }])
        .then(function (ok) { if (ok) save('ShiftTypes', { ShiftTypeID: s.ShiftTypeID, Name: n.value, StartTime: a.value, EndTime: b.value, WorkUnits: u.value, IsActive: act.checked, SortOrder: s.SortOrder }); });
    }
    function cpModal(c) {
      var n = h('input', { type: 'text', value: c.Name }), d = h('input', { type: 'time', value: c.Deadline }), r = h('input', { type: 'checkbox' }); r.checked = toBool(c.IsRequired);
      UI.modal('Sửa mốc kiểm', h('div', null, UI.field('Tên', n), UI.field('Giờ hạn nộp', d), h('label', { class: 'row' }, r, 'Bắt buộc (D3)')), [{ label: 'Hủy', value: null }, { label: 'Lưu', primary: true, value: true }])
        .then(function (ok) { if (ok) save('Checkpoints', { CheckpointID: c.CheckpointID, Name: n.value, Deadline: d.value, IsRequired: r.checked }); });
    }
    function catModal(c) {
      var n = h('input', { type: 'text', value: c.Name || '' }), act = h('input', { type: 'checkbox' }); act.checked = toBool(c.IsActive);
      UI.modal(c.CategoryID ? 'Sửa nhóm chi' : 'Thêm nhóm chi', h('div', null, UI.field('Tên nhóm', n), c.CategoryID ? h('label', { class: 'row' }, act, 'Đang dùng') : null), [{ label: 'Hủy', value: null }, { label: 'Lưu', primary: true, value: true }])
        .then(function (ok) { if (ok) save('ExpenseCategories', { CategoryID: c.CategoryID, Name: n.value, IsActive: c.CategoryID ? act.checked : true }); });
    }
  }

  /* ---- W07 Quỹ & ứng lương ---- */
  function viewFunds(q) {
    var body = layout('funds', 'Quỹ & ứng lương', h('button', { class: 'btn primary small', onclick: fundModal }, '+ Ghi rút/nộp quỹ ngoài ca'));
    call('funds', { period: q.period || 'month' }).then(function (d) {
      if (!d) return;
      clear(body);
      body.appendChild(periodSeg(q.period || 'month', function (p) { App.go('#/admin/funds?period=' + p); }));
      body.appendChild(h('div', { class: 'kpis' }, tile('Tổng rút quỹ', d.totalWithdraw), tile('Tổng nộp quỹ', d.totalDeposit),
        tile('Ứng lương tháng ' + d.month, d.advances.reduce(function (a, x) { return a + x.total; }, 0)), h('div', { class: 'kpi' }, h('div', { class: 'l' }, 'Hạn mức ứng/người'), h('div', { class: 'v' }, money(d.limit) + ' đ'))));
      body.appendChild(h('div', { class: 'grid2 even' },
        h('div', { class: 'card' }, h('h3', null, 'Rút / nộp quỹ'), d.funds.length ? h('ul', { class: 'list' }, d.funds.map(function (t) {
          return h('li', { class: 'txn' }, h('div', { class: 'd' }, h('div', null, t.Description), h('div', { class: 'm' }, fmtDateVN(t.BusinessDate) + ' · ' + t.TxnTypeName + ' · ' + t.CreatedByName + (t.AfterClose ? ' · sau đóng cửa' : ''))),
            h('div', { class: 'a' }, (t.TxnType === 'withdraw' ? '−' : '+') + money(t.Amount)));
        })) : UI.empty('Không có.')),
        h('div', { class: 'card' }, h('h3', null, 'Ứng lương theo nhân viên – tháng ' + d.month), d.advances.length ? h('ul', { class: 'list' }, d.advances.map(function (a) {
          return h('li', null, h('div', { class: 'row between' }, h('strong', null, a.Name || '(chưa rõ người ứng)'), h('span', { class: 'num' }, money(a.total) + ' đ ', a.over ? UI.badge('rejected', 'Vượt hạn mức') : null)),
            h('div', { class: 'small muted' }, a.items.map(function (t) { return fmtDateVN(t.BusinessDate).slice(0, 5) + ': ' + money(t.Amount); }).join(' · ')));
        })) : UI.empty('Không có.'))));
    });
    function fundModal() {
      var type = UI.select([{ value: 'withdraw', label: 'Rút quỹ (chủ quán lấy)' }, { value: 'deposit', label: 'Nộp quỹ (bỏ thêm vào két)' }], 'withdraw');
      var date = h('input', { type: 'date', value: addDays(fmtTs(Date.now() - 4 * 3600000).slice(0, 10), 0) });
      var amt = UI.moneyInput(), desc = h('input', { type: 'text', placeholder: 'Vd: Chủ quán lấy về' });
      var err = h('div', { class: 'field-err' });
      UI.modal('Ghi rút/nộp quỹ sau khi đóng cửa', h('div', null, h('div', { class: 'alert info' }, 'Dùng cho tiền lấy/bỏ vào két SAU báo cáo Cuối ngày. Két chuyển sang sáng hôm sau sẽ trừ/cộng khoản này (F-01). Rút quỹ trong ca thì ghi trong báo cáo ca.'),
        UI.field('Loại', type), UI.field('Thuộc ngày kinh doanh', date), UI.field('Số tiền', amt.el), UI.field('Người rút/nộp, ghi chú', desc), err),
        [{ label: 'Hủy', value: null }, { label: 'Lưu', primary: true, value: true, validate: function () { if (!(amt.get() > 0) || !desc.value.trim()) { err.textContent = 'Nhập số tiền và ghi chú'; return false; } return true; } }])
        .then(function (ok) { if (ok) call('recordFund', { txnType: type.value, businessDate: date.value, amount: amt.get(), description: desc.value }).then(function (x) { if (x) { UI.toast('Đã ghi'); App.refresh(); } }); });
    }
  }

  /* ---- W08 Cảnh báo ---- */
  function viewAlerts(q) {
    var status = q.status === undefined ? 'open' : q.status;
    var body = layout('alerts', 'Trung tâm cảnh báo');
    call('alerts', { status: status, level: q.level, code: q.code }).then(function (list) {
      if (!list) return;
      clear(body);
      var st = UI.select([{ value: 'open', label: 'Chưa xử lý' }, { value: 'done', label: 'Đã xử lý' }, { value: '', label: 'Tất cả' }], status);
      var lv = UI.select([{ value: '', label: 'Mọi mức' }, { value: 'block', label: 'Chặn' }, { value: 'warn', label: 'Cảnh báo' }, { value: 'remind', label: 'Nhắc' }], q.level || '');
      var code = h('input', { type: 'text', value: q.code || '', placeholder: 'Vd CB-08' });
      body.appendChild(h('div', { class: 'filters' }, UI.field('Trạng thái', st), UI.field('Mức', lv), UI.field('Mã', code),
        h('button', { class: 'btn', onclick: function () { App.go('#/admin/alerts?' + qs({ status: st.value, level: lv.value, code: code.value.trim().toUpperCase() }) + (st.value === '' ? '&status=' : '')); } }, 'Lọc')));
      if (!list.length) { body.appendChild(UI.empty('Không có cảnh báo.')); return; }
      body.appendChild(h('div', { class: 'card' }, h('ul', { class: 'list' }, list.map(function (n) {
        return h('li', null, h('div', { class: 'row between' }, h('span', null, h('span', { class: 'badge ' + App.levelClass(n.Level) }, n.Code), ' ', h('span', { class: 'small muted' }, n.CreatedTime)),
          n.Status === 'open' ? h('div', { class: 'row' },
            h('button', { class: 'btn small', onclick: function () { App.openRecord(n.RecordRef); } }, 'Mở'),
            h('button', { class: 'btn small primary', onclick: function () {
              UI.promptBox('Đánh dấu đã xử lý', 'Ghi chú cách xử lý', { required: false, okLabel: 'Đã xử lý' }).then(function (v) { if (v !== null) call('resolveAlert', { notificationId: n.NotificationID, note: v }).then(function (x) { if (x) { UI.toast('Đã đóng cảnh báo'); App.refresh(); } }); });
            } }, 'Đã xử lý')) : h('span', { class: 'small muted' }, 'Xử lý bởi ' + n.ResolvedBy)),
          h('div', { style: { marginTop: '6px' } }, n.Message), n.ResolvedNote ? h('div', { class: 'small muted' }, 'Ghi chú: ' + n.ResolvedNote) : null);
      }))));
    });
  }

  /* ---- W09 Nhật ký ---- */
  function viewAudit(q) {
    var body = layout('audit', 'Nhật ký thao tác');
    Promise.all([getEmps(), call('auditLog', { userId: q.user, table: q.table, from: q.from, to: q.to, q: q.q, limit: 300 })]).then(function (res) {
      var emps = res[0], d = res[1];
      if (!d) return;
      clear(body);
      var us = UI.select([{ value: '', label: 'Mọi người' }, { value: 'SYSTEM', label: 'Hệ thống' }].concat((emps || []).map(function (e) { return { value: e.EmployeeID, label: e.DisplayName }; })), q.user || '');
      var tb = UI.select([{ value: '', label: 'Mọi bảng' }].concat(Object.keys(SCHEMA).filter(function (t) { return t !== 'AuditLog' && t !== 'Sessions'; }).map(function (t) { return { value: t, label: t }; })), q.table || '');
      var fr = h('input', { type: 'date', value: q.from || '' }), to = h('input', { type: 'date', value: q.to || '' }), kw = h('input', { type: 'text', value: q.q || '', placeholder: 'Mã bản ghi, nội dung…' });
      body.appendChild(h('div', { class: 'filters' }, UI.field('Người', us), UI.field('Bảng', tb), UI.field('Từ', fr), UI.field('Đến', to), UI.field('Tìm', kw),
        h('button', { class: 'btn', onclick: function () { App.go('#/admin/audit?' + qs({ user: us.value, table: tb.value, from: fr.value, to: to.value, q: kw.value })); } }, 'Lọc')));
      body.appendChild(h('p', { class: 'small muted' }, 'Hiện ' + d.rows.length + '/' + d.total + ' dòng mới nhất. Nhật ký chỉ xem, không sửa, không xóa được.'));
      body.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 't' },
        h('thead', null, h('tr', null, h('th', null, 'Thời gian'), h('th', null, 'Người'), h('th', null, 'Bảng'), h('th', null, 'Bản ghi'), h('th', null, 'Hành động'), h('th', null, ''))),
        h('tbody', null, d.rows.map(function (l) {
          return h('tr', null, h('td', null, l.Time), h('td', null, l.User), h('td', null, l.TableName), h('td', { class: 'small' }, l.RecordID), h('td', null, l.Action),
            h('td', null, h('button', { class: 'btn small', onclick: function () { showDiff(l); } }, 'Xem')));
        })))));
    });
    function showDiff(l) {
      var fmt = function (s) { try { return JSON.stringify(JSON.parse(s), null, 2); } catch (e) { return s || '—'; } };
      UI.modal(l.Action + ' · ' + l.TableName, h('div', { class: 'grid2 even' },
        h('div', null, h('div', { class: 'section-title' }, 'Giá trị cũ'), h('pre', { class: 'small', style: { whiteSpace: 'pre-wrap', background: '#faf4e6', padding: '8px', borderRadius: '8px' } }, fmt(l.OldValue))),
        h('div', null, h('div', { class: 'section-title' }, 'Giá trị mới'), h('pre', { class: 'small', style: { whiteSpace: 'pre-wrap', background: '#e5f3ea', padding: '8px', borderRadius: '8px' } }, fmt(l.NewValue)))));
    }
  }

  /* ---- Nhập dữ liệu Excel (mục 5.3) ---- */
  function viewImport() {
    var body = layout('import', 'Nhập dữ liệu Excel cũ');
    clear(body);
    var revIn = h('input', { type: 'file', accept: '.xlsx' }), attIn = h('input', { type: 'file', accept: '.xlsx' });
    var out = h('div');
    var btn = h('button', { class: 'btn primary', onclick: function () {
      clear(out);
      if (!revIn.files[0] || !attIn.files[0]) { UI.toast('Chọn đủ 2 file Excel', 'err'); return; }
      btn.disabled = true; out.appendChild(UI.spinner());
      Promise.all([XlsxLite.readFirstSheet(revIn.files[0]), XlsxLite.readFirstSheet(attIn.files[0])]).then(function (sheets) {
        var data = XlsxLite.toHistory(sheets[0], sheets[1]);
        clear(out);
        out.appendChild(h('div', { class: 'alert info' }, 'Đọc được ' + data.revenue.length + ' báo cáo ca và ' + data.attendance.length + ' lượt chấm công. Đang nhập…'));
        return call('importHistory', { data: data }).then(function (r) {
          btn.disabled = false;
          if (!r) return;
          clear(out);
          out.appendChild(importResult(r));
        });
      }).catch(function (e) { btn.disabled = false; clear(out); out.appendChild(h('div', { class: 'alert err' }, 'Không đọc được file: ' + e.message)); });
    } }, 'Nhập dữ liệu');
    body.appendChild(h('div', { class: 'card' },
      h('p', null, 'Nhập 1 lần dữ liệu từ 2 file Google Form cũ. Hệ thống ghép lượt Vào–Ra, giữ bản nộp sau cùng khi trùng mốc, sửa ngày ghi sai năm, đánh dấu số tiền nghi thiếu số 0 và khoản chi gộp nhiều loại để chủ quán xem lại.'),
      UI.field('File "Bảng báo cáo doanh thu.xlsx"', revIn), UI.field('File "Bảng Tổng Hợp Chấm Công - Nhà Hàng.xlsx"', attIn), btn, out));
  }

  function importResult(r) {
    return h('div', { class: 'stack' }, h('div', { class: 'alert ok' }, 'Đã nhập ' + r.attendance + ' lượt chấm công, ' + r.reports + ' báo cáo ca, ' + r.transactions + ' giao dịch, ' + r.days + ' ngày kinh doanh.'),
      h('h3', null, 'Điểm cần xem lại (' + r.issues.length + ')'),
      h('div', { class: 'table-wrap' }, h('table', { class: 't' }, h('thead', null, h('tr', null, h('th', null, 'Loại'), h('th', null, 'Ngày'), h('th', null, 'Nội dung'))),
        h('tbody', null, r.issues.map(function (i) { return h('tr', null, h('td', null, i.kind), h('td', null, i.date ? fmtDateVN(i.date) : ''), h('td', null, i.message)); })))));
  }

  window.Admin = {
    render: function (parts, q) {
      switch (parts[0]) {
        case undefined: return viewDashboard(q);
        case 'shifts': return viewShifts(q);
        case 'days': return viewDays(q);
        case 'day': return viewDay(parts[1]);
        case 'expenses': return viewExpenses(q);
        case 'attendance': return viewAttendance(q);
        case 'employees': return viewEmployees();
        case 'config': return viewConfig();
        case 'funds': return viewFunds(q);
        case 'alerts': return viewAlerts(q);
        case 'audit': return viewAudit(q);
        case 'import': return viewImport();
        default: return viewDashboard(q);
      }
    }
  };
})();
