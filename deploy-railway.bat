@echo off
echo 🚀 Deploy siêu nhanh lên Railway.app
echo ====================================

echo.
echo Railway.app là platform deploy nhanh nhất!
echo Chỉ cần 2 phút là xong!
echo.

echo 📋 Chuẩn bị code...

REM Add files
git add . 2>nul
git commit -m "Ready for Railway deployment" 2>nul

echo.
echo 🚂 Hướng dẫn deploy Railway:
echo.
echo 1. Mở: https://railway.app
echo 2. Click "Login" → Chọn GitHub
echo 3. Click "Deploy from GitHub"
echo 4. Chọn repo "ip-tracker"
echo 5. Click "Deploy Now"
echo 6. Đợi 2 phút → Xong!
echo.
echo 🎯 Railway sẽ tự động:
echo    ✅ Detect Node.js
echo    ✅ Chạy npm install
echo    ✅ Start app với npm start
echo    ✅ Tạo HTTPS domain
echo.
echo 💡 Ưu điểm Railway:
echo    ⚡ Deploy nhanh nhất
echo    💰 $5 credit miễn phí/tháng
echo    🔧 Không cần config gì
echo.

start https://railway.app

echo Nhấn Enter sau khi deploy xong để xem hướng dẫn tiếp theo...
pause

echo.
echo 🎉 Chúc mừng! App đã deploy thành công!
echo.
echo 🔧 Các bước tiếp theo:
echo.
echo 1. Copy URL từ Railway dashboard
echo 2. Test app: Tạo link tracking đầu tiên
echo 3. Share link và kiểm tra IP tracking
echo 4. Tùy chỉnh domain (nếu muốn)
echo.
echo 📊 Monitoring:
echo - Railway dashboard: Logs, metrics
echo - Domain settings: Custom domain
echo.

pause
