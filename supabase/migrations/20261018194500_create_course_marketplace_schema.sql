-- Course marketplace core schema.
-- Payment confirmation and enrollment creation must happen from a trusted server-side webhook.
begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.instructor_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  bio text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  subtitle text not null default '' check (char_length(subtitle) <= 240),
  description text not null default '',
  category text not null default 'Geral',
  level text not null default 'Iniciante' check (level in ('Iniciante', 'Intermediário', 'Avançado', 'Todos os níveis')),
  language text not null default 'pt-BR',
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  thumbnail_url text,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists courses_status_category_idx on public.courses(status, category);
create index if not exists courses_instructor_idx on public.courses(instructor_id);

create table if not exists public.course_sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (course_id, position)
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.course_sections(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  description text not null default '',
  position integer not null default 0 check (position >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  video_storage_path text,
  material_url text,
  is_preview boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, position)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  total_cents integer not null check (total_cents >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  payment_provider text,
  provider_reference text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_buyer_created_idx on public.orders(buyer_id, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict,
  price_cents integer not null check (price_cents >= 0),
  created_at timestamptz not null default now(),
  unique (order_id, course_id)
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  order_item_id uuid unique references public.order_items(id) on delete set null,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (student_id, course_id)
);

create index if not exists enrollments_student_idx on public.enrollments(student_id);
create index if not exists enrollments_course_idx on public.enrollments(course_id);

create table if not exists public.lesson_progress (
  student_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (student_id, lesson_id)
);

create table if not exists public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  review text not null default '' check (char_length(review) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, student_id)
);

create index if not exists course_reviews_course_idx on public.course_reviews(course_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user();

do $$
declare
  table_name text;
begin
  foreach table_name in array array['profiles','instructor_profiles','courses','lessons','orders','course_reviews'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end;
$$;

alter table public.profiles enable row level security;
alter table public.instructor_profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_sections enable row level security;
alter table public.lessons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.course_reviews enable row level security;

-- Profiles: users may read and update only their own public profile.
drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self" on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Instructor applications are private to the applicant. Approval is an admin/server operation.
drop policy if exists "instructor_profile_select_self" on public.instructor_profiles;
create policy "instructor_profile_select_self" on public.instructor_profiles for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "instructor_profile_apply_self" on public.instructor_profiles;
create policy "instructor_profile_apply_self" on public.instructor_profiles for insert to authenticated with check (user_id = (select auth.uid()) and status = 'pending');
drop policy if exists "instructor_profile_update_self_pending" on public.instructor_profiles;
create policy "instructor_profile_update_self_pending" on public.instructor_profiles for update to authenticated using (user_id = (select auth.uid()) and status = 'pending') with check (user_id = (select auth.uid()) and status = 'pending');

-- Published courses are public; creators can see and edit their own drafts.
drop policy if exists "courses_select_published_or_owner" on public.courses;
create policy "courses_select_published_or_owner" on public.courses for select to anon, authenticated using (status = 'published' or instructor_id = (select auth.uid()));
drop policy if exists "courses_insert_approved_instructor" on public.courses;
create policy "courses_insert_approved_instructor" on public.courses for insert to authenticated with check (
  instructor_id = (select auth.uid())
  and exists (select 1 from public.instructor_profiles ip where ip.user_id = (select auth.uid()) and ip.status = 'approved')
  and status in ('draft', 'review')
);
drop policy if exists "courses_update_owner" on public.courses;
create policy "courses_update_owner" on public.courses for update to authenticated using (instructor_id = (select auth.uid())) with check (
  instructor_id = (select auth.uid())
  and status in ('draft', 'review', 'archived', 'published')
  and exists (select 1 from public.instructor_profiles ip where ip.user_id = (select auth.uid()) and ip.status = 'approved')
);
drop policy if exists "courses_delete_owner_draft" on public.courses;
create policy "courses_delete_owner_draft" on public.courses for delete to authenticated using (instructor_id = (select auth.uid()) and status = 'draft');

-- Course structure may be listed for published courses, but lesson assets remain enrollment-gated below.
drop policy if exists "sections_select_published_or_owner" on public.course_sections;
create policy "sections_select_published_or_owner" on public.course_sections for select to anon, authenticated using (
  exists (select 1 from public.courses c where c.id = course_id and (c.status = 'published' or c.instructor_id = (select auth.uid())))
);
drop policy if exists "sections_manage_owner" on public.course_sections;
create policy "sections_manage_owner" on public.course_sections for all to authenticated using (
  exists (select 1 from public.courses c where c.id = course_id and c.instructor_id = (select auth.uid()))
) with check (
  exists (select 1 from public.courses c where c.id = course_id and c.instructor_id = (select auth.uid()))
);

drop policy if exists "lessons_select_preview_or_enrolled_or_owner" on public.lessons;
create policy "lessons_select_preview_or_enrolled_or_owner" on public.lessons for select to anon, authenticated using (
  is_preview
  and exists (select 1 from public.course_sections s join public.courses c on c.id = s.course_id where s.id = section_id and c.status = 'published')
  or exists (
    select 1 from public.course_sections s join public.courses c on c.id = s.course_id
    where s.id = section_id and (
      c.instructor_id = (select auth.uid())
      or exists (select 1 from public.enrollments e where e.course_id = c.id and e.student_id = (select auth.uid()))
    )
  )
);
drop policy if exists "lessons_manage_owner" on public.lessons;
create policy "lessons_manage_owner" on public.lessons for all to authenticated using (
  exists (select 1 from public.course_sections s join public.courses c on c.id = s.course_id where s.id = section_id and c.instructor_id = (select auth.uid()))
) with check (
  exists (select 1 from public.course_sections s join public.courses c on c.id = s.course_id where s.id = section_id and c.instructor_id = (select auth.uid()))
);

-- Orders are read-only to the buyer. Create/update them only through a trusted backend/webhook.
drop policy if exists "orders_select_buyer" on public.orders;
create policy "orders_select_buyer" on public.orders for select to authenticated using (buyer_id = (select auth.uid()));
drop policy if exists "order_items_select_buyer" on public.order_items;
create policy "order_items_select_buyer" on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = (select auth.uid()))
);

-- Enrollment creation is reserved for a trusted payment webhook (service role bypasses RLS).
drop policy if exists "enrollments_select_student_or_instructor" on public.enrollments;
create policy "enrollments_select_student_or_instructor" on public.enrollments for select to authenticated using (
  student_id = (select auth.uid())
  or exists (select 1 from public.courses c where c.id = course_id and c.instructor_id = (select auth.uid()))
);
drop policy if exists "lesson_progress_select_self" on public.lesson_progress;
create policy "lesson_progress_select_self" on public.lesson_progress for select to authenticated using (student_id = (select auth.uid()));
drop policy if exists "lesson_progress_insert_self_enrolled" on public.lesson_progress;
create policy "lesson_progress_insert_self_enrolled" on public.lesson_progress for insert to authenticated with check (
  student_id = (select auth.uid())
  and exists (
    select 1 from public.lessons l
    join public.course_sections s on s.id = l.section_id
    join public.enrollments e on e.course_id = s.course_id
    where l.id = lesson_id and e.student_id = (select auth.uid())
  )
);
drop policy if exists "lesson_progress_delete_self" on public.lesson_progress;
create policy "lesson_progress_delete_self" on public.lesson_progress for delete to authenticated using (student_id = (select auth.uid()));

-- Only enrolled students can publish reviews; public can read reviews for published courses.
drop policy if exists "reviews_select_published_course" on public.course_reviews;
create policy "reviews_select_published_course" on public.course_reviews for select to anon, authenticated using (
  exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')
);
drop policy if exists "reviews_insert_enrolled_student" on public.course_reviews;
create policy "reviews_insert_enrolled_student" on public.course_reviews for insert to authenticated with check (
  student_id = (select auth.uid())
  and exists (select 1 from public.enrollments e where e.course_id = course_id and e.student_id = (select auth.uid()))
);
drop policy if exists "reviews_update_self" on public.course_reviews;
create policy "reviews_update_self" on public.course_reviews for update to authenticated using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));
drop policy if exists "reviews_delete_self" on public.course_reviews;
create policy "reviews_delete_self" on public.course_reviews for delete to authenticated using (student_id = (select auth.uid()));

