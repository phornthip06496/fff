-- =====================================================
-- TechHub: ฐานข้อมูลสำเร็จรูปสำหรับ Supabase
-- วิธีใช้: Supabase Dashboard > SQL Editor > New query > วางทั้งไฟล์ > Run
-- =====================================================

-- 1) ตารางโปรไฟล์ผู้ใช้ (ผูกกับ auth.users ของ Supabase)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null
              check (char_length(username) between 3 and 20 and username ~ '^[a-zA-Z0-9_]+$'),
  full_name   text,
  interest    text not null default 'programming'
              check (interest in ('hardware','programming','network','security','ai')),
  created_at  timestamptz not null default now()
);

-- 2) ตารางบทความ/ความรู้ด้านคอมพิวเตอร์
create table if not exists public.articles (
  id          bigint generated always as identity primary key,
  title       text not null,
  summary     text not null,
  category    text not null
              check (category in ('hardware','programming','network','security','ai')),
  level       text not null default 'beginner'
              check (level in ('beginner','intermediate','advanced')),
  created_at  timestamptz not null default now()
);

-- 3) เปิด Row Level Security
alter table public.profiles enable row level security;
alter table public.articles enable row level security;

-- ผู้ใช้อ่าน/แก้ไขได้เฉพาะโปรไฟล์ของตัวเอง
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- เฉพาะผู้ที่ล็อกอินแล้วเท่านั้นที่อ่านบทความได้
drop policy if exists "articles_select_authenticated" on public.articles;
create policy "articles_select_authenticated" on public.articles
  for select to authenticated using (true);

-- 4) สร้างโปรไฟล์อัตโนมัติเมื่อมีคนสมัคร
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, full_name, interest)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)),
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'interest', 'programming')
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5) ฟังก์ชันตรวจว่า username ว่างไหม (เรียกได้ก่อนสมัคร)
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(p_username)
  );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- 6) ข้อมูลตัวอย่าง
insert into public.articles (title, summary, category, level) values
('เลือก CPU ให้เหมาะกับงาน', 'เปรียบเทียบจำนวนคอร์ ความเร็ว และแคช เพื่อเลือกซีพียูสำหรับเล่นเกม ตัดต่อวิดีโอ หรือเขียนโปรแกรม', 'hardware', 'beginner'),
('RAM และ SSD ส่งผลต่อความเร็วเครื่องอย่างไร', 'อธิบายหน้าที่ของหน่วยความจำและที่เก็บข้อมูล พร้อมวิธีตรวจว่าคอขวดอยู่ตรงไหน', 'hardware', 'beginner'),
('เริ่มต้นเขียน Python ใน 1 ชั่วโมง', 'ตัวแปร เงื่อนไข ลูป และฟังก์ชัน พร้อมโจทย์ฝึกสั้น ๆ ท้ายบท', 'programming', 'beginner'),
('Git และ GitHub สำหรับมือใหม่', 'commit, branch, merge และการ push โค้ดขึ้น GitHub ทีละขั้นตอน', 'programming', 'beginner'),
('การออกแบบ REST API ที่ดี', 'หลักการตั้งชื่อ endpoint, status code และการจัดการข้อผิดพลาด', 'programming', 'intermediate'),
('IP Address, Subnet และ DNS พื้นฐาน', 'เข้าใจว่าอุปกรณ์คุยกันในเครือข่ายอย่างไร และตั้งค่า subnet mask ให้ถูกต้อง', 'network', 'beginner'),
('ตั้งค่า Wi-Fi ที่บ้านให้เร็วและปลอดภัย', 'เลือกช่องสัญญาณ ตำแหน่งวางเราเตอร์ และเปิด WPA3', 'network', 'beginner'),
('รหัสผ่านและ 2FA ที่ควรใช้', 'สร้างรหัสผ่านที่แข็งแรง ใช้ตัวจัดการรหัสผ่าน และเปิดการยืนยันตัวตนสองชั้น', 'security', 'beginner'),
('รู้ทันฟิชชิงและมัลแวร์', 'สังเกตลิงก์และอีเมลหลอกลวง พร้อมขั้นตอนรับมือเมื่อเผลอกดไปแล้ว', 'security', 'beginner'),
('Machine Learning คืออะไร', 'แนวคิดของโมเดล ข้อมูลฝึก และการประเมินผล อธิบายด้วยตัวอย่างในชีวิตจริง', 'ai', 'beginner'),
('ใช้ AI ช่วยเขียนและตรวจโค้ดอย่างมีประสิทธิภาพ', 'เขียน prompt ให้ชัด ตรวจผลลัพธ์ และข้อควรระวังเรื่องข้อมูลที่ส่งเข้าไป', 'ai', 'intermediate');
