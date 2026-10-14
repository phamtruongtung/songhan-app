/* Đọc trang tính đầu tiên của file .xlsx ngay trên trình duyệt (không cần thư viện):
 * giải nén ZIP bằng DecompressionStream('deflate-raw') rồi đọc XML. */
(function () {
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

  function unzip(buf) {
    var b = new Uint8Array(buf), eocd = -1;
    for (var i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) { if (u32(b, i) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error('Không phải file .xlsx hợp lệ');
    var n = u16(b, eocd + 10), off = u32(b, eocd + 16), entries = {};
    for (var k = 0; k < n; k++) {
      var method = u16(b, off + 10), csize = u32(b, off + 20), nlen = u16(b, off + 28), elen = u16(b, off + 30), clen = u16(b, off + 32), lho = u32(b, off + 42);
      var name = new TextDecoder().decode(b.subarray(off + 46, off + 46 + nlen));
      entries[name] = { method: method, csize: csize, lho: lho };
      off += 46 + nlen + elen + clen;
    }
    return {
      read: function (name) {
        var e = entries[name];
        if (!e) return Promise.resolve(null);
        var start = e.lho + 30 + u16(b, e.lho + 26) + u16(b, e.lho + 28);
        var data = b.subarray(start, start + e.csize);
        if (e.method === 0) return Promise.resolve(new TextDecoder().decode(data));
        if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('Trình duyệt quá cũ, hãy dùng Chrome bản mới'));
        var stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Response(stream).text();
      }
    };
  }

  function colOf(ref) { return String(ref).replace(/\d+/g, ''); }

  function readFirstSheet(file) {
    return file.arrayBuffer().then(function (buf) {
      var z = unzip(buf);
      return Promise.all([z.read('xl/sharedStrings.xml'), z.read('xl/worksheets/sheet1.xml')]).then(function (xs) {
        var parser = new DOMParser(), ss = [];
        if (xs[0]) {
          var sdoc = parser.parseFromString(xs[0], 'application/xml');
          Array.prototype.forEach.call(sdoc.getElementsByTagName('si'), function (si) { ss.push(si.textContent); });
        }
        var doc = parser.parseFromString(xs[1], 'application/xml'), rows = [];
        Array.prototype.forEach.call(doc.getElementsByTagName('row'), function (r) {
          var o = {};
          Array.prototype.forEach.call(r.getElementsByTagName('c'), function (c) {
            var t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0], val = v ? v.textContent : '';
            if (t === 's') val = ss[+val];
            else if (t === 'inlineStr') val = c.textContent;
            if (val !== '' && val !== undefined) o[colOf(c.getAttribute('r'))] = val;
          });
          rows.push(o);
        });
        return rows;
      });
    });
  }

  /* Số ngày Excel (giờ Việt Nam của Google Form) → 'yyyy-MM-dd HH:mm:ss'. */
  function serialTs(s) {
    if (s === undefined || s === '') return '';
    var d = new Date(Math.round((Number(s) - 25569) * 86400000));
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds());
  }

  /* Nhận diện file theo tiêu đề cột, không phụ thuộc thứ tự chọn file. */
  function toHistory(a, b) {
    var isRev = function (rows) { return rows[0] && /két/i.test(rows[0].D || ''); };
    var rev = isRev(a) ? a : b, att = isRev(a) ? b : a;
    if (!isRev(rev)) throw new Error('Không tìm thấy file báo cáo doanh thu (cột "Tiền mặt trong két")');
    return {
      revenue: rev.slice(1).filter(function (r) { return r.A; }).map(function (r) {
        return { ts: serialTs(r.A), date: serialTs(r.B).slice(0, 10), label: String(r.C || '').trim(), cash: r.D, transfer: r.E, category: String(r.F || '').trim(), reporter: String(r.G || '').trim(), expense: r.H, description: String(r.I || '').trim() };
      }),
      attendance: att.slice(1).filter(function (r) { return r.A; }).map(function (r) {
        return { ts: serialTs(r.A), name: String(r.B || '').trim(), status: String(r.C || '').trim(), shift: String(r.D || '').trim() };
      })
    };
  }

  window.XlsxLite = { readFirstSheet: readFirstSheet, toHistory: toHistory };
})();
