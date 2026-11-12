# TechHub – สมัครสมาชิก / เข้าสู่ระบบ ด้วย Supabase

เว็บสถิตย์ (HTML + JavaScript) ที่มีหน้าสมัครสมาชิก เข้าสู่ระบบ และหน้าบทความด้านคอมพิวเตอร์ที่ต้องล็อกอินก่อนจึงจะเห็น

## โครงสร้าง
```
index.html        หน้าแรก
register.html     สมัครสมาชิก
login.html        เข้าสู่ระบบ / ลืมรหัสผ่าน
dashboard.html    หน้าบทความ (ต้องล็อกอิน)
css/style.css
js/config.js      ใส่ URL และ anon key ของ Supabase
js/app.js         ตรรกะทั้งหมด
supabase/schema.sql  ตาราง + RLS + trigger + ข้อมูลตัวอย่าง
```

## ติดตั้ง
> ไฟล์ชุดนี้ตั้งค่า `js/config.js` ชี้ไปที่โปรเจกต์ Supabase และรัน schema เรียบร้อยแล้ว เหลือแค่ข้อ 4–5 (ตั้ง Redirect URLs) แล้วใช้งานได้เลย

1. สร้างโปรเจกต์ที่ https://supabase.com
2. เปิด **SQL Editor** → วางเนื้อหา `supabase/schema.sql` → **Run**
3. เปิด **Project Settings → API** คัดลอก *Project URL* และ *anon/publishable key* ไปใส่ใน `js/config.js`
4. เปิด **Authentication → URL Configuration** ตั้ง *Site URL* เป็นที่อยู่เว็บของคุณ และเพิ่มใน *Redirect URLs*
   - ทดสอบในเครื่อง: `http://localhost:5500`
   - GitHub Pages: `https://USERNAME.github.io/REPO/`
5. (ทางเลือก) **Authentication → Providers → Email** ปิด *Confirm email* ถ้าต้องการให้สมัครแล้วเข้าได้ทันทีระหว่างพัฒนา

## หน้าแอดมิน (admin.html)
แสดงยอดผู้สมัคร (วันนี้ / 7 / 30 วัน / ทั้งหมด) กราฟรายวัน สัดส่วนตามหมวด รายชื่อละเอียด ค้นหา และดาวน์โหลด CSV
1. รัน `supabase/admin.sql` ใน SQL Editor (ถ้ายังไม่ได้รัน)
2. สมัครสมาชิกผ่านหน้าเว็บด้วยอีเมลของคุณก่อน
3. ตั้งเป็นแอดมินใน SQL Editor:
```sql
insert into public.admins (user_id)
select id from auth.users where email = 'อีเมลของคุณ@example.com';
```
ปุ่ม “หลังบ้าน” จะโผล่ในหน้าบทความเฉพาะแอดมิน สิทธิ์ตรวจที่ฐานข้อมูล คนทั่วไปเรียก `admin_*` ไม่ได้แม้รู้ URL

## รันในเครื่อง
ต้องเปิดผ่านเซิร์ฟเวอร์ ห้ามดับเบิลคลิกไฟล์ (ES module ไม่ทำงานบน file://)
```bash
python3 -m http.server 5500
# แล้วเปิด http://localhost:5500
```

## ขึ้น GitHub + GitHub Pages
```bash
git init
git add .
git commit -m "Initial commit: TechHub with Supabase auth"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```
จากนั้นที่ repo → **Settings → Pages → Source: Deploy from a branch → main / (root)**

## ความปลอดภัย
- `anon key` เปิดเผยในโค้ดฝั่งเบราว์เซอร์ได้ เพราะข้อมูลถูกป้องกันด้วย Row Level Security
- **ห้าม** commit `service_role key` ขึ้น GitHub
- ผู้ใช้อ่านและแก้ไขได้เฉพาะโปรไฟล์ของตัวเอง และบทความอ่านได้เฉพาะผู้ล็อกอิน
