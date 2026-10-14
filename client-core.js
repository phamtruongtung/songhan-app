/* Cấu hình chung, lược đồ bảng (mỗi bảng = 1 trang trong Google Sheet) và dữ liệu khởi tạo.
 * Toàn bộ thư mục core/ dùng biến toàn cục (không import) để chạy được cả trong
 * Google Apps Script lẫn trình duyệt (chế độ demo). */

var APP = {
  name: 'Bê Thui Sông Hàn',
  version: '1.0.0',
  tzOffsetHours: 7, // Việt Nam, không có giờ mùa hè
  sessionDays: 30,
  pinIterations: 300
};

var ROLES = { staff: 'Nhân viên', leader: 'Trưởng ca', admin: 'Chủ quán' };

var TXN_TYPES = {
  expense: 'Chi phí',
  advance: 'Ứng lương',
  withdraw: 'Rút quỹ',
  deposit: 'Nộp quỹ',
  refund: 'Hoàn tiền khách'
};

var REPORT_STATUS = {
  draft: 'Nháp', submitted: 'Đã gửi', returned: 'Bị trả lại', approved: 'Đã duyệt', adjusted: 'Đã điều chỉnh'
};

var ATT_STATUS = {
  open: 'Đang mở', done: 'Hoàn thành', review: 'Cần duyệt', pending: 'Chờ duyệt', rejected: 'Từ chối'
};

