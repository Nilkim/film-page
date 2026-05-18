-- FilmPage 커뮤니티 게시글 schema.
--
-- 사용 방법: 이 SQL을 Supabase 대시보드 → SQL Editor에서 실행.
-- 같은 Supabase 프로젝트(FilmCutting)에 추가됨. 다른 커뮤니티 인스턴스
-- (예: wood_page)가 향후 같은 프로젝트에 들어와도 prefix가 다르므로
-- 테이블 충돌 없음.
--
-- 권한 모델:
--   - 조회(SELECT): 모두 가능 (anon 포함). 비로그인도 게시글 읽기 OK.
--   - 작성(INSERT): authenticated만. user_id는 본인 것만 허용.
--   - 수정(UPDATE)/삭제(DELETE): 본인 글만.

-- =========== 1. 게시글 본문 ===========
create table if not exists public.film_page_posts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null check (char_length(title) between 1 and 200),
    body text not null check (char_length(body) <= 10000),
    image_urls jsonb default '[]'::jsonb,
    -- 대표 이미지(썸네일) URL. Supabase Storage 'film-page-covers' 버킷에서.
    cover_image text,
    -- 단일 FilmCutting 주문번호 (legacy). 패키지 도입 후 사용 안 함 — nullable.
    order_code text,
    -- 주문 패키지 코드 (PKG-XXXXXXXX). film_page_order_packages 테이블 참조.
    package_code text not null,
    -- 게시글 종류: 'text' = 직접 작성, 'link' = 외부 URL 공유
    post_type text not null default 'text',
    -- 외부 URL 게시글일 때 사용. 인플루언서가 본인 블로그/유튜브/인스타 링크 공유.
    external_url text,
    -- 'youtube' | 'instagram' | 'blog' — 임베드 분기 + 카드 뱃지 표시.
    source_platform text,
    -- 외부 페이지의 OpenGraph 메타 캐시 (작성 시점에 fetch해서 저장).
    og_title text,
    og_description text,
    og_image text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 기존 테이블에 컬럼 추가 (멱등). 운영 중 재실행해도 안전.
alter table public.film_page_posts
    add column if not exists post_type text not null default 'text',
    add column if not exists external_url text,
    add column if not exists source_platform text,
    add column if not exists og_title text,
    add column if not exists og_description text,
    add column if not exists og_image text,
    add column if not exists cover_image text,
    add column if not exists package_code text;

-- 패키지 도입 — order_code는 nullable로 풀고, package_code가 새 필수 컬럼.
-- 기존 데이터 있으면 먼저 package_code 백필 후 set not null. 운영 데이터 없으면 그대로.
alter table public.film_page_posts
    alter column order_code drop not null;

-- package_code NOT NULL은 기존 데이터가 있으면 실패하므로, 데이터 없을 때만 적용.
do $$
begin
    if not exists (select 1 from public.film_page_posts where package_code is null) then
        alter table public.film_page_posts alter column package_code set not null;
    end if;
end $$;

-- 일관성 제약: post_type='text' 이거나, 'link'면 external_url 필수.
alter table public.film_page_posts
    drop constraint if exists film_page_posts_link_requires_url;
alter table public.film_page_posts
    add constraint film_page_posts_link_requires_url
    check (
        post_type = 'text'
        or (post_type = 'link' and external_url is not null and char_length(external_url) > 0)
    );

-- post_type 허용값 제한.
alter table public.film_page_posts
    drop constraint if exists film_page_posts_post_type_check;
alter table public.film_page_posts
    add constraint film_page_posts_post_type_check
    check (post_type in ('text', 'link'));

create index if not exists film_page_posts_created_at_idx
    on public.film_page_posts (created_at desc);
create index if not exists film_page_posts_user_id_idx
    on public.film_page_posts (user_id);
create index if not exists film_page_posts_package_code_idx
    on public.film_page_posts (package_code);

-- =========== 1-2. 주문 패키지 ===========
-- 사용자가 "전화번호로 매칭된 본인 주문 여러 개를 한 묶음으로 게시"하기 위한 테이블.
-- 게시글마다 패키지 하나가 생성되며, 패키지 코드(PKG-XXXXXXXX)는 사람이 보고 알아볼 수 있게.
create table if not exists public.film_page_order_packages (
    id uuid primary key default gen_random_uuid(),
    package_code text not null unique,
    user_id uuid not null references auth.users(id) on delete cascade,
    -- 사용자별 일련번호. package_code는 보통 `{handle}-{user_seq:03d}` 형태.
    -- (user_id, user_seq) unique로 동시 생성 충돌 시 재시도하면 됨.
    user_seq integer not null default 1,
    -- 매칭에 사용된 전화번호 — 스냅샷. 추후 본인 확인/통계용.
    phone text,
    -- 묶인 FilmCutting 주문번호 배열. 최소 1개 이상 필수.
    order_codes text[] not null check (array_length(order_codes, 1) >= 1),
    created_at timestamptz not null default now()
);

-- 운영 중 ALTER로도 멱등 적용
alter table public.film_page_order_packages
    add column if not exists user_seq integer not null default 1;

