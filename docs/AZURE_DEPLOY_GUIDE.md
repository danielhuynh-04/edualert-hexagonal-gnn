# ☁️ Hướng Dẫn Triển Khai EduAlert Lên Microsoft Azure (Gói Azure for Students)

Tài liệu này hướng dẫn từng bước đưa toàn bộ hệ thống **EduAlert** (React 18 SPA + Flask Hexagonal Core + Sheaf Attention GNN + Trợ lý AI Google Gemini + SQLite 3NF tự khởi tạo) lên đám mây **Microsoft Azure** bằng tài khoản **Azure for Students** (`@ou.edu.vn` / email sinh viên — tặng **$100 tín dụng miễn phí**, không cần thẻ tín dụng) để lấy **điểm cộng (Bonus)** khi bảo vệ đồ án.

---

## 1. Vì sao EduAlert chạy mượt trên gói Free của Azure?

Dự án đã được thiết kế sẵn chế độ **Single-Service Production (`backend/wsgi.py`)**:
- Khi chạy cục bộ (`start_edualert.bat`), hệ thống chạy 2 tiến trình (Node.js BFF Gateway `:3000` + Python Core `:8000`).
- Khi đẩy lên **Azure App Service** (chỉ cấp 1 container/port duy nhất trên gói **F1 Free** hoặc **B1 Basic**), Flask tự động đảm nhiệm luôn các đường dẫn BFF (`/api/bff/dashboard-overview`, `/api/gateway/health`), phục vụ giao diện React 18 và tự động seed cơ sở dữ liệu 180 sinh viên ngay lần khởi động đầu tiên.
- Không cần thuê thêm máy chủ PostgreSQL đắt đỏ (tiết kiệm 100% tín dụng Azure), vẫn đảm bảo đầy đủ 18 bảng 3NF và dữ liệu mẫu.

---

## 2. Chuẩn bị Tài khoản Azure for Students (3 phút)

1. Truy cập: https://azure.microsoft.com/en-us/free/students/
2. Nhấn **Start Free** và đăng nhập bằng email trường đại học (`.edu.vn`).
3. Nhận ngay **$100 Azure Credit** (có hiệu lực 12 tháng) + gói **Azure App Service F1 (Free)** miễn phí.

---

## 3. Cách 1: Đẩy lên Azure App Service qua Giao diện Web & GitHub (Khuyên dùng — Dễ nhất)

