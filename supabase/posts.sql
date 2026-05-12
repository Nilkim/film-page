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
    -- FilmCutting 주문번호 (있으면) — 게시글에 도면 첨부.
    -- 외래키 대신 그냥 text — FilmCutting orders 테이블에 RLS가 걸려있어
    -- 별도 정책으로 처리. 빈 값(null) 허용 = 도면 없는 일반 글도 가능.
    order_code text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists film_page_posts_created_at_idx
    on public.film_page_posts (created_at desc);
create index if not exists film_page_posts_user_id_idx
    on public.film_page_posts (user_id);

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
