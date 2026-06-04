# 장바구니 + 결제 시스템 도입 (film-artwork.com)

## Context

film-page 는 현재 게시판/소셜 기능만 있고 거래 기능이 없다. 사용자는 (주)코틸레돈(7588601913, 통신판매업 제2020-경기김포-2948호) 사업자로, 이번 작업으로 **게시물의 패키지 단가에 장바구니를 붙이고 결제까지 일관 처리**하는 단계로 확장한다.

핵심 흐름은 두 가지 진입점:

1. **film-artwork 게시물 패키지** → 카드의 "장바구니 담기" → 카트 → 결제
2. **FilmCutting 에서 도면 생성** → 결제 단계에서 "film-artwork 에서 결제" 선택 → film-artwork 카트로 도면이 자동 push → 결제

결제는 **포트원 V2 올인원**(구글페이/네이버페이/카카오페이 3사 라우팅). 회원가입은 강요하지 않고, **이름/주소/전화번호**는 결제 단계에서 받는다. 주문 후에는 **전화번호 기반 주문조회**로 후처리.

`✶ 가격 정책 ─────────────────────────────────────`
관리자가 "더 낮은 단가"를 입력하면 **원가에 취소선 + 새 가격 노출**. 즉 가격 수정은 **단조 감소만**(절대 인상 X). FilmCutting 의 원본 `orders.total_price` 는 진실 원천이라 건드리지 않고, film-page 측에 **할인 오버라이드 레이어**를 얹는다.
`─────────────────────────────────────────────────`

---

## 결정 사항 (사용자 답변 반영)

| 갈림길 | 선택 |
|---|---|
| 할인 단위 | **단가 덮어쓰기 + 시각적 취소선/할인가** 방식 |
| 관리자 권한 | **이메일 화이트리스트** (env `ADMIN_EMAILS` 1순위, 추후 admin_users 테이블로 확장 가능) |
| 장바구니 저장 | **localStorage** (익명 우선, 결제 시 서버 orders 1행 생성) |
| PG | **포트원 V2** |
| 결제 진입 | 익명 OK, 결제 단계에서 이름/주소/전화번호 입력 |
| 주문조회 | 전화번호 기반 (기존 `list_orders_by_phone` 패턴 확장) |

---

## DB 스키마 변경

### 신규 테이블

**`film_page_price_overrides`** — 패키지 단위 할인 오버라이드

```sql
create table public.film_page_price_overrides (
  package_code  text primary key references film_page_order_packages(package_code) on delete cascade,
  override_price integer not null,   -- 원화, 새 단가(원가보다 낮아야 함, CHECK)
  original_price integer not null,   -- 스냅샷(취소선 표시용)
  reason         text,                -- 관리자 메모
  set_by         uuid references auth.users(id),
  set_at         timestamptz default now()
);
-- RLS: SELECT all (공개, 카드에 노출), INSERT/UPDATE/DELETE admin only
```

**`film_page_orders`** — film-artwork 자체 주문 테이블 (FilmCutting `orders` 와 분리)

```sql
create table public.film_page_orders (
  id            uuid primary key default gen_random_uuid(),
  order_no      text unique not null,            -- 사람용 번호 (FA-YYYYMMDD-XXXX)
  customer_name text not null,
  customer_phone text not null,                  -- 주문조회 키
  customer_addr text not null,                   -- 배송지(필름 실물 출력 → 배송 가정)
  customer_addr_detail text,
  customer_postal text,
  items         jsonb not null,                  -- [{ source, package_code?, order_code?, title, price, qty, ... }]
  subtotal      integer not null,
  discount      integer default 0,
  total         integer not null,
  pg_provider   text not null,                   -- 'kakao' | 'naver' | 'google'
  pg_tx_id      text,                            -- 포트원 paymentId
  pg_status     text not null,                   -- 'pending' | 'paid' | 'failed' | 'cancelled'
  user_id       uuid references auth.users(id), -- 로그인 사용자면 채움(선택)
  memo          text,
  created_at    timestamptz default now(),
  paid_at       timestamptz
);
create index on film_page_orders (customer_phone);
-- RLS: SELECT 전화번호+order_no 매칭 RPC 만 anon 허용, INSERT 서비스 키 또는 webhook,
--      admin 전체 SELECT
```

**`film_page_admin_emails`** — (옵션) env 이외 admin DB 관리

```sql
create table public.film_page_admin_emails (
  email text primary key,
  added_at timestamptz default now()
);
-- 처음엔 env ADMIN_EMAILS 만 사용. 운영 중 변동 잦아지면 이 테이블 활성.
```

