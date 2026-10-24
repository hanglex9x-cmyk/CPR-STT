# CPR-STT — Chấm công cao su (Google Sheets + GitHub Pages)

Front-end tĩnh cho GitHub Pages, backend là Google Apps Script, dữ liệu nằm trong Google Sheet
của khách/Hằng. Không dùng Supabase ở hướng này (code Next.js + Supabase vẫn giữ ở
`../cao-su-webapp/` làm phương án dự phòng).

## Cấu trúc repo này

- `index.html` — toàn bộ app (Module 1–5), mobile-first, Tailwind-style inline CSS,
  màu xanh cao su `#166534`, nền `#F5F7FA`, mọi dòng là khung trắng bo 12px viền `#D1D5DB`.
- `Code.gs` — backend Apps Script (doGet/doPost).

## Chạy live trong 4 bước

1. **Tạo Sheet mới từ tài khoản Google của khách/Hằng** (đừng dùng Sheet tạo qua API lạ,
   vì file đó có thể không hiện trong Drive của mày — tao đã gặp đúng lỗi này và đã dừng lại).
   Tạo đúng 10 tab, dòng 1 là tiêu đề cột (xem đầu file `Code.gs`):
   `DonVi, NhanVien, ChamCongNgay, PhieuCao, CongTrangBi, ChiTietBonPhan,
   BaoCaoNgayNhom, DonGia, ChotSo, NhatKySua`.
2. **Dán `Code.gs` vào Apps Script của Sheet đó** (Extensions > Apps Script),
   Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone
   (hoặc Anyone with Google account, tùy khách chốt) > copy link `/exec`.
3. **Dán link `/exec` vào biến `API_URL`** ở đầu thẻ `<script>` trong `index.html`.
   Khi `API_URL` trống, app tự chạy chế độ Demo với số thật 10/2026 và lưu tạm trên trình duyệt.
4. **Push repo lên GitHub, bật Settings > Pages > Deploy from branch (main, /root).**
   Link Pages sẽ mở được trên điện thoại (khác với link Apps Script trực tiếp hay bị chặn
   chuyển hướng trên điện thoại).

## Chế độ Demo (khi chưa có API_URL)

- Số tổng hợp là số thật tháng 10/2026 từ Sheet “CHẤM CÔNG CẠO” (01–24/10, 24/10 không cạo).
- Danh sách công nhân là 12 dòng mẫu theo mã hệ thống, không phải tên thật.
- Lưu chấm công chỉ lưu vào localStorage của trình duyệt đang xem.

## Những gì backend đã chặn / cảnh báo

- Cạo choảng bắt buộc chọn ngày mưa gốc; trùng ngày mưa gốc cho cùng công nhân thì từ chối.
- Cạo đúp cảnh báo khi trong ngày chưa đủ D1 + D2.
- Báo cáo nhóm tự tính Có mặt = Đi làm + Vắng, Thiếu = Định biên − Có mặt; ngày nghỉ không tính Thiếu.
- Thành tiền bón phân tự tính ở server (số lượng × đơn giá), không tin số client gửi.
- Lưu chấm công dùng LockService để tránh ghi đè khi 2 người lưu cùng lúc.

## Chưa làm (cần khách chốt trước khi dùng thật)

Danh sách công nhân thật, đơn giá cạo/trang bị, sản lượng mủ kg, map 5 vai trò app ↔ sơ đồ
bộ máy thật, và 7 câu hỏi ở tài liệu thiết kế trước (Đội 2 Nhóm 7 = 114 người?, Đội 1 Nhóm 4
từ 09/10, ngày 24/10 nghỉ?, lương tính Thường hay tổng 3 loại?, trang bị/thuê 0 là thật hay
chưa nhập?, lý do vắng, quy tắc phiên).

## Web app 3 tài khoản (v2, 24/10/2026)
- **Admin**: toàn quyền — xem tổng quan/báo cáo toàn công ty, xem tất cả các module, chốt tháng, quản lý tài khoản (đặt lại mật khẩu cho Đội).
- **Đội 1 / Đội 2**: chỉ nhập liệu và xem số của đội mình. Không thấy số đội còn lại, không thấy Module 5 (Lương).
- Đăng nhập: chế độ Demo (chưa có /exec) cho chọn vai trò demo, không cần mật khẩu. Chế độ Live bắt buộc đăng nhập bằng tài khoản trong tab `NguoiDung` của Sheet hệ thống; mật khẩu chỉ lưu dạng SHA-256, không có trong repo.
- Backend kiểm tra token phiên (tab `PhienDangNhap`, hết hạn 7 ngày) ở mọi action ghi dữ liệu; Đội ghi sai đội sẽ bị từ chối, chốt tháng chỉ Admin mới được.
- Tài khoản khởi tạo và mật khẩu tạm do người quản trị Sheet cấp riêng cho từng người, mỗi người tự đổi mật khẩu trong app sau lần đăng nhập đầu.
