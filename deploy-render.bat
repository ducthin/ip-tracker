@echo off
echo 🚀 Deploy nhanh IP Tracker lên Render.com
echo ==========================================

echo.
echo 📋 Checklist trước khi deploy:
echo [1] Đã tạo GitHub account
echo [2] Đã cài Git trên máy
echo [3] Code đã sẵn sàng
echo.

set /p ready="Bạn đã sẵn sàng? (y/n): "
if /i "%ready%" neq "y" (
    echo Hãy chuẩn bị đầy đủ rồi chạy lại script này!
    pause
    exit /b
)

echo.
echo 📂 Chuẩn bị Git repository...

REM Initialize git if not exists
if not exist ".git" (
    git init
    git branch -M main
)

REM Add all files
git add .

REM Commit
set /p commit_msg="Nhập commit message (Enter để dùng mặc định): "
if "%commit_msg%"=="" set commit_msg=Ready for deployment

git commit -m "%commit_msg%"

echo.
echo 📤 Đang push lên GitHub...
echo.
echo 🔧 Bạn cần làm theo các bước sau:
echo.
echo 1. Tạo repo mới trên GitHub: https://github.com/new
echo 2. Đặt tên repo: ip-tracker
echo 3. Copy URL repo (vd: https://github.com/username/ip-tracker.git)
echo.

set /p repo_url="Nhập GitHub repo URL: "

REM Add remote origin
git remote remove origin 2>nul
git remote add origin %repo_url%

REM Push to GitHub
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ✅ Code đã được push lên GitHub thành công!
    echo.
    echo 🌐 Bước tiếp theo - Deploy trên Render:
    echo.
    echo 1. Mở: https://render.com
    echo 2. Sign Up/Login bằng GitHub
    echo 3. Click "New +" → "Web Service"
    echo 4. Connect GitHub → Chọn repo "ip-tracker"
    echo 5. Cấu hình:
    echo    - Name: ip-tracker
    echo    - Environment: Node
    echo    - Build Command: npm install
    echo    - Start Command: npm start
    echo    - Instance Type: Free
    echo 6. Click "Create Web Service"
    echo 7. Đợi 3-5 phút → Xong!
    echo.
    echo 🎯 Kết quả: https://ip-tracker-xxx.onrender.com
    echo.
    start https://render.com
) else (
    echo.
    echo ❌ Có lỗi khi push lên GitHub
    echo Kiểm tra lại URL repo và thử lại
)

echo.
pause
