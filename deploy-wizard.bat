@echo off
echo 🚀 So sánh các platform deploy
echo ===============================

echo.
echo 🏆 Top 3 Platform Deploy Nhanh Nhất:
echo.

echo 🥇 1. RAILWAY.APP - Siêu Nhanh (Khuyến nghị #1)
echo    ⚡ Deploy: 2 phút
echo    💰 Giá: $5 credit miễn phí/tháng  
echo    🔧 Setup: Không cần config
echo    🌐 Domain: xxx.up.railway.app
echo    📊 Monitoring: Dashboard đẹp
echo    👉 Chạy: deploy-railway.bat
echo.

echo 🥈 2. RENDER.COM - Miễn Phí Hoàn Toàn
echo    ⚡ Deploy: 5 phút
echo    💰 Giá: Miễn phí vĩnh viễn
echo    🔧 Setup: Cần config nhẹ
echo    🌐 Domain: xxx.onrender.com
echo    📊 Monitoring: Logs cơ bản
echo    👉 Chạy: deploy-render.bat
echo.

echo 🥉 3. HEROKU - Phổ Biến Nhất
echo    ⚡ Deploy: 10 phút
echo    💰 Giá: $7/tháng (có free tier hạn chế)
echo    🔧 Setup: Cần CLI
echo    🌐 Domain: xxx.herokuapp.com
echo    📊 Monitoring: Tốt nhất
echo    👉 Cài Heroku CLI + commands
echo.

echo.
echo 💡 Khuyến nghị:
echo.
echo 🎯 Nếu muốn NHANH NHẤT: Railway.app (2 phút)
echo 🎯 Nếu muốn MIỄN PHÍ: Render.com (5 phút)  
echo 🎯 Nếu muốn CHUYÊN NGHIỆP: Heroku (10 phút)
echo.

echo 🚀 Chọn platform bạn muốn:
echo [1] Railway.app - Siêu nhanh
echo [2] Render.com - Miễn phí
echo [3] Heroku - Chuyên nghiệp
echo [4] Hướng dẫn VPS (nâng cao)
echo.

set /p choice="Nhập lựa chọn (1-4): "

if "%choice%"=="1" (
    start deploy-railway.bat
) else if "%choice%"=="2" (
    start deploy-render.bat
) else if "%choice%"=="3" (
    echo.
    echo 🔧 Heroku Deploy Instructions:
    echo.
    echo 1. Install Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli
    echo 2. Chạy commands:
    echo    heroku login
    echo    heroku create ip-tracker-yourname
    echo    git push heroku main
    echo 3. Xong!
    echo.
    start https://devcenter.heroku.com/articles/heroku-cli
) else if "%choice%"=="4" (
    echo.
    echo 🖥️ VPS Deployment (Nâng cao):
    echo.
    echo - Mua VPS: DigitalOcean, Vultr ($5/tháng)
    echo - Setup: Ubuntu + Node.js + Nginx + PM2
    echo - Domain: Point A record to VPS IP
    echo - SSL: Certbot Let's Encrypt
    echo - Advantage: Full control, custom domain
    echo.
    echo 📚 Cần hướng dẫn chi tiết VPS không? (y/n)
    set /p vps_guide=""
    if /i "%vps_guide%"=="y" (
        echo Sẽ tạo hướng dẫn VPS chi tiết...
    )
) else (
    echo Lựa chọn không hợp lệ!
)

echo.
pause