### Bước 1: Tạo Web App trên Azure Portal
1. Mở [portal.azure.com](https://portal.azure.com) → tìm **App Services** → nhấn **+ Create** → **Web App**.
2. Điền thông tin:
   - **Subscription**: `Azure for Students`
   - **Resource Group**: nhấn *Create new* → đặt tên `rg-edualert`
   - **Name**: đặt tên duy nhất, ví dụ `edualert-ou-2026` (URL sẽ là `https://edualert-ou-2026.azurewebsites.net`)
   - **Publish**: `Code`
   - **Runtime stack**: `Python 3.10`
   - **Operating System**: `Linux`
   - **Region**: `Southeast Asia` (Singapore — ping thấp nhất về Việt Nam)
   - **Pricing Plan**: chọn **F1 (Free, 0 USD/tháng)** hoặc **B1 (Basic — trừ nhẹ vào $100 credit miễn phí, chạy nhanh hơn và không bị sleep)**.
3. Nhấn **Review + create** → **Create**.

### Bước 2: Cấu hình Startup Command & Khóa Google Gemini AI
Sau khi Web App được tạo xong, bấm **Go to resource**:

1. **Cấu hình lệnh khởi động (`Startup Command`)**:
   - Vào menu trái: **Settings** → **Configuration** → tab **General settings**.
   - Tại ô **Startup Command**, dán chính xác lệnh sau:
     ```bash
     gunicorn --bind=0.0.0.0:8000 --timeout 600 --workers 2 backend.wsgi:app
     ```
   - Nhấn **Save** → **Continue**.

2. **Cấu hình khóa Google Gemini API miễn phí (`Environment Variables`)**:
   - Vào menu trái: **Settings** → **Environment variables** → **+ Add**:
     | Name | Value |
     |---|---|
     | `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` |
     | `GEMINI_API_KEY` | *(Dán khóa lấy miễn phí tại https://aistudio.google.com/apikey)* |
     | `GEMINI_MODEL` | `gemini-2.5-flash` |
   - Nhấn **Apply** → **Confirm**.
   > *Lưu ý:* Kể cả khi chưa đặt `GEMINI_API_KEY` trên Azure, người dùng vẫn có thể dán khóa trực tiếp ngay trên giao diện web ở tab **✦ Trợ lý AI**!

### Bước 3: Kết nối GitHub để Tự động Deploy (CI/CD)
1. Trong trang quản lý Web App trên Azure, chọn **Deployment** → **Deployment Center**.
2. **Source**: chọn **GitHub** → **Authorize** tài khoản GitHub của bạn.
3. Chọn:
   - **Organization**: `danielhuynh-04` (hoặc tài khoản của bạn)
   - **Repository**: `edualert-hexagonal-gnn`
   - **Branch**: `main`
4. Nhấn **Save**. Azure sẽ tự động cài đặt `requirements.txt`, chạy bộ kiểm thử và khởi chạy server trong khoảng 2–3 phút.
5. Mở đường dẫn `https://<ten-app-cua-ban>.azurewebsites.net` để trải nghiệm trực tiếp!

---

## 4. Cách 2: Đẩy bằng 1 Lệnh duy nhất với Azure CLI (`az webapp up`)

Nếu máy tính đã cài [Azure CLI](https://aka.ms/installazurecliwindows), mở PowerShell tại thư mục `E:\cnlthd\edualert`:

```powershell
# 1. Đăng nhập tài khoản Azure for Students
az login

# 2. Tạo và đẩy toàn bộ mã nguồn lên Azure App Service (Linux Python 3.10)
az webapp up `
  --name edualert-ou-2026 `
  --resource-group rg-edualert `
  --location southeastasia `
  --sku B1 `
  --runtime "PYTHON:3.10" `
  --os-type Linux

# 3. Đặt lệnh khởi động gunicorn
az webapp config set `
  --name edualert-ou-2026 `
  --resource-group rg-edualert `
  --startup-file "gunicorn --bind=0.0.0.0:8000 --timeout 600 --workers 2 backend.wsgi:app"

# 4. (Tùy chọn) Gắn khóa Google Gemini API miễn phí
az webapp config appsettings set `
  --name edualert-ou-2026 `
  --resource-group rg-edualert `
  --settings GEMINI_API_KEY="AIzaSy..." GEMINI_MODEL="gemini-2.5-flash" SCM_DO_BUILD_DURING_DEPLOYMENT="true"
```

---

## 5. Cách 3: Triển khai bằng Docker Container (Azure Web App for Containers / Container Apps)

Dự án đã có sẵn `Dockerfile` chuẩn hóa tại thư mục gốc:

```powershell
# Chạy thử container ngay trên máy cục bộ
docker build -t edualert:latest .
docker run -p 8000:8000 -e GEMINI_API_KEY="AIzaSy..." edualert:latest
```
Sau đó có thể đẩy image lên Docker Hub hoặc Azure Container Registry (`acr`) để chạy trên **Azure Container Apps**.

---

## 6. Điểm nhấn Thuyết trình với Hội đồng (Bonus Cloud & DevOps)

Khi trình bày trước Hội đồng, bạn có thể nhấn mạnh 3 điểm cộng kỹ thuật:
1. **CI/CD Tự động hóa (`.github/workflows/azure-deploy.yml`)**: Mỗi lần `git push origin main`, GitHub Actions tự động chạy 9 bài kiểm thử đơn vị (Rule Engine TT08, Hybrid Override, RLS) trước khi đẩy lên Azure App Service.
2. **Kiến trúc Thích ứng Đám mây (Cloud-Adaptive Hexagonal)**: Nhờ tách biệt hoàn toàn Lõi nghiệp vụ (Domain Core) khỏi tầng giao vận, cùng một mã nguồn vừa chạy được mô hình 2 tầng (Node.js BFF + Python Core) tại chỗ, vừa gom gọn thành 1 WSGI Container duy nhất trên gói miễn phí Azure for Students.
3. **An toàn Khóa API & Dữ liệu**: Khóa `GEMINI_API_KEY` được tiêm qua biến môi trường hoặc lưu cục bộ trình duyệt, tuyệt đối không hard-code trong Git; dữ liệu sinh viên tuân thủ Nghị định 13/2023/NĐ-CP.
