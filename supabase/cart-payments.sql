-- FilmPage 장바구니 / 결제 / 관리자 schema.
--
-- 사용 방법: Supabase 대시보드 → SQL Editor 에서 실행. posts.sql 이후 적용.
--
-- 신규 테이블:
--   1. film_page_price_overrides — 패키지 단위 가격 오버라이드(관리자 할인)
--   2. film_page_orders          — film-artwork 자체 주문(결제 완료 시 1행)
--   3. film_page_admin_emails    — (옵션) DB 기반 관리자 화이트리스트
--
-- 신규 RPC:
--   - get_order_by_phone_and_no(phone, order_no) — 익명 주문조회
--
-- 정책 요지:
--   - price_overrides: SELECT 모두 공개 (카드/상세에 노출 필요). INSERT/UPDATE/DELETE 는 관리자만.
--   - orders: 일반 anon SELECT 차단. RPC 만 (phone+order_no 매칭 시) 반환.
--   - admin_emails: SELECT 본인 이메일만(자기가 관리자인지 확인). INSERT/DELETE 는 관리자만.

-- =========== 1. 가격 오버라이드 ===========
-- 관리자가 패키지의 노출 단가를 "원가보다 낮게" 덮어쓴다.
-- 원가(original_price) 는 스냅샷 — 취소선 렌더용. override_price 가 새 단가.
-- 같은 패키지에 재할인 시 override_price 만 갱신(이력은 단순화를 위해 단일 행 유지).
create table if not exists public.film_page_price_overrides (
    package_code   text primary key references public.film_page_order_packages(package_code) on delete cascade,
    original_price integer not null check (original_price >= 0),
    override_price integer not null check (override_price >= 0),
    reason         text,
    set_by         uuid references auth.users(id) on delete set null,
    set_at         timestamptz not null default now(),
    -- 단조 감소: 새 가격은 원가보다 작거나 같아야 한다(인상 금지).
    constraint film_page_price_overrides_lower_only check (override_price <= original_price)
);

create index if not exists film_page_price_overrides_set_at_idx
    on public.film_page_price_overrides (set_at desc);

