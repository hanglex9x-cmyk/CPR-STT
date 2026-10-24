/**
 * CPR-STT — Backend Google Apps Script cho hệ thống chấm công cao su.
 * Chạy trên Google Sheets + GitHub Pages (front-end ở index.html).
 *
 * CÁCH DÙNG (từ tài khoản Google của khách/Hằng, KHÔNG dùng Sheet lạ):
 *  1. Tạo 1 Google Sheet mới, tạo đúng các tab dưới đây, dòng 1 là tiêu đề cột.
 *  2. Mở Extensions > Apps Script, dán toàn bộ file này, lưu.
 *  3. Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone
 *     (hoặc Anyone with Google account, tùy khách chốt) > lấy link /exec.
 *  4. Dán link /exec vào biến API_URL trong index.html, push lên GitHub, bật GitHub Pages.
 *  5. Front-end gọi API này; khi chưa có API_URL, front-end chạy chế độ Demo với số thật 10/2026.
 *
 * QUY TẮC GIỮ NGUYÊN TỪ SHEET CŨ:
 *  - Có mặt = Đi làm + Vắng; Thiếu (ngày cạo) = Định biên - Có mặt.
 *  - Đi làm trong bảng nhóm luôn bằng Công cạo Thường (Đúp/Choảng nằm ngoài Đi làm).
 *  - Ngày nghỉ (trangThaiNgay = NGHI) không tính Thiếu vào thiếu lao động tháng.
 *  - Trang bị/Thuê phân biệt "chưa nhập" (ô trống) với 0 (không phát sinh).
 *
 * TABS (dòng 1 = header, đúng thứ tự này):
 *  DonVi:        id, ten, loai (DOI/NHOM), chaId, dinhBienMacDinh
 *  NhanVien:     maThe, hoTen, doi, nhom, lo, soCayGiao, dangLam, isSample
 *  ChamCongNgay: ngay, maThe, doi, nhom, trangThai (CO_MAT/VANG/PHEP), ghiChu, nguoiCham, updatedAt
 *  PhieuCao:     ngay, maThe, doi, nhom, lo, loaiCao (THUONG/DUP/CHOANG), phien (D1/D2/VET),
 *                phanCaoSheet, soCayGiao, soCayThucTe, sanLuongKg, ngayMuaGoc
 *  CongTrangBi:  id, ngay, maThe, doi, nhom, loaiViec (PHAT_DON/BON_PHAN/SUA_CHEN/LAM_MANG/KHAC),
 *                cong, vung, cayTrong, dienTich, ghiChu
 *  ChiTietBonPhan: congTrangBiId, loaiPhan, soLuong, donVi, donGia, thanhTien
 *  BaoCaoNgayNhom: ngay, doi, nhom, trangThaiNgay (CAO/NGHI/CHUA_NHAP), dinhBien,
 *                phienThuong, congThuong, phienDup, congDup, phienChoang, congChoang,
 *                tbThietKe, tbKiengChen, tbChanMua, tbCheChen, tbVayCheChen, tbCaoXa, tbKhac,
 *                thueCao, thueBocMu, diLam, vang, coMat, thieu, tuyenMoi, nghiViec, nguon
 *  DonGia:       loai (CAO/TRANG_BI/THUONG_VUOT), donGia, hieuLucTu, ghiChu
 *  ChotSo:       thang, doi, nguoiChot, ngayChot, ghiChu
 *  NhatKySua:    thoiGian, bang, banGhiId, truong, giaTriCu, giaTriMoi, nguoiSua, lyDo
 */

function sheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error("Thieu tab: " + name);
  return sh;
}
function rows_(name) {
  var v = sheet_(name).getDataRange().getValues();
  if (v.length < 2) return [];
  var h = v[0];
  return v.slice(1).filter(function (r) { return String(r[0]).trim() !== ""; })
    .map(function (r) { var o = {}; h.forEach(function (k, i) { o[String(k).trim()] = r[i]; }); return o; });
}
function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function num_(v) {
  if (v === "" || v === null || v === undefined) return 0;
  var n = Number(String(v).replace(/\./g, "").replace(/,/g, "."));
  return isNaN(n) ? 0 : n;
}

