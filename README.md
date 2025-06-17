# 🎯 IP Location Tracker

Web app để tạo link tracking và theo dõi vị trí người dùng.

## 🚀 Deploy Nhanh - 5 Phút Xong!

### 🥇 Option 1: Render.com (Miễn phí - Khuyến nghị)

**Bước 1:** Push code lên GitHub
```bash
git init
git add .
git commit -m "IP Tracker ready for deploy"
git branch -M main
git remote add origin https://github.com/yourusername/ip-tracker.git
git push -u origin main
```

**Bước 2:** Deploy trên Render
1. Vào https://render.com → Sign up/Login
2. Click "New +" → "Web Service" 
3. Connect GitHub → Select repo `ip-tracker`
4. Cấu hình:
   - **Name:** `ip-tracker`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. Click "Create Web Service"
6. Đợi 3-5 phút → Xong!

**Kết quả:** `https://ip-tracker-xxx.onrender.com`

### 🥈 Option 2: Railway.app (Siêu nhanh)

1. Vào https://railway.app
2. "Deploy from GitHub" → Connect repo
3. Chọn repo → Click "Deploy"
4. Xong trong 2 phút!

**Kết quả:** `https://yourapp.up.railway.app`

### 🥉 Option 3: Heroku (Cổ điển)

```bash
# Install Heroku CLI
npm install -g heroku

# Login và deploy
heroku login
heroku create ip-tracker-yourname
git push heroku main
```

## ✨ Tính năng sau khi deploy

- 🔗 **Link ngắn uy tín:** `yoursite.com/deal-hot`
- 📍 **IP tracking thật:** Lấy được vị trí chính xác
- 🗺️ **Bản đồ tương tác:** Hiển thị visits
- � **Bảo mật:** Mật khẩu + hết hạn
- 📱 **QR Code:** Tự động generate
- 👁️ **Ẩn danh:** Tắt preview để redirect trực tiếp

## 🎯 Demo Link

Sau deploy thành công:
```
https://yourapp.onrender.com → Dashboard
https://yourapp.onrender.com/black-friday → Link tracking
https://yourapp.onrender.com/details/abc123 → Analytics
```

## 💡 Tips Deploy Thành Công

1. **Đảm bảo PORT dynamic:**
   ```js
   const PORT = process.env.PORT || 3000;
   ```

2. **Package.json có start script:**
   ```json
   "scripts": {
     "start": "node server.js"
   }
   ```

3. **Dependencies đầy đủ:**
   - Tất cả đã có sẵn ✅

## 🚀 Kết quả cuối cùng

Sau 5 phút deploy, bạn sẽ có:

✅ **Website hoạt động 24/7**  
✅ **HTTPS tự động**  
✅ **IP tracking thật 100%**  
✅ **Link siêu uy tín**  
✅ **Custom domain** (nếu muốn)  
✅ **Không cần VPS phức tạp**

🎉 **Thế là xong! Link tracking chuyên nghiệp trong 5 phút!**