### RPC 신규

- `get_order_by_phone_and_no(p_phone text, p_order_no text)` — 익명 주문조회용 (RLS 우회, 두 값 동시 매칭 시에만 반환)
- `is_admin(p_email text)` — env 화이트리스트 또는 admin_emails 테이블 lookup (서버에서 보조 검증)

---

## 구현 단계 (5 phase)

### Phase 1: 관리자 인프라 (가격 오버라이드 UI)

**파일:**
- `src/lib/admin.ts` (신규) — `isAdminEmail(email)` 헬퍼. env `ADMIN_EMAILS` 콤마 분리 파싱.
- `src/app/admin/page.tsx` (신규) — 관리자 게이트(이메일 화이트리스트 검사 후 fork)
- `src/app/admin/posts/page.tsx` (신규) — 모든 게시물의 패키지 가격 + 오버라이드 입력 UI
- `src/app/admin/posts/actions.ts` (신규) — `setPriceOverride()` / `clearPriceOverride()` 서버 액션

**핵심 UX:**
- 표 형태: 게시물 제목 / 패키지 코드 / 원가 / 오버라이드 가격 입력 / 저장
- 원가보다 높은 값 입력 시 CHECK 제약으로 거부 + 에러 토스트

**노출 변경:**
- `src/components/OrderPackagePanel.tsx` — `originalPrice` / `displayPrice` 두 값 받아 취소선 + 새가격 렌더. 오버라이드 없으면 단일 가격.
- `src/components/PostCard.tsx` — 카드에 가격 노출(현재는 안 보임). 할인 시 취소선 동일 패턴.
- `src/lib/orders.ts` — 패키지 합산 시 오버라이드 lookup 한 번 더(같은 anon 클라이언트로).

### Phase 2: 장바구니 (localStorage)

**파일:**
- `src/lib/cart.ts` (신규) — 카트 상태 유틸. 타입 정의 + add/remove/clear/getTotal.
- `src/components/CartProvider.tsx` (신규) — Context Provider. localStorage 동기화 + 브로드캐스트(같은 도메인 다른 탭 동기화는 `storage` 이벤트).
- `src/components/CartButton.tsx` (신규) — 헤더 우상단 카트 아이콘(개수 뱃지).
- `src/app/cart/page.tsx` (신규) — 카트 페이지. 항목 리스트 + 수량 조정 + 합계 + "결제하기" CTA.
- `src/components/AddToCartButton.tsx` (신규) — PostCard / OrderPackagePanel 에 끼울 버튼.

**카트 아이템 타입:**

```ts
type CartItem =
  | { source: 'post-package'; package_code: string; post_id: string; title: string; thumb?: string; price: number; original_price?: number; qty: number }
  | { source: 'filmcutting-order'; order_code: string; phone: string; title: string; thumb?: string; price: number; qty: 1 };  // 도면은 항상 qty=1
```

**중요 제약:**
- 카트는 클라이언트 전용. SSR 시 `null` 또는 empty 로 hydrate 후 클라에서 채움(hydration mismatch 회피).
- ISR 캐시 영향 0 — 헤더 카트 아이콘은 client component.

### Phase 3: FilmCutting → film-artwork 카트 진입

**FilmCutting 측 수정 (C:\Projects\FilmCutting\film-cutting):**
- `src/pages/OrderCompletePage.jsx` line 114~150 — 현재 네이버쇼핑 하드코딩 링크를 결제 선택 UI 로 교체:
  - "**filmartwork.com 에서 결제**" 버튼 → `https://film-artwork.com/cart?from=filmcutting&order_code={code}&phone={phone}` 로 이동
  - 기존 네이버쇼핑 링크도 옵션으로 유지(레거시 사용자 보호)

**film-page 측:**
- `src/app/cart/page.tsx` — `searchParams.from === 'filmcutting'` 이면 `order_code` + `phone` 으로 RPC `list_orders_by_phone` 1회 호출 → 매칭 주문 찾아 카트에 push → URL 정리(쿼리스트링 제거, replaceState).
- 중복 push 방지: 카트에 동일 `order_code` 있으면 skip.

### Phase 4: 결제 (포트원 V2)

**파일:**
- `src/lib/portone.ts` (신규) — 포트원 V2 client SDK 래퍼. `requestPayment({ provider, amount, orderName, customer })`.
- `src/app/checkout/page.tsx` (신규) — 결제 폼:
  - 이름/전화번호/주소(우편번호 검색은 daum postcode 임베드)/추가 메모
  - PG 선택 라디오(구글페이/네이버페이/카카오페이)
  - 합계 표시, "결제 진행" 버튼