function doGet(e) {
  try {
    var a = (e && e.parameter && e.parameter.action) || "ping";
    if (a === "ping") return out_({ ok: true, app: "CPR-STT cham cong cao su" });
    if (a === "getDonVi") return out_({ ok: true, data: rows_("DonVi") });
    if (a === "getNhanVien") {
      var all = rows_("NhanVien");
      var doi = e.parameter.doi, nhom = e.parameter.nhom;
      return out_({ ok: true, data: all.filter(function (r) {
        return (!doi || String(r.doi) === doi) && (!nhom || String(r.nhom) === nhom);
      }) });
    }
    if (a === "getChamCong") {
      var u1 = auth_(e.parameter.token);
      if (!u1) return out_({ ok: false, error: "Chua dang nhap." });
      var doi1 = u1.vaiTro === "DOI" ? u1.doi : e.parameter.doi;
      var cc = rows_("ChamCongNgay").filter(function (r) {
        return String(r.ngay) === String(e.parameter.ngay) &&
          (!doi1 || String(r.doi) === doi1) &&
          (!e.parameter.nhom || String(r.nhom) === e.parameter.nhom);
      });
      return out_({ ok: true, data: cc });
    }
    if (a === "getBaoCaoThang") {
      // thang = "2026-10", doi = "Đội 1" (trống = toàn công ty)
      var u2 = auth_(e.parameter.token);
      if (!u2) return out_({ ok: false, error: "Chua dang nhap." });
      var doi2 = u2.vaiTro === "DOI" ? u2.doi : e.parameter.doi;
      var thang = String(e.parameter.thang || "");
      var list = rows_("BaoCaoNgayNhom").filter(function (r) {
        var d = String(r.ngay); // Sheets có thể trả Date hoặc chuỗi; chuẩn hóa yyyy-mm
        var ym = d.slice(0, 7);
        return (!thang || ym === thang || d.indexOf(thang) >= 0) &&
          (!doi2 || String(r.doi) === doi2);
      });
      return out_({ ok: true, data: list });
    }
    if (a === "getUsers") {
      var u3 = auth_(e.parameter.token);
      if (!u3) return out_({ ok: false, error: "Chua dang nhap." });
      return out_(getUsers_(u3));
    }
    return out_({ ok: false, error: "action khong ho tro: " + a });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var body = JSON.parse(e.postData.contents);
    var a = body.action;
    if (a === "login") return out_(login_(body));
    if (a === "logout") return out_(logout_(body));
    if (a === "changePassword" || a === "resetPassword") {
      var uu = auth_(body.token);
      if (!uu) return out_({ ok: false, error: "Chua dang nhap." });
      return out_(a === "changePassword" ? changePassword_(body, uu) : resetPassword_(body, uu));
    }
    // Các action ghi dữ liệu đều cần token; Đội chỉ được ghi đội của mình; chốt tháng chỉ Admin.
    if (a === "saveChamCong" || a === "savePhieuCao" || a === "saveTrangBi" || a === "saveBaoCaoNhom" || a === "chotThang") {
      var user = auth_(body.token);
      if (!user) return out_({ ok: false, error: "Chua dang nhap." });
      if (a === "chotThang" && user.vaiTro !== "ADMIN") return out_({ ok: false, error: "Chi Admin moi duoc chot thang." });
      if (!canDoi_(user, body.doi)) return out_({ ok: false, error: "Tai khoan nay chi duoc nhap lieu doi cua minh." });
      body.nguoiCham = body.nguoiCham || user.tenDangNhap;
    }
    if (a === "saveChamCong") return out_(saveChamCong_(body));
    if (a === "savePhieuCao") return out_(savePhieuCao_(body));
    if (a === "saveTrangBi") return out_(saveTrangBi_(body));
    if (a === "saveBaoCaoNhom") return out_(saveBaoCaoNhom_(body));
    if (a === "chotThang") return out_(chotThang_(body));
    return out_({ ok: false, error: "action khong ho tro: " + a });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

// Upsert theo khóa: tìm dòng khớp các cột khóa, có thì ghi đè, không thì append.
function upsert_(tab, keys, row) {
  var sh = sheet_(tab);
  var v = sh.getDataRange().getValues();
  var h = v[0];
  var idx = {};
  h.forEach(function (k, i) { idx[String(k).trim()] = i; });
  for (var r = 1; r < v.length; r++) {
    var match = keys.every(function (k) { return String(v[r][idx[k]]) === String(row[k]); });
    if (match) {
      var vals = h.map(function (k) { return row[String(k).trim()] !== undefined ? row[String(k).trim()] : v[r][idx[String(k).trim()]]; });
      sh.getRange(r + 1, 1, 1, vals.length).setValues([vals]);
      return { updated: true, row: r + 1 };
    }
  }
  var vals2 = h.map(function (k) { return row[String(k).trim()] !== undefined ? row[String(k).trim()] : ""; });
  sh.appendRow(vals2);
  return { updated: false, row: v.length + 1 };
}

function saveChamCong_(body) {
  // body: {ngay, doi, nhom, nguoiCham, workers: [{maThe, trangThai, ghiChu}]}
  if (!body.ngay || !body.workers || !body.workers.length) return { ok: false, error: "Thieu ngay hoac danh sach cong nhan" };
  body.workers.forEach(function (w) {
    upsert_("ChamCongNgay", ["ngay", "maThe"], {
      ngay: body.ngay, maThe: w.maThe, doi: body.doi, nhom: body.nhom,
      trangThai: w.trangThai, ghiChu: w.ghiChu || "", nguoiCham: body.nguoiCham || "",
      updatedAt: new Date()
    });
  });
  return { ok: true, saved: body.workers.length };
}

function savePhieuCao_(body) {
  // body: {ngay, maThe, doi, nhom, lo, loaiCao, phien, phanCaoSheet, soCayGiao, soCayThucTe, sanLuongKg, ngayMuaGoc}
  // Validation Module 3:
  if (body.loaiCao === "CHOANG" && !body.ngayMuaGoc)
    return { ok: false, error: "Cao choang bat buoc chon ngay mua goc." };
  if (body.loaiCao === "CHOANG") {
    var trung = rows_("PhieuCao").some(function (r) {
      return String(r.maThe) === String(body.maThe) && String(r.loaiCao) === "CHOANG" &&
        String(r.ngayMuaGoc) === String(body.ngayMuaGoc);
    });
    if (trung) return { ok: false, error: "Ngay mua nay da duoc choang roi cho cong nhan nay." };
  }
  // Đúp: cảnh báo (không chặn cứng ở backend v1, để đội bổ sung phiên còn thiếu trong ngày)
  var canhBao = "";
  if (body.loaiCao === "DUP") {
    var cungNgay = rows_("PhieuCao").filter(function (r) {
      return String(r.maThe) === String(body.maThe) && String(r.ngay) === String(body.ngay) && String(r.loaiCao) === "DUP";
    });
    var phien = cungNgay.map(function (r) { return String(r.phien); });
    if (phien.indexOf("D1") < 0 && phien.indexOf("D2") < 0 && body.phien !== "D1" && body.phien !== "D2")
      canhBao = "Cao dup can du D1 + D2 trong ngay.";
    else if (!((phien.indexOf("D1") >= 0 && body.phien === "D2") || (phien.indexOf("D2") >= 0 && body.phien === "D1") || phien.length === 0))
      canhBao = "Cao dup moi co 1 phien trong ngay, can bo sung phien con lai.";
  }
  var sh = sheet_("PhieuCao");
  sh.appendRow([body.ngay, body.maThe, body.doi, body.nhom, body.lo || "", body.loaiCao, body.phien,
    body.phanCaoSheet || "", body.soCayGiao || "", body.soCayThucTe || "", body.sanLuongKg || "", body.ngayMuaGoc || ""]);
  return { ok: true, canhBao: canhBao };
}

function saveTrangBi_(body) {
  // body: {ngay, maThe, doi, nhom, loaiViec, cong, vung, cayTrong, dienTich, ghiChu, dongPhan: [{loaiPhan, soLuong, donVi, donGia}]}
  var id = "TB" + new Date().getTime();
  sheet_("CongTrangBi").appendRow([id, body.ngay, body.maThe, body.doi, body.nhom, body.loaiViec,
    body.cong || 1, body.vung || "", body.cayTrong || "", body.dienTich || "", body.ghiChu || ""]);
  if (body.loaiViec === "BON_PHAN" && body.dongPhan) {
    body.dongPhan.forEach(function (d) {
      var tt = num_(d.soLuong) * num_(d.donGia); // Thành tiền tự tính ở server, không tin số client gửi
      sheet_("ChiTietBonPhan").appendRow([id, d.loaiPhan, d.soLuong, d.donVi, d.donGia, tt]);
    });
  }
  return { ok: true, id: id };
}

function saveBaoCaoNhom_(body) {
  // body: phiếu nhóm/ngày. Hệ thống tự tính coMat/thieu, không tin số client gửi.
  var diLam = num_(body.diLam), vang = num_(body.vang), db = num_(body.dinhBien);
  var coMat = body.trangThaiNgay === "NGHI" ? 0 : diLam + vang;
  var thieu = body.trangThaiNgay === "NGHI" ? 0 : db - coMat; // Ngày nghỉ không tính thiếu lao động
  upsert_("BaoCaoNgayNhom", ["ngay", "doi", "nhom"], {
    ngay: body.ngay, doi: body.doi, nhom: body.nhom, trangThaiNgay: body.trangThaiNgay || "CAO",
    dinhBien: db, phienThuong: body.phienThuong || "", congThuong: num_(body.congThuong),
    phienDup: body.phienDup || "", congDup: num_(body.congDup),
    phienChoang: body.phienChoang || "", congChoang: num_(body.congChoang),
    tbThietKe: num_(body.tbThietKe), tbKiengChen: num_(body.tbKiengChen), tbChanMua: num_(body.tbChanMua),
    tbCheChen: num_(body.tbCheChen), tbVayCheChen: num_(body.tbVayCheChen), tbCaoXa: num_(body.tbCaoXa),
    tbKhac: num_(body.tbKhac), thueCao: num_(body.thueCao), thueBocMu: num_(body.thueBocMu),
    diLam: diLam, vang: vang, coMat: coMat, thieu: thieu,
    tuyenMoi: num_(body.tuyenMoi), nghiViec: num_(body.nghiViec), nguon: "HE_THONG"
  });
  return { ok: true, coMat: coMat, thieu: thieu };
}

function chotThang_(body) {
  // body: {thang, doi, nguoiChot, ghiChu} — ghi vào ChotSo, front-end/API sau đó chặn sửa tháng đã chốt
  // (chặn cứng ở bản đầy đủ: kiểm tra ChotSo trước mỗi save; bản này ghi nhận chốt trước).
  sheet_("ChotSo").appendRow([body.thang, body.doi || "TOAN_CONG_TY", body.nguoiChot || "", new Date(), body.ghiChu || ""]);
  return { ok: true };
}

// ===== PHÂN QUYỀN 3 TÀI KHOẢN (v2, 24/10/2026) =====
// Vai trò: ADMIN (toàn quyền, xem tổng quan/báo cáo, chốt tháng, quản lý tài khoản),
// DOI (chỉ nhập liệu và xem đội của mình).
// Mật khẩu KHÔNG lưu dạng text: chỉ lưu SHA-256 trong tab NguoiDung.
// Phiên đăng nhập: token UUID lưu tab PhienDangNhap, hết hạn sau 7 ngày.
// Chế độ Demo (chưa có API_URL) không gọi các hàm này; front-end cho chọn vai trò demo.

function sha256_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8);
  return bytes.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? "0" + v : v; }).join("");
}
function findUser_(ten) {
  return rows_("NguoiDung").filter(function (r) { return String(r.tenDangNhap) === String(ten); })[0] || null;
}
function auth_(token) {
  if (!token) return null;
  var sessions = rows_("PhienDangNhap");
  var now = new Date().getTime();
  for (var i = 0; i < sessions.length; i++) {
    if (String(sessions[i].token) === String(token)) {
      var hetHan = sessions[i].hetHan ? new Date(sessions[i].hetHan).getTime() : 0;
      if (hetHan && hetHan < now) return null;
      return { tenDangNhap: sessions[i].tenDangNhap, vaiTro: sessions[i].vaiTro, doi: sessions[i].doi };
    }
  }
  return null;
}
function canDoi_(user, doi) {
  if (!user) return false;
  if (user.vaiTro === "ADMIN") return true;
  return String(user.doi) === String(doi);
}
function login_(body) {
  var u = findUser_(body.tenDangNhap);
  if (!u || String(u.dangHoatDong).toUpperCase() !== "TRUE") return { ok: false, error: "Tai khoan khong ton tai hoac da khoa." };
  if (sha256_(body.matKhau || "") !== String(u.matKhauHash)) return { ok: false, error: "Sai mat khau." };
  var token = Utilities.getUuid();
  var hetHan = new Date(new Date().getTime() + 7 * 24 * 3600 * 1000);
  sheet_("PhienDangNhap").appendRow([token, u.tenDangNhap, u.vaiTro, u.doi || "", hetHan, new Date()]);
  return { ok: true, token: token, tenDangNhap: u.tenDangNhap, vaiTro: u.vaiTro, doi: u.doi || "", canDoiMatKhau: String(u.canDoiMatKhau).toUpperCase() === "TRUE" };
}
function logout_(body) {
  var sh = sheet_("PhienDangNhap");
  var v = sh.getDataRange().getValues();
  for (var r = v.length - 1; r >= 1; r--) {
    if (String(v[r][0]) === String(body.token)) sh.deleteRow(r + 1);
  }
  return { ok: true };
}
function changePassword_(body, user) {
  var u = findUser_(user.tenDangNhap);
  if (!u) return { ok: false, error: "Khong tim thay tai khoan." };
  if (sha256_(body.matKhauCu || "") !== String(u.matKhauHash)) return { ok: false, error: "Mat khau cu khong dung." };
  if (!body.matKhauMoi || String(body.matKhauMoi).length < 6) return { ok: false, error: "Mat khau moi toi thieu 6 ky tu." };
  var sh = sheet_("NguoiDung");
  var v = sh.getDataRange().getValues();
  for (var r = 1; r < v.length; r++) {
    if (String(v[r][0]) === String(user.tenDangNhap)) {
      sh.getRange(r + 1, 5).setValue(sha256_(body.matKhauMoi));
      sh.getRange(r + 1, 7).setValue("FALSE");
      break;
    }
  }
  return { ok: true };
}
function resetPassword_(body, user) {
  if (user.vaiTro !== "ADMIN") return { ok: false, error: "Chi Admin moi duoc dat lai mat khau." };
  if (!body.matKhauMoi || String(body.matKhauMoi).length < 6) return { ok: false, error: "Mat khau moi toi thieu 6 ky tu." };
  var sh = sheet_("NguoiDung");
  var v = sh.getDataRange().getValues();
  for (var r = 1; r < v.length; r++) {
    if (String(v[r][0]) === String(body.tenDangNhap)) {
      sh.getRange(r + 1, 5).setValue(sha256_(body.matKhauMoi));
      sh.getRange(r + 1, 7).setValue("TRUE");
      return { ok: true };
    }
  }
  return { ok: false, error: "Khong tim thay tai khoan." };
}
function getUsers_(user) {
  if (user.vaiTro !== "ADMIN") return { ok: false, error: "Chi Admin moi duoc xem danh sach tai khoan." };
  var list = rows_("NguoiDung").map(function (r) {
    return { tenDangNhap: r.tenDangNhap, vaiTro: r.vaiTro, doi: r.doi, hoTen: r.hoTen, dangHoatDong: r.dangHoatDong, canDoiMatKhau: r.canDoiMatKhau };
  });
  return { ok: true, data: list };
}