-- =========== 2. 주문(결제) ===========
-- 카트 → 결제 시점에 'pending' 으로 1행 insert.
-- 포트원 webhook 이 status='paid' 로 갱신. 환불/취소 시 'cancelled'.
create table if not exists public.film_page_orders (
    id                   uuid primary key default gen_random_uuid(),
    order_no             text unique not null,                  -- 사람용: FA-YYYYMMDD-XXXX
    customer_name        text not null check (char_length(customer_name) between 1 and 60),
    customer_phone       text not null,                          -- 정규화: 숫자만 (생성 시 처리)
    customer_email       text,                                    -- 영수증·주문확인 발송용. KG이니시스 V2 일반결제는 필수.
    customer_addr        text not null check (char_length(customer_addr) between 1 and 200),
    customer_addr_detail text,
    customer_postal      text,
    -- 항목 스냅샷: [{ source, package_code?, order_code?, title, price, qty, thumb? }]
    -- 결제 시점의 가격을 봉인. 추후 오버라이드/원가가 바뀌어도 이 주문은 그대로.
    items                jsonb not null,
    subtotal             integer not null check (subtotal >= 0),
    discount             integer not null default 0 check (discount >= 0),
    total                integer not null check (total >= 0),
    pg_provider          text not null check (pg_provider in ('kakao', 'naver', 'google', 'card', 'test')),
    pg_tx_id             text,                                  -- 포트원 paymentId
    pg_status            text not null default 'pending'
                              check (pg_status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
    user_id              uuid references auth.users(id) on delete set null,
    memo                 text,
    created_at           timestamptz not null default now(),
    paid_at              timestamptz
);

-- 이미 운영 중인 DB 에 컬럼 멱등 추가 (재실행 안전).
alter table public.film_page_orders
    add column if not exists customer_email text;

create index if not exists film_page_orders_phone_idx
    on public.film_page_orders (customer_phone);
create index if not exists film_page_orders_created_at_idx
    on public.film_page_orders (created_at desc);
create index if not exists film_page_orders_pg_tx_id_idx
    on public.film_page_orders (pg_tx_id);

-- =========== 3. 관리자 화이트리스트 (옵션) ===========
-- env ADMIN_EMAILS 가 1순위. 운영 중 변동이 잦아지면 이 테이블도 활성.
-- is_admin() RPC 가 두 곳 모두 조회.
create table if not exists public.film_page_admin_emails (
    email      text primary key,
    added_at   timestamptz not null default now(),
    added_by   uuid references auth.users(id) on delete set null
);

-- =========== RLS ===========
alter table public.film_page_price_overrides enable row level security;
alter table public.film_page_orders          enable row level security;
alter table public.film_page_admin_emails    enable row level security;

-- price_overrides: SELECT 공개. 쓰기는 관리자만 (서버 액션이 service role 이용 권장).
drop policy if exists "film_page_price_overrides_select_all" on public.film_page_price_overrides;
create policy "film_page_price_overrides_select_all"
    on public.film_page_price_overrides for select using (true);

-- 쓰기 정책: env 기반 관리자는 service role 로 서버 액션에서 실행하므로 RLS 우회.
-- DB-only 관리자(admin_emails 테이블) 가 직접 클라이언트에서 쓰는 경우만 다음 정책 적용.
drop policy if exists "film_page_price_overrides_admin_write" on public.film_page_price_overrides;
create policy "film_page_price_overrides_admin_write"
    on public.film_page_price_overrides for all
    using (
        exists (
            select 1 from public.film_page_admin_emails a
            where a.email = (auth.jwt() ->> 'email')
        )
    )
    with check (
        exists (
            select 1 from public.film_page_admin_emails a
            where a.email = (auth.jwt() ->> 'email')
        )
    );

-- orders: 일반 SELECT 전면 차단. RPC 만 매칭 시 반환.
-- 관리자만 전체 조회 + 상태 변경 가능.
drop policy if exists "film_page_orders_admin_all" on public.film_page_orders;
create policy "film_page_orders_admin_all"
    on public.film_page_orders for all
    using (
        exists (
            select 1 from public.film_page_admin_emails a
            where a.email = (auth.jwt() ->> 'email')
        )
    )
    with check (
        exists (
            select 1 from public.film_page_admin_emails a
            where a.email = (auth.jwt() ->> 'email')
        )
    );

-- admin_emails: 본인 이메일이 등록돼 있는지 본인만 확인 가능.
-- 변경은 관리자만(부트스트랩은 SQL Editor 에서 직접 insert).
drop policy if exists "film_page_admin_emails_self_check" on public.film_page_admin_emails;
create policy "film_page_admin_emails_self_check"
    on public.film_page_admin_emails for select
    using (email = (auth.jwt() ->> 'email'));

drop policy if exists "film_page_admin_emails_admin_write" on public.film_page_admin_emails;
create policy "film_page_admin_emails_admin_write"
    on public.film_page_admin_emails for all
    using (
        exists (
            select 1 from public.film_page_admin_emails a
            where a.email = (auth.jwt() ->> 'email')
        )
    )
    with check (
        exists (
            select 1 from public.film_page_admin_emails a
            where a.email = (auth.jwt() ->> 'email')
        )
    );

-- =========== RPC: 익명 주문조회 ===========
-- 전화번호+주문번호 두 값이 동시에 매칭될 때만 1행 반환. 부분 매칭은 빈 결과.
-- security definer 로 RLS 우회. phone 은 숫자만 비교(저장 시점에 이미 정규화돼 있다고 가정).
create or replace function public.get_order_by_phone_and_no(
    p_phone text,
    p_order_no text
)
returns table (
    order_no       text,
    customer_name  text,
    items          jsonb,
    subtotal       integer,
    discount       integer,
    total          integer,
    pg_provider    text,
    pg_status      text,
    created_at     timestamptz,
    paid_at        timestamptz
)
language sql
security definer
stable
as $$
    select o.order_no, o.customer_name, o.items, o.subtotal, o.discount, o.total,
           o.pg_provider, o.pg_status, o.created_at, o.paid_at
    from public.film_page_orders o
    where regexp_replace(o.customer_phone, '\D', '', 'g')
          = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
      and o.order_no = p_order_no
    limit 1;
$$;

grant execute on function public.get_order_by_phone_and_no(text, text) to anon, authenticated;

-- =========== RPC: 관리자 확인 ===========
-- env 화이트리스트가 1순위지만, 서버에서 보조 확인용으로 DB 측에도 두 곳 합쳐 조회.
create or replace function public.is_admin(p_email text)
returns boolean
language sql
security definer
stable
as $$
    select exists (
        select 1 from public.film_page_admin_emails where email = p_email
    );
$$;

grant execute on function public.is_admin(text) to anon, authenticated;

-- =========== 주문번호 채번 ===========
-- FA-YYYYMMDD-XXXX 형식. 같은 날 일련번호는 카운트로 확보(경합은 retry).
create or replace function public.next_film_page_order_no()
returns text
language plpgsql
as $$
declare
    today_str text := to_char(now() at time zone 'Asia/Seoul', 'YYYYMMDD');
    seq integer;
    candidate text;
begin
    -- 오늘 날짜로 시작하는 주문번호 중 최대 seq + 1
    select coalesce(max((regexp_match(order_no, 'FA-' || today_str || '-(\d+)'))[1]::int), 0) + 1
    into seq
    from public.film_page_orders
    where order_no like 'FA-' || today_str || '-%';

    candidate := 'FA-' || today_str || '-' || lpad(seq::text, 4, '0');
    return candidate;
end;
$$;

grant execute on function public.next_film_page_order_no() to anon, authenticated;