/* Lược đồ: id = cột khóa; text = cột luôn lưu dạng chữ (giữ số 0 đầu, không để Sheet tự đổi thành ngày). */
var SCHEMA = {
  Employees: { id: 'EmployeeID', cols: ['EmployeeID', 'FullName', 'DisplayName', 'Phone', 'Role', 'IsCashier', 'Status', 'StartDate', 'Aliases'], text: ['EmployeeID', 'Phone', 'StartDate'] },
  Users: { id: 'UserID', cols: ['UserID', 'Phone', 'PinHash', 'PinSalt', 'FailedCount', 'LockedUntil', 'MustChange', 'IsActive'], text: ['UserID', 'Phone', 'PinHash', 'PinSalt', 'LockedUntil'] },
  Sessions: { id: 'Token', cols: ['Token', 'UserID', 'CreatedAt', 'ExpiresAt'], text: ['Token', 'UserID', 'CreatedAt', 'ExpiresAt'] },
  ShiftTypes: { id: 'ShiftTypeID', cols: ['ShiftTypeID', 'Name', 'StartTime', 'EndTime', 'WorkUnits', 'IsActive', 'SortOrder'], text: ['ShiftTypeID', 'StartTime', 'EndTime'] },
  Checkpoints: { id: 'CheckpointID', cols: ['CheckpointID', 'Name', 'Deadline', 'IsRequired', 'SortOrder', 'IsOpening', 'IsClosing'], text: ['CheckpointID', 'Deadline'] },
  ExpenseCategories: { id: 'CategoryID', cols: ['CategoryID', 'Name', 'IsActive'], text: ['CategoryID'] },
  Settings: { id: 'Key', cols: ['Key', 'Value', 'Label', 'UpdatedBy', 'UpdatedTime'], text: ['Key', 'Value', 'UpdatedTime'] },
  Attendance: { id: 'AttendanceID', cols: ['AttendanceID', 'EmployeeID', 'ShiftTypeID', 'BusinessDate', 'CheckInTime', 'CheckOutTime', 'CheckInLocation', 'CheckOutLocation', 'WorkHours', 'LateMinutes', 'Status', 'Source', 'RequestReason', 'ApprovedBy', 'Note', 'CheckInDistance', 'CheckOutDistance', 'CheckoutPhotos', 'SharedIn', 'SharedOut'], text: ['AttendanceID', 'EmployeeID', 'ShiftTypeID', 'BusinessDate', 'CheckInTime', 'CheckOutTime', 'CheckInLocation', 'CheckOutLocation', 'CheckoutPhotos', 'SharedIn', 'SharedOut'] },
  BusinessDays: { id: 'BusinessDate', cols: ['BusinessDate', 'OpeningCarried', 'OpeningCounted', 'OpeningDifference', 'ClosingCash', 'TotalTransfer', 'TotalExpense', 'TotalAdvance', 'TotalWithdraw', 'TotalDeposit', 'TotalRefund', 'Revenue', 'Profit', 'TotalDifference', 'HasClosing', 'Status', 'UpdatedTime'], text: ['BusinessDate', 'UpdatedTime'] },
  ShiftReports: { id: 'ReportID', cols: ['ReportID', 'BusinessDate', 'CheckpointID', 'CashCarried', 'CashCounted', 'TransferAmount', 'TransferImage', 'Difference', 'DifferenceReason', 'ReporterID', 'CreatedTime', 'SubmittedTime', 'ReceiverID', 'CashHandedOver', 'HandoverDifference', 'HandoverReason', 'ReceivedTime', 'ApproverID', 'ApprovedTime', 'ReturnReason', 'Status', 'Source'], text: ['ReportID', 'BusinessDate', 'CheckpointID', 'ReporterID', 'CreatedTime', 'SubmittedTime', 'ReceiverID', 'ReceivedTime', 'ApproverID', 'ApprovedTime'] },
  CashTransactions: { id: 'TxnID', cols: ['TxnID', 'ReportID', 'BusinessDate', 'TxnType', 'CategoryID', 'Amount', 'Description', 'EmployeeID', 'CreatedBy', 'CreatedTime', 'ReceiptImage', 'ApprovalStatus', 'ApprovedBy', 'AfterClose', 'Deleted', 'Note'], text: ['TxnID', 'ReportID', 'BusinessDate', 'CategoryID', 'EmployeeID', 'CreatedBy', 'CreatedTime', 'ApprovedBy'] },
  Notifications: { id: 'NotificationID', cols: ['NotificationID', 'Code', 'Level', 'Message', 'RecordRef', 'Recipients', 'Status', 'CreatedTime', 'ResolvedBy', 'ResolvedNote', 'ReadBy', 'DedupeKey'], text: ['NotificationID', 'RecordRef', 'CreatedTime', 'ResolvedBy', 'ReadBy', 'DedupeKey'] },
  AuditLog: { id: 'LogID', cols: ['LogID', 'Time', 'UserID', 'TableName', 'RecordID', 'Action', 'OldValue', 'NewValue'], text: ['LogID', 'Time', 'UserID', 'RecordID'] },
  PayrollPeriods: { id: 'Month', cols: ['Month', 'LockedBy', 'LockedTime'], text: ['Month', 'LockedBy', 'LockedTime'] }
};

/* Bảng không ghi nhật ký (tránh nhật ký tự phình): phiên đăng nhập, nhật ký, đánh dấu đã đọc. */
var NO_AUDIT = { Sessions: true, AuditLog: true, Notifications: true, BusinessDays: true };