- `src/app/checkout/actions.ts` (신규) — `createPendingOrder(items, customer)` 서버 액션:
  - `film_page_orders` 에 status='pending' 으로 1행 insert → `order_no` 반환
- `src/app/api/payments/webhook/route.ts` (신규) — 포트원 webhook 수신:
  - signature 검증 → `pg_tx_id` 로 `film_page_orders` 행 lookup → status 갱신
  - paid 시 카트 비우기는 클라이언트에서(webhook 은 DB 만)
- `src/app/checkout/complete/page.tsx` (신규) — 결제 완료 화면. order_no 표시 + 주문조회 안내.

**포트원 V2 환경변수:**
- `PORTONE_STORE_ID`, `PORTONE_API_SECRET`, `PORTONE_CHANNEL_KEY_KAKAO`, `PORTONE_CHANNEL_KEY_NAVER`, `PORTONE_CHANNEL_KEY_GOOGLE`
- `PORTONE_WEBHOOK_SECRET`

### Phase 5: 주문조회 (회원가입 X 핵심 장치)

**파일:**
- `src/app/orders/lookup/page.tsx` (신규) — 입력 폼: 전화번호 + 주문번호 → RPC `get_order_by_phone_and_no` 호출 → 결과 표시
- 결과: 주문 항목 / 합계 / 상태 / 배송 추적(있다면)
- 헤더에 "주문조회" 링크 추가

### 부가: 관리자 페이지 확장 (Phase 1 과 함께)

- `src/app/admin/orders/page.tsx` — 전체 주문 리스트, 상태 변경, 배송 정보 입력
- 같은 `isAdminEmail` 게이트

---

## 재사용 자원 (이미 있는 것 — 새로 만들지 말 것)

- **`src/lib/supabase/anon.ts`** `createAnonClient()` — 카트/오버라이드 lookup 등 공개 read 전부 이걸로. ISR 캐시 유지.
- **`src/lib/supabase/server.ts`** `createClient()` — 관리자 액션/결제 액션에서만 (쿠키 필요).
- **`src/lib/orders.ts`** `listOrdersByPhone(phone)` — FilmCutting RPC 호출. 카트 진입 시 그대로 재사용.
- **`src/components/OrderPackagePanel.tsx`** — 가격 표시 단일 진입점. 여기만 고치면 카드/상세 자동 반영.
- **`src/lib/extract.ts` 의 `unstable_cache` 패턴** — 가격 오버라이드도 같은 패턴으로 30s 캐시 가능(잦은 조회 부담 경감).

---

## 변경 영향 정리

| 영역 | 영향 |
|---|---|
| ISR 캐싱 | **유지** — 카트/카트버튼 전부 client component, cookies() 호출 안 함 |
| RLS | film_page_orders / price_overrides 신규 정책 필요. 기존 정책 무변경 |
| FilmCutting 코드 | OrderCompletePage 단 1개 파일 수정(결제 선택 UI 추가) |
| 외부 글 저장 정책 | **무영향** — 카트/주문은 자체 데이터만 다룸 ([film-page-external-content-policy](../../C:/Users/Administrator/.claude/projects/c--Projects-film-page/memory/film-page-external-content-policy.md)) |

---

## Verification

### 로컬 검증

1. `pnpm dev` 후 다음을 순서대로:
   - **관리자 게이트** — 비관리자 이메일로 로그인 → `/admin` 접근 시 403 또는 홈 리다이렉트
   - 관리자 이메일(nilkim79@gmail.com)로 로그인 → 가격 오버라이드 입력 → 게시물 카드/상세에서 취소선+할인가 노출 확인
   - **카트 (PostCard 진입)** — 카드 "장바구니 담기" → 헤더 카트 뱃지 +1 → `/cart` 진입 → 항목 표시
   - **카트 (FilmCutting 진입)** — `http://localhost:3000/cart?from=filmcutting&order_code=<실제코드>&phone=<실제전화>` 직접 진입 → 도면 항목 추가 확인 + URL 클린업
   - **결제 (테스트 모드)** — 포트원 테스트 채널키로 카카오/네이버/구글페이 각각 결제 → webhook 수신 → orders 행 status='paid' 확인
   - **주문조회** — `/orders/lookup` 전화번호+주문번호 입력 → 본인 주문만 보이고 타인 주문 차단 확인

### DB 검증

- Supabase SQL Editor 에서:
  ```sql
  select * from film_page_price_overrides order by set_at desc;
  select id, order_no, customer_phone, total, pg_status from film_page_orders order by created_at desc limit 10;
  ```
