-- =====================================================
-- TechHub Admin: เพิ่มระบบแอดมิน (รันต่อจาก schema.sql)
-- =====================================================

-- ตารางรายชื่อแอดมิน: เปิด RLS และไม่มี policy = เบราว์เซอร์เข้าถึงตรง ๆ ไม่ได้
-- แก้ไขได้เฉพาะผ่าน SQL Editor ของเจ้าของโปรเจกต์
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- แอดมินอ่านโปรไฟล์ทุกคนได้
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select to authenticated using (public.is_admin());

-- สรุปยอดผู้สมัคร
create or replace function public.admin_overview()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total',     (select count(*) from public.profiles),
    'today',     (select count(*) from public.profiles
                   where created_at >= date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok'),
    'last7',     (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'last30',    (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
    'confirmed', (select count(*) from auth.users where email_confirmed_at is not null),
    'by_interest', (select coalesce(jsonb_object_agg(t.interest, t.c), '{}'::jsonb)
                    from (select interest, count(*) c from public.profiles group by interest) t),
    'by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', t.d, 'count', t.c) order by t.d), '[]'::jsonb)
               from (select g::date d,
                            (select count(*) from public.profiles p
                              where (p.created_at at time zone 'Asia/Bangkok')::date = g::date) c
                     from generate_series((now() at time zone 'Asia/Bangkok')::date - 13,
                                          (now() at time zone 'Asia/Bangkok')::date,
                                          interval '1 day') g) t)
  );
end;
$$;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

-- รายชื่อผู้สมัครแบบละเอียด (รวมอีเมลและเวลาล็อกอินล่าสุด)
create or replace function public.admin_list_users(
  p_search text default null,
  p_limit  int  default 100,
  p_offset int  default 0
)
returns table (
  id uuid, username text, full_name text, email text, interest text,
  created_at timestamptz, last_sign_in_at timestamptz, confirmed boolean
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select p.id, p.username, p.full_name, u.email::text, p.interest,
           p.created_at, u.last_sign_in_at, (u.email_confirmed_at is not null)
    from public.profiles p
    join auth.users u on u.id = p.id
    where coalesce(p_search, '') = ''
       or p.username  ilike '%' || p_search || '%'
       or p.full_name ilike '%' || p_search || '%'
       or u.email     ilike '%' || p_search || '%'
    order by p.created_at desc
    limit least(greatest(p_limit, 1), 500)
    offset greatest(p_offset, 0);
end;
$$;
revoke all on function public.admin_list_users(text, int, int) from public, anon;
grant execute on function public.admin_list_users(text, int, int) to authenticated;

-- ตั้งแอดมิน: สมัครสมาชิกผ่านหน้าเว็บก่อน แล้วแก้อีเมลด้านล่างและรันทีละบรรทัดนี้
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'อีเมลของคุณ@example.com';