/* Tham số cấu hình mặc định — mục 8 tab Đặc tả màn hình. */
var DEFAULT_SETTINGS = [
  ['storeName', 'Bê Thui Sông Hàn', 'Tên quán'],
  ['storeAddress', '741 Ngô Quyền, TP Đà Nẵng', 'Địa chỉ'],
  ['storePhone', '0988 787 848', 'Điện thoại'],
  ['lateMinutes', '15', 'Ngưỡng đi muộn (phút)'],
  ['checkoutWaitHours', '2', 'Thời gian chờ ra ca sau giờ kết thúc (giờ)'],
  ['minShiftHours', '2', 'Số giờ tối thiểu một lượt'],
  ['maxShiftHours', '14', 'Số giờ tối đa một lượt'],
  ['missingZeroThreshold', '10000', 'Ngưỡng nghi thiếu số 0 (đ)'],
  ['maxCash', '20000000', 'Trần tiền két mỗi báo cáo (đ)'],
  ['maxTransfer', '30000000', 'Trần tiền CK mỗi báo cáo (đ)'],
  ['diffThreshold', '100000', 'Ngưỡng lệch két báo Admin (đ)'],
  ['dayCutoffHour', '4', 'Giờ chốt ngày kinh doanh (giờ sáng hôm sau)'],
  ['expenseApprovalThreshold', '1000000', 'Ngưỡng duyệt chi (đ/khoản)'],
  ['advanceMonthlyLimit', '3000000', 'Hạn mức ứng lương (đ/người/tháng)'],
  ['revenueAnomalyPct', '50', 'Biên độ doanh thu bất thường (%)'],
  ['safeCashLevel', '5000000', 'Mức tồn két an toàn (đ)'],
  ['gpsMode', 'warn', 'Xác thực GPS: off / warn / block'],
  ['storeLat', '16.0544', 'Vĩ độ quán'],
  ['storeLng', '108.2425', 'Kinh độ quán'],
  ['gpsRadius', '100', 'Bán kính GPS (m)'],
  ['attendanceRequestDays', '7', 'Số ngày được báo thiếu công'],
  ['checkoutPhotoCount', '4', 'Số ảnh hiện trạng bắt buộc khi ra ca'],
  ['checkoutPhotoLabels', 'Bếp,Quầy thu ngân,Khu bàn ghế,Khu rửa & rác', 'Góc chụp (cách nhau dấu phẩy)'],
  ['photoMaxAgeMinutes', '10', 'Chỉ nhận ảnh chụp trong vòng (phút)'],
  ['zaloGroupLink', '', 'Link nhóm Zalo của quán (zalo.me/g/…)'],
  ['returnedRemindHours', '24', 'Nhắc báo cáo bị trả lại sau (giờ)'],
  ['alertEmail', '', 'Email nhận cảnh báo (để trống = không gửi)'],
  ['imageFolderId', '', 'Thư mục Google Drive lưu ảnh (dán link thư mục)']
];

var DEFAULT_SHIFT_TYPES = [
  // Giờ chuẩn mỗi ca là đề xuất, chủ quán sửa ở màn Cấu hình (quyết định D4).
  { ShiftTypeID: 'SANG', Name: 'Sáng', StartTime: '06:00', EndTime: '11:00', WorkUnits: 1, IsActive: true, SortOrder: 1 },
  { ShiftTypeID: 'TRUA', Name: 'Trưa', StartTime: '10:00', EndTime: '14:00', WorkUnits: 1, IsActive: true, SortOrder: 2 },
  { ShiftTypeID: 'TOI', Name: 'Tối', StartTime: '16:00', EndTime: '23:00', WorkUnits: 1, IsActive: true, SortOrder: 3 },
  { ShiftTypeID: 'TRUATOI', Name: 'Trưa – tối', StartTime: '10:00', EndTime: '23:00', WorkUnits: 1, IsActive: true, SortOrder: 4 }
];

var DEFAULT_CHECKPOINTS = [
  { CheckpointID: 'OPEN', Name: 'Đầu ngày', Deadline: '09:00', IsRequired: true, SortOrder: 1, IsOpening: true, IsClosing: false },
  { CheckpointID: 'NOON', Name: 'Trưa', Deadline: '10:30', IsRequired: false, SortOrder: 2, IsOpening: false, IsClosing: false },
  { CheckpointID: 'AFTERNOON', Name: 'Chiều', Deadline: '17:30', IsRequired: false, SortOrder: 3, IsOpening: false, IsClosing: false },
  { CheckpointID: 'CLOSE', Name: 'Cuối ngày', Deadline: '23:30', IsRequired: true, SortOrder: 4, IsOpening: false, IsClosing: true }
];

var DEFAULT_CATEGORIES = [
  { CategoryID: 'NGUYENLIEU', Name: 'Nguyên liệu', IsActive: true },
  { CategoryID: 'VATTU', Name: 'Vật tư tiêu hao', IsActive: true },
  { CategoryID: 'SHIP', Name: 'Vận chuyển / ship', IsActive: true },
  { CategoryID: 'VANHANH', Name: 'Vận hành (rác, điện nước…)', IsActive: true },
  { CategoryID: 'KHAC', Name: 'Chi khác', IsActive: true }
];