- RLS 차단 확인: anon 키로 `select * from film_page_orders` 시 0행 반환되어야 함(RPC 만 우회 가능).

### 운영 전 점검

- Netlify 환경변수 추가: `ADMIN_EMAILS`, `PORTONE_*` 5개
- 포트원 웹훅 URL 등록: `https://film-artwork.com/api/payments/webhook`
- FilmCutting 측 OrderCompletePage 도 배포(별도 프로젝트라 별도 git/배포)
- 캐시 트랩 주의 — 결제/주문조회 라우트는 `force-dynamic` + `cache-control: private` ([film-page-image-proxy-cdn-trap](../../C:/Users/Administrator/.claude/projects/c--Projects-film-page/memory/film-page-image-proxy-cdn-trap.md) 패턴)

---

## 의도적으로 하지 않을 것

- **결제 PG 직결합** — 포트원 V2 로 통일. 3사 직접 SDK 안 씀.
- **DB 카트 테이블** — localStorage 만. 기기 동기화는 첫 버전 스코프 밖.
- **쿠폰/적립** — 단가 덮어쓰기 방식으로 통일. 쿠폰 테이블 안 만듦.
- **회원가입 강요/이메일 인증** — 익명 결제 + 전화번호 조회로 충분.
- **og_title / og_description / 본문 텍스트 저장** — 기존 외부 콘텐츠 정책 그대로 유지.

---

## 작업 순서 권장

> Phase 1(관리자/가격) → Phase 2(카트) → Phase 4(결제) → Phase 3(FilmCutting 연결) → Phase 5(주문조회)

이유: 가격 표시가 먼저 정확해야 카트가 의미 있음. FilmCutting 연결은 film-page 카트가 작동하고 나서 진입점 추가만 하면 되므로 뒤로. 결제는 카트 다음 자연스러운 순서.

---

## ADR-001: 결제 인프라 = 포트원 V2 유지 (직결 X)

**결정일**: 2026-06-04
**결정**: 결제 인프라는 **포트원(PortOne) V2** 어그리게이터를 그대로 유지한다. KG이니시스 직결합으로 전환하지 않는다.

### Context

운영 중 "KG이니시스 한 PG 만 쓸 거면 포트원 한 단계 빼고 직결하는 게 단순하지 않냐" 는 의문이 제기됨. 현재 통합 상태:
- `@portone/browser-sdk` + `@portone/server-sdk` 설치 완료
- KG이니시스 V2 채널 1개(channel-key-66db42eb-...) 활성
- `CheckoutForm.requestPayment` / `webhook/route.ts` / 환불·조회 모두 PortOne SDK 의존

### Decision

포트원 V2 유지. 직결 검토 시점은 **아래 트리거 조건이 발생할 때만**.

### Consequence — 이점 5가지

1. **인터페이스 통일** — `PortOne.requestPayment` / `Webhook.verify` / `payment.getPayment` 3개 API 가 모든 PG 에 동일. 카카오·네이버·토스·스마트페이 등 추가 시 코드 0줄 변경(채널키만 갈아끼움).
2. **카카오·네이버페이 신청 대기 중** — [V104] 에러로 미활성. 풀리는 시점에 즉시 추가 가능해 포트원 가치 ↑.
3. **추가 수수료 0원** — 포트원 자체는 가맹점 무료 (PG 수수료에서 포트원 측 정산).
4. **콘솔 통합** — 모든 거래·환불·webhook 로그가 포트원 콘솔 한 화면에 누적.
5. **매몰비용** — 통합·검증·배포 완료 상태. 직결 전환은 약 2~3일 풀 리팩토링.

### 트레이드오프

- **외부 의존성 +1** — 포트원 다운 시 결제 영향 (드물지만 가능).
- **약간의 학습 비용** — V1/V2 가 다르고 SDK 변화 가능성.

### 직결 전환 트리거 (이때 재검토)

다음 중 하나가 명백해지면 ADR 갱신·전환 검토:
- 포트원 정책 변경으로 수수료·제약 발생
- KG이니시스 한 PG 만으로 1년 이상 운영이 확정 + 다른 PG 추가 의도 없음
- 포트원 다운/장애로 결제 손실 누적 (운영 데이터로 입증)
- 포트원 SDK breaking change 로 재통합 비용 발생

### 영향 없는 후속 작업 — 그대로 진행 가능

- KG이니시스 가맹점 측 카카오·네이버페이 추가 신청(별건)
- Resend 도메인 인증(별건, 메일 인프라)
- pending 24h+ 자동 만료(별건, 운영 정합성)

