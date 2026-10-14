/* Bộ công cụ giao diện nhỏ, không phụ thuộc thư viện ngoài. */
(function () {
  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'value') el.value = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }

  function money(n) { return fmtMoney(n); }

  function toast(msg, kind) {
    var box = document.getElementById('toasts');
    var t = h('div', { class: 'toast ' + (kind || 'ok') }, msg);
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, kind === 'err' ? 6000 : 3000);
  }

  function modal(title, body, actions) {
    return new Promise(function (resolve) {
      var back = h('div', { class: 'modal-back' });
      var close = function (v) { back.remove(); resolve(v); };
      var btns = (actions || [{ label: 'Đóng', value: null }]).map(function (a) {
        return h('button', { class: 'btn ' + (a.primary ? 'primary' : a.danger ? 'danger' : 'ghost'), onclick: function () {
          if (a.validate && !a.validate()) return;
          close(typeof a.value === 'function' ? a.value() : a.value);
        } }, a.label);
      });
      back.appendChild(h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
        h('div', { class: 'modal-head' }, h('h3', null, title), h('button', { class: 'icon-btn', 'aria-label': 'Đóng', onclick: function () { close(null); } }, '×')),
        h('div', { class: 'modal-body' }, body),
        h('div', { class: 'modal-actions' }, btns)));
      back.addEventListener('click', function (e) { if (e.target === back) close(null); });
      document.body.appendChild(back);
      var f = back.querySelector('input,select,textarea'); if (f) setTimeout(function () { f.focus(); }, 50);
    });
  }

  function confirmBox(title, lines, okLabel, danger) {
    var body = h('div', null, (Array.isArray(lines) ? lines : [lines]).map(function (l) { return h('p', null, l); }));
    return modal(title, body, [{ label: 'Hủy', value: false }, { label: okLabel || 'Đồng ý', value: true, primary: !danger, danger: danger }]);
  }

  function promptBox(title, label, opts) {
    opts = opts || {};
    var input = opts.multiline ? h('textarea', { rows: 3, placeholder: opts.placeholder || '' }) : h('input', { type: 'text', placeholder: opts.placeholder || '' });
    var err = h('div', { class: 'field-err' });
    return modal(title, h('div', null, opts.note ? h('p', { class: 'muted' }, opts.note) : null, h('label', { class: 'field' }, h('span', null, label), input), err), [
      { label: 'Hủy', value: null },
      { label: opts.okLabel || 'Xác nhận', primary: true, value: function () { return input.value.trim(); },
        validate: function () { if (opts.required !== false && !input.value.trim()) { err.textContent = 'Không được để trống'; return false; } return true; } }
    ]);
  }

  /* Ô nhập tiền: dấu chấm nghìn khi gõ, nút 000, số bằng chữ bên dưới (mục 2 Quy ước). */
  function moneyInput(opts) {
    opts = opts || {};
    var input = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', class: 'money', placeholder: opts.placeholder || '0' });
    var words = h('div', { class: 'money-words' });
    var state = { value: opts.value === undefined || opts.value === null || opts.value === '' ? '' : Math.round(Number(opts.value)) };
    function render(silent) {
      input.value = state.value === '' ? '' : fmtMoney(state.value);
      words.textContent = state.value === '' ? '' : moneyToWords(state.value);
      if (opts.onchange && !silent) opts.onchange(state.value);
    }
    input.addEventListener('input', function () {
      var digits = input.value.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
      state.value = digits === '' ? '' : Number(digits.slice(0, 12));
      render();
    });
    var k000 = h('button', { type: 'button', class: 'k000', tabindex: '-1', onclick: function () { state.value = state.value === '' ? 0 : state.value * 1000; render(); input.focus(); } }, '000');
    var wrap = h('div', { class: 'money-field' }, h('div', { class: 'money-row' }, input, h('span', { class: 'cur' }, 'đ'), k000), words);
    render(true);
    return { el: wrap, get: function () { return state.value; }, set: function (v) { state.value = v === '' || v === null || v === undefined ? '' : Math.round(Number(v)); render(); }, input: input };
  }

  function field(label, control, hint) {
    return h('label', { class: 'field' }, h('span', null, label), control, hint ? h('small', { class: 'muted' }, hint) : null);
  }

  function select(options, value, attrs) {
    var s = h('select', attrs || {});
    options.forEach(function (o) {
      var opt = h('option', { value: o.value }, o.label);
      if (String(o.value) === String(value)) opt.selected = true;
      s.appendChild(opt);
    });
    return s;
  }

  var STATUS_CLASS = { draft: 'gray', submitted: 'blue', returned: 'orange', approved: 'green', adjusted: 'purple', open: 'blue', done: 'green', review: 'orange', pending: 'orange', rejected: 'red', closed: 'green' };
  function badge(status, label) { return h('span', { class: 'badge ' + (STATUS_CLASS[status] || 'gray') }, label || status); }

  function empty(text) { return h('div', { class: 'empty' }, text); }

  function spinner() { return h('div', { class: 'loading' }, h('div', { class: 'spin' }), 'Đang tải…'); }

  /* Nén ảnh ≤ 1280px, JPEG; mục tiêu ≤ 500 KB. */
  function pickImage() {
    return new Promise(function (resolve) {
      var inp = h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' } });
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0];
        if (!f) return resolve(null);
        var img = new Image(), url = URL.createObjectURL(f);
        img.onload = function () {
          var scale = Math.min(1, 1280 / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          var q = 0.75, data = c.toDataURL('image/jpeg', q);
          while (data.length * 0.75 > 500 * 1024 && q > 0.35) { q -= 0.1; data = c.toDataURL('image/jpeg', q); }
          URL.revokeObjectURL(url); inp.remove(); resolve(data);
        };
        img.onerror = function () { inp.remove(); resolve(null); };
        img.src = url;
      });
      document.body.appendChild(inp);
      inp.click();
    });
  }

  /* Chụp ảnh hiện trạng: mở camera, từ chối ảnh cũ hơn maxAgeMinutes, đóng dấu chữ (tên, giờ, vị trí) lên ảnh.
   * Trả về { dataUrl } | { error } | null (người dùng hủy). */
  function takePhoto(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var inp = h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' } });
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0];
        inp.remove();
        if (!f) return resolve(null);
        if (opts.maxAgeMinutes && f.lastModified && Date.now() - f.lastModified > opts.maxAgeMinutes * 60000) {
          return resolve({ error: 'Ảnh này chụp từ ' + Math.round((Date.now() - f.lastModified) / 60000) + ' phút trước. Hãy chụp ảnh mới bằng camera.' });
        }
        var img = new Image(), url = URL.createObjectURL(f);
        img.onload = function () {
          var scale = Math.min(1, 1280 / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          var g = c.getContext('2d');
          g.drawImage(img, 0, 0, c.width, c.height);
          var lines = opts.stamp || [];
          if (lines.length) {
            var fs = Math.max(16, Math.round(c.width / 38)), pad = Math.round(fs * 0.6), lh = Math.round(fs * 1.35);
            var bandH = pad * 2 + lh * lines.length;
            g.fillStyle = 'rgba(30,12,6,0.62)';
            g.fillRect(0, c.height - bandH, c.width, bandH);
            g.fillStyle = '#fff';
            g.font = '600 ' + fs + 'px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
            g.textBaseline = 'top';
            lines.forEach(function (l, i) { g.fillText(l, pad, c.height - bandH + pad + i * lh, c.width - pad * 2); });
          }
          var q = 0.75, data = c.toDataURL('image/jpeg', q);
          while (data.length * 0.75 > 500 * 1024 && q > 0.35) { q -= 0.1; data = c.toDataURL('image/jpeg', q); }
          URL.revokeObjectURL(url);
          resolve({ dataUrl: data });
        };
        img.onerror = function () { resolve({ error: 'Không đọc được ảnh' }); };
        img.src = url;
      });
      document.body.appendChild(inp);
      inp.click();
    });
  }

  /* Ảnh thông tin ra ca: Zalo bỏ phần chữ khi chia sẻ kèm ảnh, nên thông tin được vẽ thành 1 ảnh gửi cùng bộ ảnh. */
  function infoCard(title, lines, footer) {
    var W = 1080, pad = 64, fs = 44, lh = 62;
    var c = document.createElement('canvas'), g = c.getContext('2d');
    var font = function (w, s) { return w + ' ' + s + 'px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'; };
    // Ngắt dòng theo bề rộng ảnh.
    g.font = font(500, fs);
    var wrapped = [];
    lines.forEach(function (l) {
      var words = String(l).split(' '), cur = '';
      words.forEach(function (w) {
        var t = cur ? cur + ' ' + w : w;
        if (g.measureText(t).width > W - pad * 2 && cur) { wrapped.push(cur); cur = w; } else cur = t;
      });
      wrapped.push(cur);
    });
    var headH = 190, H = headH + pad + wrapped.length * lh + pad + 70;
    c.width = W; c.height = H;
    g.fillStyle = '#faf4e6'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#4a1d12'; g.fillRect(0, 0, W, headH);
    g.fillStyle = '#f3e3b5'; g.font = font(600, 36); g.textBaseline = 'top';
    g.fillText(footer || '', pad, 40);
    g.fillStyle = '#ffffff'; g.font = font(800, 64);
    g.fillText(title, pad, 92, W - pad * 2);
    g.fillStyle = '#2a1a14'; g.font = font(500, fs);
    wrapped.forEach(function (l, i) { g.fillText(l, pad, headH + pad + i * lh, W - pad * 2); });
    g.fillStyle = '#7a6a60'; g.font = font(400, 30);
    g.fillText('Ảnh do ứng dụng tạo lúc ' + fmtTs(Date.now()).slice(11, 16) + ' ' + fmtDateVN(fmtTs(Date.now()).slice(0, 10)), pad, H - 70);
    return c.toDataURL('image/jpeg', 0.9);
  }

  function dataUrlToFile(dataUrl, name) {
    var parts = String(dataUrl).split(','), bin = atob(parts[1]), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name, { type: (parts[0].match(/data:([^;]+)/) || [])[1] || 'image/jpeg' });
  }

  /* Chia sẻ qua bảng chia sẻ của điện thoại (người dùng chọn Zalo → nhóm quán → Gửi).
   * Trả về 'shared' | 'cancel' | 'copied' | 'failed'. */
  function shareToZalo(text, photos) {
    var files = (photos || []).map(function (d, i) { return dataUrlToFile(d, (i === 0 && photos.infoFirst ? 'thong-tin-ra-ca' : 'hien-trang-' + (photos.infoFirst ? i : i + 1)) + '.jpg'); });
    var data = { text: text };
    if (files.length && navigator.canShare && navigator.canShare({ files: files })) data.files = files;
    if (navigator.share) {
      return navigator.share(data).then(function () { return 'shared'; }, function (e) {
        return e && e.name === 'AbortError' ? 'cancel' : copyText(text).then(function (ok) { return ok ? 'copied' : 'failed'; });
      });
    }
    return copyText(text).then(function (ok) { return ok ? 'copied' : 'failed'; });
  }

  /* Sao chép đồng bộ (chạy xong ngay trong lần bấm) để không bị mất khi trang chuyển sang Zalo. */
  function copyTextSync(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px';
    document.body.appendChild(ta);
    ta.focus(); ta.select(); ta.setSelectionRange(0, text.length); // iPhone cần chọn bằng setSelectionRange
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    if (!ok && navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).catch(function () {}); ok = true; }
    return ok;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
    return Promise.resolve(false);
  }

  function downloadCsv(filename, rows) {
    var csv = rows.map(function (r) {
      return r.map(function (v) {
        var s = v === null || v === undefined ? '' : String(v);
        return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var a = h('a', { href: URL.createObjectURL(blob), download: filename });
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function imgLink(url, label) {
    if (!url) return null;
    return h('a', { href: url, target: '_blank', rel: 'noopener', class: 'img-link', onclick: function (e) {
      if (String(url).indexOf('data:') === 0 || String(url).indexOf('local:') === 0) {
        e.preventDefault();
        var src = window.resolveImage ? window.resolveImage(url) : url;
        modal(label || 'Ảnh', h('img', { src: src, class: 'preview' }));
      }
    } }, label || 'Xem ảnh');
  }

  window.UI = { h: h, money: money, toast: toast, modal: modal, confirmBox: confirmBox, promptBox: promptBox, moneyInput: moneyInput, field: field, select: select, badge: badge, empty: empty, spinner: spinner, pickImage: pickImage, takePhoto: takePhoto, shareToZalo: shareToZalo, infoCard: infoCard, copyText: copyText, copyTextSync: copyTextSync, downloadCsv: downloadCsv, imgLink: imgLink };
})();