grant select on public.courses, public.course_sections, public.lessons, public.course_reviews to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.instructor_profiles to authenticated;
grant insert, update, delete on public.courses, public.course_sections, public.lessons to authenticated;
grant select on public.orders, public.order_items, public.enrollments to authenticated;
grant select, insert, delete on public.lesson_progress to authenticated;
grant insert, update, delete on public.course_reviews to authenticated;


-- Private course media: uploads are restricted to approved instructors.
-- Store objects as <course_uuid>/<section_uuid>/<filename>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-media',
  'course-media',
  false,
  1073741824,
  array['video/mp4', 'video/webm', 'application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public thumbnails are separate from protected course content.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-thumbnails',
  'course-thumbnails',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "course_media_select_enrolled_or_owner" on storage.objects;
create policy "course_media_select_enrolled_or_owner"
on storage.objects for select to authenticated
using (
  bucket_id = 'course-media'
  and exists (
    select 1
    from public.courses c
    where c.id::text = split_part(name, '/', 1)
      and (
        c.instructor_id = (select auth.uid())
        or exists (
          select 1 from public.enrollments e
          where e.course_id = c.id and e.student_id = (select auth.uid())
        )
      )
  )
);

drop policy if exists "course_media_insert_approved_owner" on storage.objects;
create policy "course_media_insert_approved_owner"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'course-media'
  and exists (
    select 1
    from public.courses c
    join public.instructor_profiles ip on ip.user_id = c.instructor_id
    where c.id::text = split_part(name, '/', 1)
      and c.instructor_id = (select auth.uid())
      and ip.status = 'approved'
      and c.status in ('draft', 'review', 'published')
  )
);