ADR 의 핵심은 **"결정의 이유" 가 1년 뒤에도 명확히 읽힌다** 는 것. 트리거 조건이 발생하지 않으면 재검토하지 않는다.

---

## ADR-002: 호스팅 = Netlify 유지 + cold start 완화 우선

**결정일**: 2026-06-04
**결정**: 호스팅은 **Netlify 그대로 유지**. Cloudflare Pages / Firebase Hosting 마이그레이션 보류. 한국 사용자 "느림" 증상은 **ISR cache 정책 + prerender 강화** 로 해결.

### 진단 결과

`curl -o /dev/null -s -w "..." https://film-artwork.com/` 5회 측정:

| 요청 | DNS | Connect | SSL | TTFB | Total |
|---|---|---|---|---|---|
| 1st (cold) | 0.14s | 0.15s | 0.53s | **3.42s** 🚨 | 3.49s |
| 2nd (warm) | — | — | — | 0.50s | 0.56s |
| 3rd (warm) | — | — | — | 0.49s | 0.56s |
| /cart (dynamic) | — | — | — | 0.79s | 0.86s |
| /orders/lookup (dynamic) | — | — | — | 0.74s | 0.80s |

**결론**:
- DNS/Connect/SSL = 정상 (한국 → 도쿄 PoP 까지의 latency 가 80~150ms 로 양호)
- cold start TTFB **3.42s** vs warm **0.50s** = **7배 차이**
- "느림" 의 정체 = **첫 방문자(cache miss)** 의 ISR re-generation 시간

### Why NOT 마이그레이션

| 옵션 | 한국 PoP latency | Cold start | 우리 호환성 | 마이그레이션 비용 |
|---|---|---|---|---|
| Netlify (현재) | 80~120ms (도쿄) | 1~3초 (Lambda) | 완벽 | 0 |
| Cloudflare Pages | 20~40ms (서울) | ~10ms (Workers V8 isolate) | **위험** — `@portone/server-sdk`, `resend`, `@supabase/ssr` 등 Node-only API 검증 필요 | 2~5일 |
| Firebase Hosting | 80~120ms (도쿄) | 1~3초 (Cloud Run) | 완벽 | 1~3일 |

- **Cloudflare** 의 큰 이점은 cold start ~10ms 인데, 우리 SDK 3개가 V8 isolate 에서 폭발할 가능성 있어 검증 비용 큼.
- **Firebase** 는 Netlify 대비 차이 거의 없음.
- **마이그레이션보다 ISR 캐시 조정이 효과 같음 + 비용 1/10**.

### Recommended Actions (3 phase)

**Phase A — 즉시 (코드 1~2줄)**
1. `src/app/page.tsx` 의 `export const revalidate = 60` → **600** (10분) 또는 **3600** (1시간) 로 변경. 게시물이 잦게 변하지 않으므로 안전. cache hit 율 ↑ → cold start 빈도 ↓.
2. `src/app/posts/[id]/page.tsx` 도 동일하게 600~3600 으로.

**Phase B — 단기 (반나절)**
3. `src/app/posts/[id]/page.tsx` 에 `generateStaticParams` 추가 — 최근 60개 게시물의 ID 를 빌드 시점에 prerender. 첫 방문자도 정적 자산 즉시 응답 (~50ms).
4. 새 글 작성 시 `revalidatePath` 호출 위치 점검 — actions 에서 정확히 갱신되는지.

**Phase C — 검증·관찰**
5. Netlify Analytics 또는 Vercel Speed Insights 로 P75/P95 TTFB 측정 (cold start 빈도 실제 데이터).
6. 1주일 운영 후 재측정 — cold start 가 여전히 잦으면 Cloudflare 검토 트리거.

### Supabase region 확인 (별건 — 부수 영향)

위 측정에서 dynamic route TTFB 0.79s 중 일부가 Supabase 호출 시간. Supabase 콘솔 → Project Settings → General → **Region** 확인:
- `Northeast Asia (Tokyo)` 또는 `Northeast Asia (Seoul)` 이면 양호
- `Southeast Asia (Singapore)` / `US` 면 → DB 호출당 100~200ms 추가, 별도 마이그레이션 검토(데이터 이전 작업 큼)

### 트리거 — Cloudflare 재검토 시점

다음 중 하나라도:
- Phase A+B 적용 후에도 P75 TTFB > 2초
- 모바일 사용자 비율 ↑ + cold start 불만 누적
- Netlify Function 사용량 한도 초과(매월 125k req)
- SDK 호환성 우려 사라짐(테스트 환경에서 PortOne/Resend/Supabase 모두 통과 확인)
