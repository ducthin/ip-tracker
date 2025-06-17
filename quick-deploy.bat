@echo off
echo 🚀 DEPLOY WIZARD - Chon noi ban muon deploy:
echo.
echo 1. Render.com (Mien phi - Khuyen nghị)
echo 2. Railway.app (Nhanh nhat)
echo 3. Heroku (Co dinh)
echo 4. Vercel (Chi danh cho frontend)
echo 5. Exit
echo.
set /p choice="Nhap lua chon cua ban (1-5): "

if "%choice%"=="1" goto render
if "%choice%"=="2" goto railway
if "%choice%"=="3" goto heroku
if "%choice%"=="4" goto vercel
if "%choice%"=="5" exit
goto end

:render
echo.
echo 🎯 DEPLOY VIEN RENDER.COM:
echo.
echo Buoc 1: Push code len GitHub
echo 1. Tao repo moi tren GitHub: https://github.com/new
echo 2. Copy URL repo (vd: https://github.com/yourusername/ip-tracker.git)
echo.
set /p github_url="Nhap URL GitHub repo: "
if not "%github_url%"=="" (
    git reset HEAD . >nul 2>&1
    git add . >nul 2>&1
    git commit -m "Deploy to Render.com" >nul 2>&1
    git branch -M main >nul 2>&1
    git remote add origin %github_url% >nul 2>&1
    git push -u origin main
    echo ✅ Code da duoc push len GitHub!
)
echo.
echo Buoc 2: Deploy tren Render
echo 1. Mo https://render.com va dang ky/dang nhap
echo 2. Click "New +" → "Web Service"
echo 3. Connect GitHub account va chon repo vua tao
echo 4. Cau hinh:
echo    - Name: ip-tracker
echo    - Environment: Node
echo    - Build Command: npm install
echo    - Start Command: npm start
echo    - Instance Type: Free
echo 5. Click "Create Web Service"
echo 6. Doi 3-5 phut de deploy xong!
echo.
echo 🎉 Deploy hoan tat! URL cua ban: https://ip-tracker-xxx.onrender.com
pause
goto end

:railway
echo.
echo 🚄 DEPLOY VIEN RAILWAY.APP:
echo.
echo Buoc 1: Push code len GitHub (neu chua lam)
set /p github_done="Ban da push code len GitHub chua? (y/n): "
if /i "%github_done%"=="n" (
    set /p github_url="Nhap URL GitHub repo: "
    if not "%github_url%"=="" (
        git reset HEAD . >nul 2>&1
        git add . >nul 2>&1
        git commit -m "Deploy to Railway" >nul 2>&1
        git branch -M main >nul 2>&1
        git remote add origin %github_url% >nul 2>&1
        git push -u origin main
        echo ✅ Code da duoc push len GitHub!
    )
)
echo.
echo Buoc 2: Deploy tren Railway
echo 1. Mo https://railway.app va dang ky bang GitHub
echo 2. Click "Deploy from GitHub repo"
echo 3. Chon repo ip-tracker
echo 4. Railway tu dong detect Node.js va deploy!
echo 5. Doi 2-3 phut la xong!
echo.
echo 🎉 Deploy hoan tat! URL cua ban: https://yourapp.up.railway.app
pause
goto end

:heroku
echo.
echo 🟣 DEPLOY VIEN HEROKU:
echo.
echo Buoc 1: Cai dat Heroku CLI
echo Download tai: https://devcenter.heroku.com/articles/heroku-cli
echo.
echo Buoc 2: Deploy
echo Sau khi cai dat CLI, chay cac lenh sau:
echo.
echo heroku login
echo heroku create ip-tracker-yourname
echo git add .
echo git commit -m "Deploy to Heroku"
echo git push heroku main
echo.
echo 🎉 Deploy hoan tat! URL cua ban: https://ip-tracker-yourname.herokuapp.com
pause
goto end

:vercel
echo.
echo ⚡ VERCEL chi ho tro frontend. 
echo Ban nen dung Render hoac Railway cho Node.js app!
pause
goto end

:end
echo.
echo 📋 SO SANH CAC NEN TANG:
echo.
echo RENDER.COM:
echo ✅ Mien phi 750h/thang
echo ✅ Tu dong deploy tu GitHub  
echo ✅ SSL mien phi
echo ❌ Sleep sau 15 phut khong dung
echo.
echo RAILWAY.APP:
echo ✅ Deploy cuc nhanh (1-2 phut)
echo ✅ Khong sleep
echo ✅ Tu dong detect framework
echo ❌ Co han che credit mien phi
echo.
echo HEROKU:
echo ✅ On dinh, tin cay
echo ✅ Nhieu addon
echo ❌ Can credit card (ngay ca free)
echo ❌ Sleep sau 30 phut
echo.
echo 💡 KHUYEN NGHỊ: Render.com cho du an ca nhan, Railway cho demo nhanh!
echo.
pause