drop policy if exists "course_media_update_owner" on storage.objects;
create policy "course_media_update_owner"
on storage.objects for update to authenticated
using (
  bucket_id = 'course-media'
  and exists (
    select 1 from public.courses c
    where c.id::text = split_part(name, '/', 1)
      and c.instructor_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'course-media'
  and exists (
    select 1 from public.courses c
    where c.id::text = split_part(name, '/', 1)
      and c.instructor_id = (select auth.uid())
  )
);

drop policy if exists "course_media_delete_owner" on storage.objects;
create policy "course_media_delete_owner"
on storage.objects for delete to authenticated
using (
  bucket_id = 'course-media'
  and exists (
    select 1 from public.courses c
    where c.id::text = split_part(name, '/', 1)
      and c.instructor_id = (select auth.uid())
  )
);

drop policy if exists "course_thumbnails_public_read" on storage.objects;
create policy "course_thumbnails_public_read"
on storage.objects for select to anon, authenticated
using (bucket_id = 'course-thumbnails');

drop policy if exists "course_thumbnails_insert_approved_instructor" on storage.objects;
create policy "course_thumbnails_insert_approved_instructor"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'course-thumbnails'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and exists (
    select 1 from public.instructor_profiles ip
    where ip.user_id = (select auth.uid()) and ip.status = 'approved'
  )
);

drop policy if exists "course_thumbnails_update_owner" on storage.objects;
create policy "course_thumbnails_update_owner"
on storage.objects for update to authenticated
using (
  bucket_id = 'course-thumbnails'
  and split_part(name, '/', 1) = (select auth.uid())::text
)
with check (
  bucket_id = 'course-thumbnails'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

drop policy if exists "course_thumbnails_delete_owner" on storage.objects;
create policy "course_thumbnails_delete_owner"
on storage.objects for delete to authenticated
using (
  bucket_id = 'course-thumbnails'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

commit;
