# DATA CARD — Dữ liệu Tổng hợp & Kiểm soát Đạo đức (EduAlert)

## 1. Mục đích và Phạm vi
Do dữ liệu học vụ thực tế của sinh viên chịu sự điều chỉnh nghiêm ngặt của **Nghị định 13/2023/NĐ-CP về Bảo vệ dữ liệu cá nhân**, hệ thống EduAlert sử dụng bộ sinh dữ liệu tổng hợp có kiểm soát nhân quả (`backend/seed_data.py`, cố định `seed = 42`) để phục vụ kiểm thử toàn diện 18 bảng CSDL, Rule Engine và họ mô hình đồ thị.

## 2. Quy mô và Cấu trúc Dữ liệu
- **Số lượng sinh viên:** 180 sinh viên (`SV001` – `SV180`), mã hóa ẩn danh SHA-256 (`ANON_...`) khi đưa vào pipeline huấn luyện.
- **Số lớp & ngành:** 6 lớp thuộc 3 chương trình đào tạo (`CS_DB`, `CS_AI`, `IS_ERP`), phân công cho 3 Cố vấn học tập.
- **Chuỗi thời gian:** 4 học kỳ liên tiếp (`2024_HK1` → `2025_HK2`), tổng cộng 720 bản ghi `semester_results` và 2.880 bản ghi `enrollments` trên 15 học phần.
- **Đồ thị sinh viên (`graph_edges`):** Kết hợp 3 loại cạnh:
  1. `SHARED_COURSE`: Cùng nhóm học tập / đồ án môn học (bao gồm cả các nhóm trộn lẫn sinh viên giỏi và yếu — hiện tượng dị thể *heterophily*).
  2. `SAME_CLASS`: Cùng lớp sinh hoạt.
  3. `KNN_PROFILE`: Tương đồng hồ sơ học tập theo khoảng cách Euclid ($k$-NN).

## 3. Các Hồ sơ Điển hình (Archetypes) phục vụ Kiểm thử & Demo
- **`SV001` (Nguyễn Minh Hải):** Sinh viên nhóm an toàn (Bình thường - Xanh), GPA duy trì > 3.20, không nợ tín chỉ.
- **`SV002` (Trần Hoàng Nam):** Sinh viên **cảnh báo sớm bởi mô hình** — chưa chạm bất kỳ ngưỡng nào của Thông tư 08/2021 (ĐTB tích lũy 2.22 > 1.40, ĐTB kỳ 1.62 > 1.00, nợ 10/24 TC), nhưng GPA học kỳ giảm liên tục qua 4 kỳ (`2.95 → 2.55 → 2.05 → 1.62`) và đăng ký nhiều học phần khó.
- **`SV003` (Lê Thị Khánh Linh):** Sinh viên **vi phạm quy chế Thông tư 08/2021** (chạm đồng thời R01, R03, R04) — Rule Engine kích hoạt quyền ưu tiên tuyệt đối, xếp mức Nguy cơ cao (Đỏ).
- **`SV005` (Huỳnh Ngọc Thảo):** Sinh viên nợ đọng 28/24 TC và bị cảnh báo học vụ liên tiếp — thuộc diện xét buộc thôi học (R02 & R05).