alter table public.film_page_order_packages
    drop constraint if exists film_page_order_packages_user_seq_unique;
alter table public.film_page_order_packages
    add constraint film_page_order_packages_user_seq_unique unique (user_id, user_seq);

create index if not exists film_page_order_packages_user_id_idx
    on public.film_page_order_packages (user_id);
create index if not exists film_page_order_packages_phone_idx
    on public.film_page_order_packages (phone);

-- =========== 2. 댓글 ===========
create table if not exists public.film_page_comments (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references public.film_page_posts(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    body text not null check (char_length(body) between 1 and 2000),
    created_at timestamptz not null default now()
);

create index if not exists film_page_comments_post_id_idx
    on public.film_page_comments (post_id, created_at);

-- =========== 3. 좋아요 ===========
create table if not exists public.film_page_likes (
    post_id uuid not null references public.film_page_posts(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (post_id, user_id)
);

-- =========== RLS 정책 ===========
alter table public.film_page_posts enable row level security;
alter table public.film_page_comments enable row level security;
alter table public.film_page_likes enable row level security;
alter table public.film_page_order_packages enable row level security;

-- posts
drop policy if exists "film_page_posts_select_all" on public.film_page_posts;
create policy "film_page_posts_select_all"
    on public.film_page_posts for select
    using (true);

drop policy if exists "film_page_posts_insert_own" on public.film_page_posts;
create policy "film_page_posts_insert_own"
    on public.film_page_posts for insert
    with check (auth.uid() = user_id);

drop policy if exists "film_page_posts_update_own" on public.film_page_posts;
create policy "film_page_posts_update_own"
    on public.film_page_posts for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "film_page_posts_delete_own" on public.film_page_posts;
create policy "film_page_posts_delete_own"
    on public.film_page_posts for delete
    using (auth.uid() = user_id);

-- comments (posts와 동일 패턴)
drop policy if exists "film_page_comments_select_all" on public.film_page_comments;
create policy "film_page_comments_select_all"
    on public.film_page_comments for select using (true);

drop policy if exists "film_page_comments_insert_own" on public.film_page_comments;
create policy "film_page_comments_insert_own"
    on public.film_page_comments for insert
    with check (auth.uid() = user_id);

drop policy if exists "film_page_comments_delete_own" on public.film_page_comments;
create policy "film_page_comments_delete_own"
    on public.film_page_comments for delete using (auth.uid() = user_id);

-- likes
drop policy if exists "film_page_likes_select_all" on public.film_page_likes;
create policy "film_page_likes_select_all"
    on public.film_page_likes for select using (true);

drop policy if exists "film_page_likes_insert_own" on public.film_page_likes;
create policy "film_page_likes_insert_own"
    on public.film_page_likes for insert
    with check (auth.uid() = user_id);

drop policy if exists "film_page_likes_delete_own" on public.film_page_likes;
create policy "film_page_likes_delete_own"
    on public.film_page_likes for delete using (auth.uid() = user_id);

-- packages
-- 조회: 모두 공개 (게시글이 공개이므로 패키지 정보도 공개해야 상세 페이지가 동작).
drop policy if exists "film_page_packages_select_all" on public.film_page_order_packages;
create policy "film_page_packages_select_all"
    on public.film_page_order_packages for select using (true);

drop policy if exists "film_page_packages_insert_own" on public.film_page_order_packages;
create policy "film_page_packages_insert_own"
    on public.film_page_order_packages for insert
    with check (auth.uid() = user_id);

drop policy if exists "film_page_packages_delete_own" on public.film_page_order_packages;
create policy "film_page_packages_delete_own"
    on public.film_page_order_packages for delete using (auth.uid() = user_id);

-- =========== Storage: 'film-page-covers' 버킷 ===========
-- 대표 이미지 업로드용 public 버킷. 인증 사용자가 본인 폴더에만 쓰기 가능.
insert into storage.buckets (id, name, public)
values ('film-page-covers', 'film-page-covers', true)
on conflict (id) do nothing;

-- 모든 사용자가 읽기 가능 (게시글 카드 썸네일로 노출되어야 함).
drop policy if exists "film_page_covers_public_read" on storage.objects;
create policy "film_page_covers_public_read"
    on storage.objects for select
    using (bucket_id = 'film-page-covers');

-- 인증 사용자만, 본인 user_id 폴더(`{uid}/...`)에만 업로드 가능.
drop policy if exists "film_page_covers_auth_insert" on storage.objects;
create policy "film_page_covers_auth_insert"
    on storage.objects for insert to authenticated
    with check (
        bucket_id = 'film-page-covers'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- 본인 파일만 삭제 가능.
drop policy if exists "film_page_covers_owner_delete" on storage.objects;
create policy "film_page_covers_owner_delete"
    on storage.objects for delete to authenticated
    using (
        bucket_id = 'film-page-covers'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- updated_at 자동 갱신 트리거 (posts only)
create or replace function public.film_page_set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists film_page_posts_set_updated_at on public.film_page_posts;
create trigger film_page_posts_set_updated_at
    before update on public.film_page_posts
    for each row execute function public.film_page_set_updated_at();