/* 16 tên trong form chấm công Excel (01/08–12/10/2026) + Tín (người lập báo cáo ca).
 * [mã, tên, vai trò, thu ngân, tên khác trong Excel]. Họ tên đầy đủ, SĐT do chủ quán bổ sung (quyết định D7). */
var DEFAULT_EMPLOYEES = [
  ['NV01', 'Chung', 'staff', false, 'Anh Chung'],
  ['NV02', 'Phúc', 'staff', false, ''],
  ['NV03', 'Như', 'staff', false, 'Bé Như'],
  ['NV04', 'Duyên', 'staff', true, ''],
  ['NV05', 'Phương', 'staff', false, ''],
  ['NV06', 'Huy', 'staff', false, ''],
  ['NV07', 'Tâm', 'leader', true, ''],
  ['NV08', 'Tín', 'leader', true, 'Anh Tín'],
  ['NV09', 'Cao Đăng', 'staff', false, ''],
  ['NV10', 'Cung', 'staff', false, ''],
  ['NV11', 'Cô Sanh', 'staff', false, ''],
  ['NV12', 'Cô Vân', 'staff', false, ''],
  ['NV13', 'Dung', 'staff', false, 'Chị Dung,Cô Dung'],
  ['NV14', 'Hiếu', 'staff', false, ''],
  ['NV15', 'Linh', 'staff', false, ''],
  ['NV16', 'Lâm', 'staff', false, ''],
  ['NV17', 'Mỹ', 'staff', false, '']
];

/* Tiện ích dùng chung: giờ Việt Nam, tiền, mã định danh, SHA-256, đọc số thành chữ. */

var MS_HOUR = 3600000;
var MS_DAY = 86400000;

function pad2(n) { return (n < 10 ? '0' : '') + n; }

/* Thời điểm (ms) → chuỗi giờ Việt Nam 'yyyy-MM-dd HH:mm:ss'. */
function fmtTs(ms) {
  var d = new Date(ms + APP.tzOffsetHours * MS_HOUR);
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()) + ' ' +
    pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ':' + pad2(d.getUTCSeconds());
}

/* Chuỗi giờ Việt Nam ('yyyy-MM-dd' hoặc 'yyyy-MM-dd HH:mm[:ss]') → ms. */
function parseTs(s) {
  if (s === null || s === undefined || s === '') return NaN;
  if (s instanceof Date) return s.getTime();
  var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) - APP.tzOffsetHours * MS_HOUR;
}

function nowMs() { return PLATFORM.now(); }
function nowTs() { return fmtTs(nowMs()); }

/* Ngày kinh doanh: giờ VN lùi lại 'giờ chốt ngày' (mặc định 4h) rồi lấy phần ngày. */
function businessDateOf(ms, cutoffHour) {
  var c = cutoffHour === undefined ? settingNum('dayCutoffHour') : cutoffHour;
  return fmtTs(ms - c * MS_HOUR).slice(0, 10);
}
function currentBusinessDate() { return businessDateOf(nowMs()); }

function addDays(dateStr, n) { return fmtTs(parseTs(dateStr) + n * MS_DAY).slice(0, 10); }
function monthOf(dateStr) { return String(dateStr).slice(0, 7); }

/* Giờ 'HH:mm' của một ngày kinh doanh → ms. Giờ trước giờ chốt (vd 01:00) thuộc sáng hôm sau. */
function tsOnBusinessDate(dateStr, hhmm) {
  var p = String(hhmm || '00:00').split(':');
  var h = +p[0], m = +(p[1] || 0);
  var base = parseTs(dateStr) + (h * 60 + m) * 60000;
  if (h < settingNum('dayCutoffHour')) base += MS_DAY;
  return base;
}

function fmtDateVN(dateStr) {
  if (!dateStr) return '';
  var s = String(dateStr);
  return s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4);
}

function toNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  var direct = Number(String(v).trim()); // nhận cả dạng khoa học của Excel: '1.046E7'
  if (!isNaN(direct)) return direct;
  var n = Number(String(v).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
}
function toBool(v) { return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1'; }

function fmtMoney(n) {
  n = Math.round(toNum(n));
  var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '−' : '') + s;
}

function uid(prefix) {
  var t = fmtTs(nowMs()).replace(/[^\d]/g, '').slice(2, 14);
  return prefix + t + PLATFORM.uuid().replace(/-/g, '').slice(0, 4).toUpperCase();
}

function round2(n) { return Math.round(n * 100) / 100; }

/* Khoảng cách giữa 2 tọa độ (m) — xác thực GPS (CB-02). */
function distanceM(lat1, lng1, lat2, lng2) {
  var R = 6371000, rad = Math.PI / 180;
  var dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* SHA-256 thuần JS, đồng bộ — cho kết quả giống nhau trên Apps Script và trình duyệt. */
function sha256Hex(str) {
  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  var bytes = [], i, j;
  var utf8 = unescape(encodeURIComponent(str));
  for (i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i));
  var bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff);
  var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  var W = new Array(64);
  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
  for (i = 0; i < bytes.length; i += 64) {
    for (j = 0; j < 16; j++) W[j] = (bytes[i + j * 4] << 24) | (bytes[i + j * 4 + 1] << 16) | (bytes[i + j * 4 + 2] << 8) | bytes[i + j * 4 + 3];
    for (j = 16; j < 64; j++) {
      var s0 = rotr(W[j - 15], 7) ^ rotr(W[j - 15], 18) ^ (W[j - 15] >>> 3);
      var s1 = rotr(W[j - 2], 17) ^ rotr(W[j - 2], 19) ^ (W[j - 2] >>> 10);
      W[j] = (W[j - 16] + s0 + W[j - 7] + s1) | 0;
    }
    var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (j = 0; j < 64; j++) {
      var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      var t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[j] + W[j]) | 0;
      var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      var t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  var out = '';
  for (i = 0; i < 8; i++) out += ('00000000' + (H[i] >>> 0).toString(16)).slice(-8);
  return out;
}

/* Đọc số tiền thành chữ, hiện dưới ô nhập để chống gõ thiếu số 0. */
function moneyToWords(n) {
  n = Math.floor(Math.abs(toNum(n)));
  if (n === 0) return 'Không đồng';
  var digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  function three(x, full) {
    var tr = Math.floor(x / 100), ch = Math.floor((x % 100) / 10), dv = x % 10, out = [];
    if (full || tr > 0) out.push(digits[tr] + ' trăm');
    if (ch > 1) {
      out.push(digits[ch] + ' mươi');
      if (dv === 1) out.push('mốt'); else if (dv === 5) out.push('lăm'); else if (dv > 0) out.push(digits[dv]);
    } else if (ch === 1) {
      out.push('mười');
      if (dv === 5) out.push('lăm'); else if (dv > 0) out.push(digits[dv]);
    } else if (dv > 0) {
      if (full || tr > 0) out.push('lẻ');
      out.push(digits[dv]);
    }
    return out.join(' ');
  }
  var units = ['', ' nghìn', ' triệu', ' tỷ'], parts = [], i = 0;
  while (n > 0) { parts.push(n % 1000); n = Math.floor(n / 1000); i++; }
  var words = [];
  for (i = parts.length - 1; i >= 0; i--) {
    if (parts[i] === 0) continue;
    words.push(three(parts[i], i < parts.length - 1) + units[i]);
  }
  var s = words.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1) + ' đồng';
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function sum(arr, fn) {
  var t = 0;
  for (var i = 0; i < arr.length; i++) t += toNum(fn ? fn(arr[i]) : arr[i]);
  return t;
}

function groupBy(arr, keyFn) {
  var m = {};
  arr.forEach(function (x) { var k = keyFn(x); (m[k] = m[k] || []).push(x); });
  return m;
}

function normName(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
